import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog, getClientIp } from '@/lib/auth';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { getMexicoTodayDate, buildTodayDateRange } from '@/lib/timezone';

// Minimum meal (comida) duration in minutes
const MIN_MEAL_MINUTES = 15;
// Default tolerance in minutes
const DEFAULT_TOLERANCE_MINUTES = 5;

export async function POST(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();

    let { employeeId } = await request.json();

    if (!employeeId) {
      if (currentUser.role === 'EMPLOYEE') {
        const emp = await db.employee.findUnique({
          where: { userId: currentUser.id }
        });
        if (emp) employeeId = emp.id;
      }
    }

    if (!employeeId) {
      return NextResponse.json({ error: 'ID de empleado es requerido' }, { status: 400 });
    }

    const todayStr = getMexicoTodayDate();
    const todayRange = buildTodayDateRange();
    const now = new Date();
    const mealEndTime = now.toISOString();

    // Find today's attendance record
    let existingRecord: Record<string, unknown> | null = null;

    try {
      const todayRecords = await db.attendanceRecord.findMany({
        where: { employeeId, date: todayRange },
        include: {
          employee: {
            include: { user: true }
          }
        },
        take: 1
      });
      existingRecord = todayRecords[0] || null;
    } catch (includeErr) {
      console.warn('[meal-end] Complex include failed, trying simple query:', String(includeErr));
      try {
        const todayRecordsSimple = await db.attendanceRecord.findMany({
          where: { employeeId, date: todayRange },
          take: 1
        });
        existingRecord = todayRecordsSimple[0] || null;
      } catch (simpleErr) {
        console.error('[meal-end] Simple query also failed:', String(simpleErr));
        return NextResponse.json({
          error: 'No se pudo obtener el registro de asistencia. Intente de nuevo.',
          details: String(simpleErr),
        }, { status: 500 });
      }
    }

    if (!existingRecord) {
      return NextResponse.json({ error: 'No se ha registrado la entrada hoy' }, { status: 404 });
    }

    if (!existingRecord.mealStart) {
      return NextResponse.json({ error: 'No se ha iniciado la comida hoy' }, { status: 400 });
    }

    if (existingRecord.mealEnd) {
      return NextResponse.json({ error: 'Ya se ha terminado la comida hoy' }, { status: 409 });
    }

    if (existingRecord.checkOutTime) {
      return NextResponse.json({ error: 'Ya se ha registrado la salida hoy' }, { status: 400 });
    }

    // Enforce minimum meal time
    const mealStartDate = new Date(existingRecord.mealStart as string);
    const mealDurationMs = now.getTime() - mealStartDate.getTime();
    const mealDurationMinutes = Math.floor(mealDurationMs / 60000);

    if (mealDurationMinutes < MIN_MEAL_MINUTES) {
      const remainingMinutes = MIN_MEAL_MINUTES - mealDurationMinutes;
      return NextResponse.json({
        error: `Debe esperar al menos ${MIN_MEAL_MINUTES} minutos de comida. Faltan ${remainingMinutes} minuto(s).`,
        remainingMinutes,
        currentDuration: mealDurationMinutes,
        minimumRequired: MIN_MEAL_MINUTES,
      }, { status: 400 });
    }

    // Get meal tolerance from sucursal
    let toleranceMinutes = DEFAULT_TOLERANCE_MINUTES;
    try {
      const emp = existingRecord.employee as Record<string, unknown> | undefined;
      const employeeSucursal = (emp?.sucursal as string) || (existingRecord.sucursal as string) || 'Matriz';
      const sucursalRecord = await db.sucursal.findFirst({
        where: { name: employeeSucursal }
      });
      if (sucursalRecord) {
        const sr = sucursalRecord as Record<string, unknown>;
        if (sr.mealToleranceMinutes !== undefined && sr.mealToleranceMinutes !== null) {
          toleranceMinutes = sr.mealToleranceMinutes as number;
        } else if (sr.breakToleranceMinutes !== undefined && sr.breakToleranceMinutes !== null) {
          // Fallback to legacy field
          toleranceMinutes = sr.breakToleranceMinutes as number;
        }
      }
    } catch (sucErr) {
      console.warn('[meal-end] Could not fetch sucursal tolerance, using default:', String(sucErr));
    }

    // Calculate if meal was exceeded
    const maxAllowedMinutes = MIN_MEAL_MINUTES + toleranceMinutes;
    const exceededMeal = mealDurationMinutes > maxAllowedMinutes;
    const excessMinutes = exceededMeal ? mealDurationMinutes - maxAllowedMinutes : 0;

    // Record meal end
    let record;
    try {
      record = await db.attendanceRecord.update({
        where: { id: existingRecord.id as string },
        data: {
          mealEnd: mealEndTime,
          mealDuration: mealDurationMinutes,
          exceededMeal,
          ...(exceededMeal ? {
            notes: existingRecord.notes
              ? `${existingRecord.notes} | Excedió comida por ${excessMinutes} min (tolerancia: ${toleranceMinutes} min)`
              : `Excedió comida por ${excessMinutes} min (tolerancia: ${toleranceMinutes} min)`
          } : {}),
        }
      });
    } catch (updateErr) {
      const errMsg = String(updateErr);
      console.error('[meal-end] Update failed:', errMsg);

      if (errMsg.includes('column') || errMsg.includes('42703') || errMsg.includes('does not exist') || errMsg.includes('meal_end')) {
        return NextResponse.json({
          error: 'Las columnas de comida no existen en la base de datos. Agregue: meal_end (text), meal_duration (integer), exceeded_meal (boolean) a la tabla attendance_records.',
          needsMigration: true,
        }, { status: 503 });
      }

      if (errMsg.includes('policy') || errMsg.includes('RLS') || errMsg.includes('permission') || errMsg.includes('denied')) {
        return NextResponse.json({
          error: 'Error de permisos en la base de datos.',
          details: errMsg,
        }, { status: 403 });
      }

      return NextResponse.json({
        error: 'Error al registrar el fin de la comida. Intente de nuevo.',
        details: errMsg,
      }, { status: 500 });
    }

    // Audit log (non-blocking)
    try {
      const emp = existingRecord.employee as Record<string, unknown> | undefined;
      const empName = (emp?.user as Record<string, unknown>)?.name || 'Empleado';
      await createAuditLog(currentUser.id, 'MEAL_END', request, 'ATTENDANCE_RECORD', (record as Record<string, unknown>).id as string, {
        employeeId,
        employeeName: empName,
        mealEndTime,
        mealDuration: mealDurationMinutes,
        exceededMeal,
        excessMinutes,
        toleranceMinutes,
      });
    } catch (auditErr) {
      console.warn('[meal-end] Audit log failed (non-critical):', String(auditErr));
    }

    return NextResponse.json({
      record,
      mealDuration: mealDurationMinutes,
      exceededMeal,
      excessMinutes,
      toleranceMinutes,
      message: exceededMeal
        ? `Comida terminada. Duración: ${mealDurationMinutes} min. Excedió por ${excessMinutes} min (tolerancia: ${toleranceMinutes} min). Se registró el exceso.`
        : `Comida terminada. Duración: ${mealDurationMinutes} min. Dentro del tiempo permitido.`
    });
  } catch (error) {
    console.error('[meal-end] Unhandled error:', error);
    const errMsg = String(error);

    if (errMsg.includes('JWT') || errMsg.includes('token') || errMsg.includes('auth')) {
      return NextResponse.json({ error: 'Error de autenticación con la base de datos.' }, { status: 503 });
    }

    return NextResponse.json({
      error: 'Error interno del servidor',
      details: errMsg,
    }, { status: 500 });
  }
}
