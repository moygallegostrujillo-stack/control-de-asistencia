import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { getMexicoTodayDate, getMexicoNow } from '@/lib/timezone';

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
    const breakStartTime = now.toISOString();

    // Find today's attendance record — try with include first, fallback to simple query
    let existingRecord: Record<string, unknown> | null = null;
    let workSchedules: Array<{ dayOfWeek: number; startTime: string; endTime: string }> = [];

    try {
      const todayRecords = await db.attendanceRecord.findMany({
        where: { employeeId, date: todayRange },
        include: {
          employee: {
            include: { user: true, workSchedules: true }
          }
        },
        take: 1
      });
      existingRecord = todayRecords[0] || null;

      // Extract workSchedules from the included employee
      if (existingRecord) {
        const emp = existingRecord.employee as Record<string, unknown> | undefined;
        if (emp?.workSchedules && Array.isArray(emp.workSchedules)) {
          workSchedules = emp.workSchedules as Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
        }
      }
    } catch (includeErr) {
      console.warn('[break-start] Complex include failed, trying simple query:', String(includeErr));
      // Fallback: query without include
      try {
        const todayRecordsSimple = await db.attendanceRecord.findMany({
          where: { employeeId, date: todayRange },
          take: 1
        });
        existingRecord = todayRecordsSimple[0] || null;

        // Separately fetch work schedules
        if (existingRecord) {
          try {
            const schedules = await db.workSchedule.findMany({
              where: { employeeId }
            });
            workSchedules = schedules as Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
          } catch {
            // Work schedules not available, break eligibility check will be skipped
          }
        }
      } catch (simpleErr) {
        console.error('[break-start] Simple query also failed:', String(simpleErr));
        return NextResponse.json({
          error: 'No se pudo obtener el registro de asistencia. Intente de nuevo.',
          details: String(simpleErr),
        }, { status: 500 });
      }
    }

    if (!existingRecord) {
      return NextResponse.json({ error: 'No se ha registrado la entrada hoy' }, { status: 404 });
    }

    if (!existingRecord.checkInTime) {
      return NextResponse.json({ error: 'Debe registrar su entrada antes de iniciar el descanso' }, { status: 400 });
    }

    if (existingRecord.checkOutTime) {
      return NextResponse.json({ error: 'Ya se ha registrado la salida hoy, no puede iniciar descanso' }, { status: 400 });
    }

    if (existingRecord.breakStart) {
      return NextResponse.json({ error: 'Ya se ha iniciado un descanso hoy. Solo se permite un descanso por día.' }, { status: 409 });
    }

    // Validate: only allow break for shifts >= 8 hours
    const mexicoNow = getMexicoNow();
    const dayOfWeek = mexicoNow.getDay();
    const todaySchedule = workSchedules.find(s => s.dayOfWeek === dayOfWeek);

    if (todaySchedule) {
      const [startH, startM] = todaySchedule.startTime.split(':').map(Number);
      const [endH, endM] = todaySchedule.endTime.split(':').map(Number);
      const shiftMinutes = (endH * 60 + endM) - (startH * 60 + startM);

      if (shiftMinutes < 480) { // Less than 8 hours
        return NextResponse.json({
          error: `El horario de hoy es de ${todaySchedule.startTime} a ${todaySchedule.endTime} (${shiftMinutes / 60}h). El descanso solo aplica para turnos de 8 horas o más.`
        }, { status: 400 });
      }
    }

    // Record break start
    let record;
    try {
      record = await db.attendanceRecord.update({
        where: { id: existingRecord.id as string },
        data: {
          breakStart: breakStartTime,
        }
      });
    } catch (updateErr) {
      const errMsg = String(updateErr);
      console.error('[break-start] Update failed:', errMsg);

      // Check if it's a column-related error
      if (errMsg.includes('column') || errMsg.includes('42703') || errMsg.includes('does not exist') || errMsg.includes('break_start')) {
        return NextResponse.json({
          error: 'La columna de descanso no existe en la base de datos de producción. Agregue manualmente las columnas break_start (text), break_end (text), break_duration (integer), exceeded_break (boolean default false) a la tabla attendance_records en Supabase.',
          needsMigration: true,
          sql: `ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS break_start TEXT; ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS break_end TEXT; ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS break_duration INTEGER; ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS exceeded_break BOOLEAN DEFAULT false;`,
        }, { status: 503 });
      }

      // Check for RLS or permission errors
      if (errMsg.includes('policy') || errMsg.includes('RLS') || errMsg.includes('permission') || errMsg.includes('denied')) {
        return NextResponse.json({
          error: 'Error de permisos en la base de datos. Verifique que las políticas RLS permitan la actualización de attendance_records.',
          details: errMsg,
        }, { status: 403 });
      }

      return NextResponse.json({
        error: 'Error al registrar el inicio del descanso. Intente de nuevo.',
        details: errMsg,
      }, { status: 500 });
    }

    // Try to create audit log (non-blocking — don't fail the break-start if audit fails)
    try {
      const emp = existingRecord.employee as Record<string, unknown> | undefined;
      const empName = (emp?.user as Record<string, unknown>)?.name || 'Empleado';
      const { ip, ua } = getIpAndUA(request);
      await auditLog({
        userId: currentUser.id,
        action: 'BREAK_START',
        entityType: 'ATTENDANCE_RECORD',
        entityId: (record as Record<string, unknown>).id as string,
        ipAddress: ip,
        userAgent: ua,
        details: {
          employeeId,
          employeeName: empName,
          breakStartTime,
        },
      });
    } catch (auditErr) {
      console.warn('[break-start] Audit log failed (non-critical):', String(auditErr));
    }

    return NextResponse.json({
      record,
      message: 'Descanso iniciado. Debe esperar al menos 30 minutos antes de terminar su descanso.'
    });
  } catch (error) {
    console.error('[break-start] Unhandled error:', error);
    const errMsg = String(error);

    // Check for common Supabase errors
    if (errMsg.includes('JWT') || errMsg.includes('token') || errMsg.includes('auth')) {
      return NextResponse.json({ error: 'Error de autenticación con la base de datos. Contacte al administrador.' }, { status: 503 });
    }

    return NextResponse.json({
      error: 'Error interno del servidor',
      details: errMsg,
    }, { status: 500 });
  }
}
