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
import { calculateOvertime, findScheduleForDate, computeWeeklyAccumulatedOvertime } from '@/lib/overtime-calculator';

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
    const { checkInTime, checkOutTime, notes, correctionReason, forceUnlock } = body as {
      checkInTime?: string; // 'HH:mm'
      checkOutTime?: string; // 'HH:mm'
      notes?: string;
      correctionReason?: string;
      forceUnlock?: boolean;
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

    // ----- Reforma LFT 2027 — Inmutabilidad -----
    // Si el registro está bloqueado (default true), exigir motivo de corrección.
    // Solo GENERAL_ADMIN puede forzar desbloqueo; SUCURSAL_ADMIN necesita razón.
    if (record.isLocked && !forceUnlock) {
      return NextResponse.json(
        {
          error:
            'El registro está bloqueado (inmutable). Para corregirlo, proporcione un motivo de corrección y forceUnlock=true.',
          isLocked: true,
        },
        { status: 423 }
      );
    }
    if (record.isLocked && forceUnlock && !correctionReason?.trim()) {
      return NextResponse.json(
        { error: 'Se requiere un motivo de corrección para desbloquear el registro.' },
        { status: 400 }
      );
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

    // Reforma LFT 2027 — calcular acumulado semanal previo
    const weeklyAcc = await computeWeeklyAccumulatedOvertime(
      record.employeeId,
      record.date,
      async (empId, from, to) => {
        return db.attendanceRecord.findMany({
          where: { employeeId: empId, date: { gte: from, lte: to }, id: { not: record.id } },
        });
      }
    );

    const calc = calculateOvertime({
      record: virtualRecord,
      schedule,
      sucursal: { checkoutToleranceMinutes: sucursal.checkoutToleranceMinutes },
      weeklyAccumulatedMinutes: weeklyAcc,
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

    // Reforma LFT 2027 — Preservar valores originales (no sobreescribibles)
    // Si es la primera corrección, guardar el valor original antes de pisarlo.
    const originalCheckInTime = record.originalCheckInTime ?? record.checkInTime ?? null;
    const originalCheckOutTime = record.originalCheckOutTime ?? record.checkOutTime ?? null;

    const updated = await db.attendanceRecord.update({
      where: { id },
      data: {
        ...(newCheckIn
          ? {
              checkInTime: newCheckIn,
              checkInMethod: record.checkInMethod || 'MANUAL',
              checkInIp: ip,
              checkInUserAgent: ua,
              // Preservar original solo la primera vez
              originalCheckInTime,
            }
          : {}),
        ...(newCheckOut
          ? {
              checkOutTime: newCheckOut,
              checkOutMethod: record.checkOutMethod || 'MANUAL',
              checkOutIp: ip,
              checkOutUserAgent: ua,
              // Preservar original solo la primera vez
              originalCheckOutTime,
            }
          : {}),
        ...(notes !== undefined ? { notes } : {}),
        workedMinutes,
        overtimeMinutes: calc.overtimeMinutes,
        // Reforma LFT 2027 — persistir dobles/triples
        overtimeDoubleMinutes: calc.overtimeDoubleMinutes,
        overtimeTripleMinutes: calc.overtimeTripleMinutes,
        overtimeWeeklyAccumulated: calc.overtimeWeeklyAccumulated,
        status: finalStatus,
        justificationStatus: 'PENDING', // corrección manual requiere justificación posterior
        // Reforma LFT 2027 — registrar la corrección
        correctionReason: correctionReason?.trim() || record.correctionReason || null,
        correctedById: user.id,
        correctedAt: new Date(),
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
        originalCheckIn: originalCheckInTime?.toISOString() || null,
        originalCheckOut: originalCheckOutTime?.toISOString() || null,
        newCheckIn: newCheckIn?.toISOString() || null,
        newCheckOut: newCheckOut?.toISOString() || null,
        previousStatus: record.status,
        newStatus: finalStatus,
        workedMinutes,
        overtimeMinutes: calc.overtimeMinutes,
        overtimeDoubleMinutes: calc.overtimeDoubleMinutes,
        overtimeTripleMinutes: calc.overtimeTripleMinutes,
        correctionReason: correctionReason || null,
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
