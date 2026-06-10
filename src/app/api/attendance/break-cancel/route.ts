import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog, getClientIp } from '@/lib/auth';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { getMexicoTodayDate, getMexicoNow, buildTodayDateRange } from '@/lib/timezone';

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

    const todayRange = buildTodayDateRange();

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
      console.warn('[break-cancel] Complex include failed, trying simple query:', String(includeErr));
      try {
        const todayRecordsSimple = await db.attendanceRecord.findMany({
          where: { employeeId, date: todayRange },
          take: 1
        });
        existingRecord = todayRecordsSimple[0] || null;
      } catch (simpleErr) {
        console.error('[break-cancel] Simple query also failed:', String(simpleErr));
        return NextResponse.json({
          error: 'No se pudo obtener el registro de asistencia. Intente de nuevo.',
          details: String(simpleErr),
        }, { status: 500 });
      }
    }

    if (!existingRecord) {
      return NextResponse.json({ error: 'No se ha registrado la entrada hoy' }, { status: 404 });
    }

    const rec = existingRecord as Record<string, unknown>;
    const isNewBreakSystem = !!rec.breakStart && !rec.breakEnd;
    const isOldBreakSystem = !rec.breakStart && (!!rec.mealStart || !!rec.restStart) && !((!!rec.mealStart && !!rec.mealEnd) && (!!rec.restStart && !!rec.restEnd));

    if (!isNewBreakSystem && !isOldBreakSystem) {
      return NextResponse.json({ error: 'No hay un descanso activo para cancelar' }, { status: 400 });
    }

    if (existingRecord.checkOutTime) {
      return NextResponse.json({ error: 'Ya se ha registrado la salida hoy' }, { status: 400 });
    }

    // Determine effective break start for elapsed time calculation
    const effectiveBreakStart = (rec.breakStart || rec.mealStart || rec.restStart) as string;
    const breakStartDate = new Date(effectiveBreakStart);
    const elapsedMinutes = Math.floor((Date.now() - breakStartDate.getTime()) / 60000);

    // Build update data to cancel the break
    let updateData: Record<string, unknown>;

    if (isNewBreakSystem) {
      // New system: clear breakStart
      updateData = {
        breakStart: null,
      };
    } else {
      // Old system: clear mealStart/restStart and their end/duration fields
      updateData = {
        ...(rec.mealStart && !rec.mealEnd ? { mealStart: null } : {}),
        ...(rec.restStart && !rec.restEnd ? { restStart: null } : {}),
      };
    }

    let record;
    try {
      record = await db.attendanceRecord.update({
        where: { id: existingRecord.id as string },
        data: updateData,
      });
    } catch (updateErr) {
      const errMsg = String(updateErr);
      console.error('[break-cancel] Update failed:', errMsg);

      if (errMsg.includes('column') || errMsg.includes('42703') || errMsg.includes('does not exist')) {
        return NextResponse.json({
          error: 'Error en la base de datos. Contacte al administrador.',
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
        error: 'Error al cancelar el descanso. Intente de nuevo.',
        details: errMsg,
      }, { status: 500 });
    }

    // Create audit log (non-blocking)
    try {
      const emp = existingRecord.employee as Record<string, unknown> | undefined;
      const empName = (emp?.user as Record<string, unknown>)?.name || 'Empleado';
      await createAuditLog(currentUser.id, 'BREAK_CANCEL', request, 'ATTENDANCE_RECORD', (record as Record<string, unknown>).id as string, {
        employeeId,
        employeeName: empName,
        cancelledBreakStart: effectiveBreakStart,
        elapsedMinutes,
        breakSystem: isNewBreakSystem ? 'new' : 'old',
        reason: 'Cancelado por el empleado',
      });
    } catch (auditErr) {
      console.warn('[break-cancel] Audit log failed (non-critical):', String(auditErr));
    }

    return NextResponse.json({
      record,
      message: `Descanso cancelado. Había transcurrido ${elapsedMinutes} minuto(s). Puede iniciar su descanso nuevamente cuando lo desee.`,
      elapsedMinutes,
    });
  } catch (error) {
    console.error('[break-cancel] Unhandled error:', error);
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
