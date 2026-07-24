import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { getMexicoTodayDate, getMexicoNow } from '@/lib/timezone';

// Minimum break duration in minutes (30 min por ley)
const MIN_BREAK_MINUTES = 30;
// Default tolerance in minutes (0 = 30 min es puntual, >30 es exceso)
const DEFAULT_TOLERANCE_MINUTES = 0;

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
    const todayRange = getMexicoTodayDate();
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

    if (!existingRecord.breakStart) {
      return NextResponse.json({ error: 'No se ha iniciado un descanso hoy' }, { status: 400 });
    }

    if (existingRecord.breakEnd) {
      return NextResponse.json({ error: 'Ya se ha terminado el descanso hoy' }, { status: 409 });
    }

    if (existingRecord.checkOutTime) {
      return NextResponse.json({ error: 'Ya se ha registrado la salida hoy' }, { status: 400 });
    }

    // Enforce minimum 30-minute break
    const breakStartDate = new Date(existingRecord.breakStart as string);
    const breakDurationMs = now.getTime() - breakStartDate.getTime();
    const breakDurationMinutes = Math.floor(breakDurationMs / 60000);

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
      // Use default tolerance
    }

    // Calculate if break was exceeded
    const maxAllowedMinutes = MIN_BREAK_MINUTES + toleranceMinutes;
    const exceededBreak = breakDurationMinutes > maxAllowedMinutes;
    const excessMinutes = exceededBreak ? breakDurationMinutes - maxAllowedMinutes : 0;

    // Record break end
    let record;
    try {
      record = await db.attendanceRecord.update({
        where: { id: existingRecord.id as string },
        data: {
          breakEnd: breakEndTime,
          breakDuration: breakDurationMinutes,
          exceededBreak,
          ...(exceededBreak ? {
            notes: existingRecord.notes
              ? `${existingRecord.notes} | Excedió descanso por ${excessMinutes} min (tolerancia: ${toleranceMinutes} min)`
              : `Excedió descanso por ${excessMinutes} min (tolerancia: ${toleranceMinutes} min)`
          } : {}),
        }
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
      const { ip, ua } = getIpAndUA(request);
      await auditLog({
        userId: currentUser.id,
        action: 'BREAK_END',
        entityType: 'ATTENDANCE_RECORD',
        entityId: (record as Record<string, unknown>).id as string,
        ipAddress: ip,
        userAgent: ua,
        details: {
          employeeId,
          employeeName: empName,
          breakEndTime,
          breakDuration: breakDurationMinutes,
          exceededBreak,
          excessMinutes,
          toleranceMinutes,
        },
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
