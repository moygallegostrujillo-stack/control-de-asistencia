// ============================================================
// /api/attendance/[id]
// GET — ADMIN: obtiene detalle del registro (valida sucursal)
// PUT — ADMIN: corrección manual { checkInTime: 'HH:mm', checkOutTime: 'HH:mm', notes }
//        FIX #10: usa buildDateTimeInMexico(toISODate(record.date), 'HH:mm')
//        para construir fechas — NUNCA `new Date('YYYY-MM-DDTHH:mm:ss')` sin TZ
//        Set justificationStatus='PENDING'. Log MANUAL_CORRECTION audit.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import {
  buildDateTimeInMexico,
  toISODate,
  minutesBetween,
} from '@/lib/timezone';
import { calculateOvertime, findScheduleForDate } from '@/lib/overtime-calculator';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { id } = await params;

    const record = await db.attendanceRecord.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            sucursal: { select: { id: true, name: true, codigoLocal: true } },
            workSchedules: true,
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json(
        { error: 'Registro no encontrado' },
        { status: 404 }
      );
    }

    // SUCURSAL_ADMIN: solo su sucursal
    if (
      user.role === 'SUCURSAL_ADMIN' &&
      user.sucursalId !== record.employee.sucursalId
    ) {
      return forbiddenResponse();
    }

    return NextResponse.json({ record });
  } catch (error) {
    console.error('Get attendance record error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { checkInTime, checkOutTime, notes } = body as {
      checkInTime?: string; // 'HH:mm'
      checkOutTime?: string; // 'HH:mm'
      notes?: string;
    };

    // Cargar registro
    const record = await db.attendanceRecord.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            sucursal: true,
            workSchedules: true,
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json(
        { error: 'Registro no encontrado' },
        { status: 404 }
      );
    }

    // Validar sucursal
    if (
      user.role === 'SUCURSAL_ADMIN' &&
      user.sucursalId !== record.employee.sucursalId
    ) {
      return forbiddenResponse();
    }

    // ----- FIX #10 -----
    // Construir fechas SIEMPRE con buildDateTimeInMexico(dateISO, 'HH:mm')
    // Nunca `new Date('YYYY-MM-DDTHH:mm:ss')` (sin TZ specifier)
    const dateISO = toISODate(record.date);

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    let newCheckIn: Date | undefined;
    let newCheckOut: Date | undefined;

    if (checkInTime !== undefined) {
      if (!timeRegex.test(checkInTime)) {
        return NextResponse.json(
          { error: 'Hora de entrada inválida. Use formato HH:mm (ej. 09:00)' },
          { status: 400 }
        );
      }
      // FIX #10 — interpretada como hora local Mexico City
      newCheckIn = buildDateTimeInMexico(dateISO, checkInTime);
    }

    if (checkOutTime !== undefined) {
      if (!timeRegex.test(checkOutTime)) {
        return NextResponse.json(
          { error: 'Hora de salida inválida. Use formato HH:mm (ej. 18:00)' },
          { status: 400 }
        );
      }
      // FIX #10 — interpretada como hora local Mexico City
      newCheckOut = buildDateTimeInMexico(dateISO, checkOutTime);
    }

    // Construir record "virtual" para calculateOvertime
    const virtualRecord = {
      ...record,
      checkInTime: newCheckIn || record.checkInTime,
      checkOutTime: newCheckOut || record.checkOutTime,
      mealStart: record.mealStart,
      mealEnd: record.mealEnd,
      restStart: record.restStart,
      restEnd: record.restEnd,
      date: record.date,
      status: record.status,
    } as any;

    const schedule = findScheduleForDate(
      record.employee.workSchedules,
      record.date
    );
    const sucursal = record.employee.sucursal;

    const calc = calculateOvertime({
      record: virtualRecord,
      schedule,
      sucursal: { checkoutToleranceMinutes: sucursal.checkoutToleranceMinutes },
    });

    // Estado: preservar LATE si ya estaba, sino usar calc
    let finalStatus: 'PRESENT' | 'LATE' | 'EARLY_LEAVE' | 'ABSENT' = calc.status;
    if (record.status === 'LATE' && calc.status === 'PRESENT') {
      finalStatus = 'LATE';
    }

    // Recalcular workedMinutes si ambos timestamps existen
    let workedMinutes = record.workedMinutes;
    if (virtualRecord.checkInTime && virtualRecord.checkOutTime) {
      let net = minutesBetween(
        virtualRecord.checkInTime,
        virtualRecord.checkOutTime
      );
      // Descontar meal/rest completados
      if (record.mealStart && record.mealEnd) {
        net -= minutesBetween(record.mealStart, record.mealEnd);
      }
      if (record.restStart && record.restEnd) {
        net -= minutesBetween(record.restStart, record.restEnd);
      }
      workedMinutes = Math.max(0, net);
    }

    const { ip, ua } = getIpAndUA(req);

    const updated = await db.attendanceRecord.update({
      where: { id },
      data: {
        ...(newCheckIn
          ? {
              checkInTime: newCheckIn,
              checkInMethod: record.checkInMethod || 'MANUAL',
              checkInIp: ip,
              checkInUserAgent: ua,
            }
          : {}),
        ...(newCheckOut
          ? {
              checkOutTime: newCheckOut,
              checkOutMethod: record.checkOutMethod || 'MANUAL',
              checkOutIp: ip,
              checkOutUserAgent: ua,
            }
          : {}),
        ...(notes !== undefined ? { notes } : {}),
        workedMinutes,
        overtimeMinutes: calc.overtimeMinutes,
        status: finalStatus,
        justificationStatus: 'PENDING', // corrección manual requiere justificación posterior
      },
    });

    await auditLog({
      userId: user.id,
      action: 'MANUAL_CORRECTION',
      entityType: 'ATTENDANCE_RECORD',
      entityId: record.id,
      sucursalId: record.employee.sucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: {
        recordId: record.id,
        employeeId: record.employeeId,
        employeeName: record.employee.user.name,
        recordDate: toISODate(record.date),
        previousCheckIn: record.checkInTime?.toISOString() || null,
        previousCheckOut: record.checkOutTime?.toISOString() || null,
        newCheckIn: newCheckIn?.toISOString() || null,
        newCheckOut: newCheckOut?.toISOString() || null,
        previousStatus: record.status,
        newStatus: finalStatus,
        workedMinutes,
        overtimeMinutes: calc.overtimeMinutes,
        notes: notes || null,
        performedBy: user.email,
      },
    });

    return NextResponse.json({
      record: updated,
      message: 'Registro actualizado correctamente',
    });
  } catch (error) {
    console.error('Manual attendance correction error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
