import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog, getClientIp } from '@/lib/auth';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { getMexicoTodayDate, getMexicoNow, buildTodayDateRange } from '@/lib/timezone';

// Minimum meal (comida) duration in minutes for 8h shifts
const MIN_MEAL_MINUTES = 15;

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
    const mealStartTime = now.toISOString();

    // Find today's attendance record
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

      if (existingRecord) {
        const emp = existingRecord.employee as Record<string, unknown> | undefined;
        if (emp?.workSchedules && Array.isArray(emp.workSchedules)) {
          workSchedules = emp.workSchedules as Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
        }
      }
    } catch (includeErr) {
      console.warn('[meal-start] Complex include failed, trying simple query:', String(includeErr));
      try {
        const todayRecords = await db.attendanceRecord.findMany({
          where: { employeeId, date: todayRange },
          take: 1
        });
        existingRecord = todayRecords[0] || null;

        if (existingRecord) {
          try {
            const schedules = await db.workSchedule.findMany({
              where: { employeeId }
            });
            workSchedules = schedules as Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
          } catch {
            // Work schedules not available
          }
        }
      } catch (simpleErr) {
        console.error('[meal-start] Simple query also failed:', String(simpleErr));
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
      return NextResponse.json({ error: 'Debe registrar su entrada antes de iniciar la comida' }, { status: 400 });
    }

    if (existingRecord.checkOutTime) {
      return NextResponse.json({ error: 'Ya se ha registrado la salida hoy, no puede iniciar comida' }, { status: 400 });
    }

    if (existingRecord.mealStart) {
      return NextResponse.json({ error: 'Ya se ha iniciado la comida hoy. Solo se permite una comida por día.' }, { status: 409 });
    }

    // Check if currently on descanso — can't start comida while on descanso
    if (existingRecord.restStart && !existingRecord.restEnd) {
      return NextResponse.json({ error: 'Actualmente está en descanso. Termine el descanso antes de iniciar la comida.' }, { status: 400 });
    }

    // Validate: only allow meal for shifts >= 8 hours
    const mexicoNow = getMexicoNow();
    const dayOfWeek = mexicoNow.getDay();
    const todaySchedule = workSchedules.find(s => s.dayOfWeek === dayOfWeek);

    if (todaySchedule) {
      const [startH, startM] = todaySchedule.startTime.split(':').map(Number);
      const [endH, endM] = todaySchedule.endTime.split(':').map(Number);
      const shiftMinutes = (endH * 60 + endM) - (startH * 60 + startM);

      if (shiftMinutes < 480) {
        return NextResponse.json({
          error: `El horario de hoy es de ${todaySchedule.startTime} a ${todaySchedule.endTime} (${shiftMinutes / 60}h). La comida solo aplica para turnos de 8 horas o más.`
        }, { status: 400 });
      }
    }

    // Record meal start
    let record;
    try {
      record = await db.attendanceRecord.update({
        where: { id: existingRecord.id as string },
        data: {
          mealStart: mealStartTime,
        }
      });
    } catch (updateErr) {
      const errMsg = String(updateErr);
      console.error('[meal-start] Update failed:', errMsg);

      if (errMsg.includes('column') || errMsg.includes('42703') || errMsg.includes('does not exist') || errMsg.includes('meal_start')) {
        return NextResponse.json({
          error: 'Las columnas de comida no existen en la base de datos. Agregue: meal_start (text), meal_end (text), meal_duration (integer), exceeded_meal (boolean default false) a la tabla attendance_records.',
          needsMigration: true,
          sql: `ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS meal_start TEXT; ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS meal_end TEXT; ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS meal_duration INTEGER; ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS exceeded_meal BOOLEAN DEFAULT false;`,
        }, { status: 503 });
      }

      if (errMsg.includes('policy') || errMsg.includes('RLS') || errMsg.includes('permission') || errMsg.includes('denied')) {
        return NextResponse.json({
          error: 'Error de permisos en la base de datos. Verifique las políticas RLS.',
          details: errMsg,
        }, { status: 403 });
      }

      return NextResponse.json({
        error: 'Error al registrar el inicio de la comida. Intente de nuevo.',
        details: errMsg,
      }, { status: 500 });
    }

    // Audit log (non-blocking)
    try {
      const emp = existingRecord.employee as Record<string, unknown> | undefined;
      const empName = (emp?.user as Record<string, unknown>)?.name || 'Empleado';
      await createAuditLog(currentUser.id, 'MEAL_START', request, 'ATTENDANCE_RECORD', (record as Record<string, unknown>).id as string, {
        employeeId,
        employeeName: empName,
        mealStartTime,
      });
    } catch (auditErr) {
      console.warn('[meal-start] Audit log failed (non-critical):', String(auditErr));
    }

    return NextResponse.json({
      record,
      message: `Comida iniciada. Debe esperar al menos ${MIN_MEAL_MINUTES} minutos antes de terminar su comida.`
    });
  } catch (error) {
    console.error('[meal-start] Unhandled error:', error);
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
