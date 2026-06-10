import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog, getClientIp } from '@/lib/auth';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { getMexicoTodayDate, getMexicoNow, buildTodayDateRange } from '@/lib/timezone';

// Minimum break duration in minutes (by law, 30 minutes)
const MIN_BREAK_MINUTES = 30;
// Default tolerance in minutes (configurable per sucursal)
const DEFAULT_TOLERANCE_MINUTES = 5;

export async function POST(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();

    let { employeeId } = await request.json();

    // Resolve employeeId from authenticated user
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
    const breakEndTime = now.toISOString();

    // Find today's attendance record — try with include first, fallback to simple query
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
      console.warn('[break-end] Complex include failed, trying simple query:', String(includeErr));
      try {
        const todayRecordsSimple = await db.attendanceRecord.findMany({
          where: { employeeId, date: todayRange },
          take: 1
        });
        existingRecord = todayRecordsSimple[0] || null;
      } catch (simpleErr) {
        console.error('[break-end] Simple query also failed:', String(simpleErr));
        return NextResponse.json({
          error: 'No se pudo obtener el registro de asistencia. Intente de nuevo.',
          details: String(simpleErr),
        }, { status: 500 });
      }
    }

    if (!existingRecord) {
      return NextResponse.json({ error: 'No se ha registrado la entrada hoy' }, { status: 404 });
    }

    // Determine break system: new (breakStart) or old (mealStart/restStart)
    const rec = existingRecord as Record<string, unknown>;
    const isNewBreakSystem = !!rec.breakStart;
    const isOldBreakSystem = !rec.breakStart && (!!rec.mealStart || !!rec.restStart);

    if (!isNewBreakSystem && !isOldBreakSystem) {
      return NextResponse.json({ error: 'No se ha iniciado un descanso hoy' }, { status: 400 });
    }

    // Check if break already ended
    if (isNewBreakSystem && rec.breakEnd) {
      return NextResponse.json({ error: 'Ya se ha terminado el descanso hoy' }, { status: 409 });
    }
    if (isOldBreakSystem && rec.mealEnd && rec.restEnd) {
      return NextResponse.json({ error: 'Ya se ha terminado el descanso hoy' }, { status: 409 });
    }

    if (existingRecord.checkOutTime) {
      return NextResponse.json({ error: 'Ya se ha registrado la salida hoy' }, { status: 400 });
    }

    // Determine effective break start time
    const effectiveBreakStart = (isNewBreakSystem ? rec.breakStart : (rec.mealStart || rec.restStart)) as string;
    const breakStartDate = new Date(effectiveBreakStart);
    const breakDurationMs = now.getTime() - breakStartDate.getTime();
    const breakDurationMinutes = Math.floor(breakDurationMs / 60000);

    // Enforce minimum 30-minute break
    if (breakDurationMinutes < MIN_BREAK_MINUTES) {
      const remainingMinutes = MIN_BREAK_MINUTES - breakDurationMinutes;
      return NextResponse.json({
        error: `Debe esperar al menos ${MIN_BREAK_MINUTES} minutos de descanso. Faltan ${remainingMinutes} minuto(s).`,
        remainingMinutes,
        currentDuration: breakDurationMinutes,
        minimumRequired: MIN_BREAK_MINUTES,
      }, { status: 400 });
    }

    // Get break tolerance from sucursal
    let toleranceMinutes = DEFAULT_TOLERANCE_MINUTES;
    try {
      const emp = existingRecord.employee as Record<string, unknown> | undefined;
      const employeeSucursal = (emp?.sucursal as string) || (existingRecord.sucursal as string) || 'Matriz';
      const sucursalRecord = await db.sucursal.findFirst({
        where: { name: employeeSucursal }
      });
      if (sucursalRecord && (sucursalRecord as Record<string, unknown>).breakToleranceMinutes !== undefined && (sucursalRecord as Record<string, unknown>).breakToleranceMinutes !== null) {
        toleranceMinutes = (sucursalRecord as Record<string, unknown>).breakToleranceMinutes as number;
      }
    } catch (sucErr) {
      console.warn('[break-end] Could not fetch sucursal tolerance, using default:', String(sucErr));
    }

    // Calculate if break was exceeded
    const maxAllowedMinutes = MIN_BREAK_MINUTES + toleranceMinutes;
    const exceededBreak = breakDurationMinutes > maxAllowedMinutes;
    const excessMinutes = exceededBreak ? breakDurationMinutes - maxAllowedMinutes : 0;

    // Build update data depending on which system the break was started with
    let updateData: Record<string, unknown>;
    let record;

    if (isNewBreakSystem) {
      // New system: set breakEnd, breakDuration, exceededBreak
      updateData = {
        breakEnd: breakEndTime,
        breakDuration: breakDurationMinutes,
        exceededBreak,
        ...(exceededBreak ? {
          notes: existingRecord.notes
            ? `${existingRecord.notes} | Excedió descanso por ${excessMinutes} min (tolerancia: ${toleranceMinutes} min)`
            : `Excedió descanso por ${excessMinutes} min (tolerancia: ${toleranceMinutes} min)`
        } : {}),
      };
    } else {
      // Old system: set both mealEnd and restEnd to the same time, calculate durations
      const mealStart = rec.mealStart as string | null;
      const restStart = rec.restStart as string | null;

      // If meal was started but not ended, end it now
      const mealDuration = mealStart ? Math.floor((now.getTime() - new Date(mealStart).getTime()) / 60000) : 0;
      // If rest was started but not ended, end it now
      const restDuration = restStart ? Math.floor((now.getTime() - new Date(restStart).getTime()) / 60000) : 0;

      // Also set new-system fields for consistency
      updateData = {
        // End old-system fields
        ...(mealStart && !rec.mealEnd ? { mealEnd: breakEndTime, mealDuration, exceededMeal: mealDuration > maxAllowedMinutes } : {}),
        ...(restStart && !rec.restEnd ? { restEnd: breakEndTime, restDuration, exceededRest: restDuration > maxAllowedMinutes } : {}),
        // Set new-system fields for consistency (so future calls use new system)
        breakStart: mealStart || restStart,
        breakEnd: breakEndTime,
        breakDuration: breakDurationMinutes,
        exceededBreak,
        ...(exceededBreak ? {
          notes: existingRecord.notes
            ? `${existingRecord.notes} | Excedió descanso por ${excessMinutes} min (tolerancia: ${toleranceMinutes} min)`
            : `Excedió descanso por ${excessMinutes} min (tolerancia: ${toleranceMinutes} min)`
        } : {}),
      };
    }

    try {
      record = await db.attendanceRecord.update({
        where: { id: existingRecord.id as string },
        data: updateData,
      });
    } catch (updateErr) {
      const errMsg = String(updateErr);
      console.error('[break-end] Update failed:', errMsg);

      if (errMsg.includes('column') || errMsg.includes('42703') || errMsg.includes('does not exist') || errMsg.includes('break_end')) {
        return NextResponse.json({
          error: 'Las columnas de descanso no existen en la base de datos. Agregue las columnas break_end (text), break_duration (integer), exceeded_break (boolean) a la tabla attendance_records.',
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
        error: 'Error al registrar el fin del descanso. Intente de nuevo.',
        details: errMsg,
      }, { status: 500 });
    }

    // Try to create audit log (non-blocking)
    try {
      const emp = existingRecord.employee as Record<string, unknown> | undefined;
      const empName = (emp?.user as Record<string, unknown>)?.name || 'Empleado';
      await createAuditLog(currentUser.id, 'BREAK_END', request, 'ATTENDANCE_RECORD', (record as Record<string, unknown>).id as string, {
        employeeId,
        employeeName: empName,
        breakEndTime,
        breakDuration: breakDurationMinutes,
        exceededBreak,
        excessMinutes,
        toleranceMinutes,
        breakSystem: isNewBreakSystem ? 'new' : 'old',
      });
    } catch (auditErr) {
      console.warn('[break-end] Audit log failed (non-critical):', String(auditErr));
    }

    return NextResponse.json({
      record,
      breakDuration: breakDurationMinutes,
      exceededBreak,
      excessMinutes,
      toleranceMinutes,
      message: exceededBreak
        ? `Descanso terminado. Duración: ${breakDurationMinutes} min. Excedió por ${excessMinutes} min (tolerancia: ${toleranceMinutes} min). Se registró el exceso.`
        : `Descanso terminado. Duración: ${breakDurationMinutes} min. Dentro del tiempo permitido.`
    });
  } catch (error) {
    console.error('[break-end] Unhandled error:', error);
    const errMsg = String(error);

    if (errMsg.includes('JWT') || errMsg.includes('token') || errMsg.includes('auth')) {
      return NextResponse.json({ error: 'Error de autenticación con la base de datos. Contacte al administrador.' }, { status: 503 });
    }

    return NextResponse.json({
      error: 'Error interno del servidor',
      details: errMsg,
    }, { status: 500 });
  }
}
