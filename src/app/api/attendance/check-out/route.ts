// ============================================================
// POST /api/attendance/check-out
// Registra la salida del empleado
// Body: { lat, long, method, qrCode?, employeeId? }
// fix #2 — usa calculateOvertime con sucursal.checkoutToleranceMinutes
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
import { getMexicoTodayDate } from '@/lib/timezone';
import { calculateOvertime, findScheduleForDate, computeWeeklyAccumulatedOvertime, getWeeklyOvertimeCapMinutes } from '@/lib/overtime-calculator';
import { validateQRToken, validateStaticEmployeeQR } from '@/lib/qr';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    const { lat, long, method, qrCode, employeeId: bodyEmployeeId } = body as {
      lat?: number;
      long?: number;
      method?: 'GPS' | 'QR';
      qrCode?: string;
      employeeId?: string;
    };

    // Resolver employeeId
    let employeeId: string | undefined;
    if (bodyEmployeeId) {
      if (!isAdmin(user)) return forbiddenResponse();
      employeeId = bodyEmployeeId;
    } else if (user.role === 'EMPLOYEE' && user.employeeId) {
      employeeId = user.employeeId;
    }

    if (!employeeId) {
      return NextResponse.json(
        { error: 'ID de empleado es requerido' },
        { status: 400 }
      );
    }

    const checkMethod = method === 'QR' ? 'QR' : 'GPS';

    // Validar QR si aplica
    if (checkMethod === 'QR' && qrCode) {
      const dyn = validateQRToken(qrCode);
      if (!dyn.valid) {
        const stat = validateStaticEmployeeQR(qrCode);
        if (!stat.valid) {
          return NextResponse.json(
            { error: dyn.reason || 'Código QR inválido' },
            { status: 400 }
          );
        }
      }
    }

    const todayDate = getMexicoTodayDate();

    // Cargar registro + empleado + sucursal + schedules
    const record = await db.attendanceRecord.findUnique({
      where: {
        employeeId_date: { employeeId, date: todayDate },
      },
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
        { error: 'No se ha registrado la entrada hoy' },
        { status: 404 }
      );
    }

    if (!record.checkInTime) {
      return NextResponse.json(
        { error: 'Debe registrar la entrada antes de la salida' },
        { status: 400 }
      );
    }

    if (record.checkOutTime) {
      return NextResponse.json(
        { error: 'Ya se ha registrado la salida hoy', record },
        { status: 409 }
      );
    }

    // SUCURSAL_ADMIN solo puede registrar salida de empleados de su sucursal
    if (
      user.role === 'SUCURSAL_ADMIN' &&
      user.sucursalId !== record.employee.sucursalId
    ) {
      return forbiddenResponse();
    }

    const now = new Date();
    const sucursal = record.employee.sucursal;
    const schedule = findScheduleForDate(record.employee.workSchedules, record.date);

    // Reforma LFT 2027 — calcular acumulado semanal previo (lun..ayer) para
    // distribuir correctamente horas extra dobles vs triples.
    const weeklyAcc = await computeWeeklyAccumulatedOvertime(
      employeeId,
      todayDate,
      async (empId, from, to) => {
        return db.attendanceRecord.findMany({
          where: { employeeId: empId, date: { gte: from, lte: to } },
        });
      }
    );

    // fix #2 + reforma LFT 2027 — calcular workedMinutes, overtimeMinutes,
    // dobles/triples y status con tolerancia de salida.
    const updatedForCalc = {
      ...record,
      checkOutTime: now,
    } as any;

    const calc = calculateOvertime({
      record: updatedForCalc,
      schedule,
      sucursal: { checkoutToleranceMinutes: sucursal.checkoutToleranceMinutes },
      weeklyAccumulatedMinutes: weeklyAcc,
    });

    const { ip, ua } = getIpAndUA(req);

    // Determinar status final preservando LATE si ya estaba
    let finalStatus: 'PRESENT' | 'LATE' | 'EARLY_LEAVE';
    if (record.status === 'LATE') {
      finalStatus = 'LATE';
    } else if (calc.isEarlyLeave) {
      finalStatus = 'EARLY_LEAVE';
    } else if (calc.isLate) {
      finalStatus = 'LATE';
    } else {
      finalStatus = 'PRESENT';
    }

    const updated = await db.attendanceRecord.update({
      where: { id: record.id },
      data: {
        checkOutTime: now,
        checkOutLat: typeof lat === 'number' ? lat : null,
        checkOutLong: typeof long === 'number' ? long : null,
        checkOutMethod: checkMethod,
        checkOutIp: ip,
        checkOutUserAgent: ua,
        workedMinutes: calc.workedMinutes,
        overtimeMinutes: calc.overtimeMinutes,
        // Reforma LFT 2027 — persistir dobles/triples y acumulado semanal
        overtimeDoubleMinutes: calc.overtimeDoubleMinutes,
        overtimeTripleMinutes: calc.overtimeTripleMinutes,
        overtimeWeeklyAccumulated: calc.overtimeWeeklyAccumulated,
        // Prima por descanso trabajado (art. 73 LFT) — persistir minutos y prima del 100%
        isRestDayWorked: calc.isRestDayWorked,
        restDayWorkedMinutes: calc.restDayWorkedMinutes || null,
        restDayPremiumMinutes: calc.restDayPremiumMinutes || null,
        isSunday: calc.isSunday,
        status: finalStatus,
        // Jornada nocturna / mixta (art. 60 y 61 LFT) — clasificación al check-out.
        shiftType: calc.shiftType,
        nightMinutes: calc.nightMinutes,
      },
    });

    await auditLog({
      userId: user.id,
      action: 'CHECK_OUT',
      entityType: 'ATTENDANCE_RECORD',
      entityId: updated.id,
      sucursalId: record.employee.sucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: {
        employeeId,
        employeeName: record.employee.user.name,
        checkOutTime: now.toISOString(),
        method: checkMethod,
        lat,
        long,
        workedMinutes: calc.workedMinutes,
        overtimeMinutes: calc.overtimeMinutes,
        overtimeDoubleMinutes: calc.overtimeDoubleMinutes,
        overtimeTripleMinutes: calc.overtimeTripleMinutes,
        overtimeWeeklyAccumulated: calc.overtimeWeeklyAccumulated,
        overtimeWeeklyTotal: calc.overtimeWeeklyTotal,
        // Prima por descanso trabajado (art. 73 LFT)
        isRestDayWorked: calc.isRestDayWorked,
        restDayWorkedMinutes: calc.restDayWorkedMinutes,
        restDayPremiumMinutes: calc.restDayPremiumMinutes,
        isSunday: calc.isSunday,
        status: finalStatus,
        performedBy: user.email,
        // Jornada nocturna / mixta (art. 60 y 61 LFT) — evidencia para nómina y prima nocturna.
        shiftType: calc.shiftType,
        nightMinutes: calc.nightMinutes,
        legalMaxMinutes: calc.legalMaxMinutes,
        legalOvertimeMinutes: calc.legalOvertimeMinutes,
        nightPremiumNote: (calc.shiftType === 'NOCTURNA' || calc.shiftType === 'MIXTA') && calc.nightMinutes > 0
          ? `Jornada ${calc.shiftType}: ${Math.round(calc.nightMinutes)} min nocturnos. Aplica prima nocturna 25% (art. 61 LFT + jurisprudencia) — calculada por nómina.`
          : undefined,
      },
    });

    // --- NOM-035 — Alerta automática al trabajar en día de descanso (art. 73 LFT) ---
    // Registramos una alerta NOM-035 para evidencia y para que aparezca en el badge
    // de notificaciones del admin. La prima del 100% ya quedó persistida arriba.
    if (calc.isRestDayWorked && (calc.restDayWorkedMinutes || 0) > 0) {
      await auditLog({
        userId: user.id,
        action: 'NOM035_ALERT_REST_DAY_WORKED',
        entityType: 'ATTENDANCE_RECORD',
        entityId: updated.id,
        sucursalId: record.employee.sucursalId,
        ipAddress: ip,
        userAgent: ua,
        details: {
          employeeId,
          employeeName: record.employee.user.name,
          employeeNumber: record.employee.employeeNumber,
          restDayWorkedMinutes: calc.restDayWorkedMinutes,
          restDayPremiumMinutes: calc.restDayPremiumMinutes,
          isSunday: calc.isSunday,
          alertLevel: calc.isSunday ? 'HIGH' : 'MEDIUM', // domingo = mayor riesgo
          legalReference: 'LFT art. 73 (prima del 100% por descanso trabajado); art. 71 (prima dominical)',
          triggeredBy: 'CHECK_OUT',
          recommendation: 'Pagar jornada completa con prima del 100% adicional (art. 73 LFT). Si fue domingo, también aplica prima dominical (art. 71).',
        },
      }).catch(() => {}); // no bloquear el checkout si falla el log
    }

    // --- NOM-035 — Alerta automática al cruzar el tope semanal de horas extra ---
    // Si este checkout hizo que el acumulado semanal del empleado supere el tope
    // (9h en 2027, escalando a 12h en 2030 per Transitorio Cuarto DOF 1-may-2026),
    // registramos una alerta NOM-035 en el audit log para evidencia y para que
    // aparezca en el badge de notificaciones del admin.
    const weeklyCap = getWeeklyOvertimeCapMinutes(now.getFullYear());
    if (calc.overtimeWeeklyTotal > weeklyCap && calc.overtimeTripleMinutes > 0) {
      const excessMinutes = calc.overtimeWeeklyTotal - weeklyCap;
      await auditLog({
        userId: user.id,
        action: 'NOM035_ALERT_WEEKLY_OVERTIME',
        entityType: 'ATTENDANCE_RECORD',
        entityId: updated.id,
        sucursalId: record.employee.sucursalId,
        ipAddress: ip,
        userAgent: ua,
        details: {
          employeeId,
          employeeName: record.employee.user.name,
          employeeNumber: record.employee.employeeNumber,
          weeklyOvertimeMinutes: calc.overtimeWeeklyTotal,
          weeklyOvertimeCapMinutes: weeklyCap,
          excessMinutes,
          tripleMinutes: calc.overtimeTripleMinutes,
          doubleMinutes: calc.overtimeDoubleMinutes,
          alertLevel: excessMinutes > 180 ? 'HIGH' : 'MEDIUM', // >3h exceso = HIGH
          legalReference: 'LFT art. 66/68 + Transitorio Cuarto DOF 1-may-2026; NOM-035-STPS-2018 A.5',
          triggeredBy: 'CHECK_OUT',
        },
      }).catch(() => {}); // no bloquear el checkout si falla el log
    }

    return NextResponse.json({
      record: updated,
      workedMinutes: calc.workedMinutes,
      overtimeMinutes: calc.overtimeMinutes,
      overtimeHours: calc.overtimeHours,
      overtimeDoubleMinutes: calc.overtimeDoubleMinutes,
      overtimeTripleMinutes: calc.overtimeTripleMinutes,
      overtimeWeeklyAccumulated: calc.overtimeWeeklyAccumulated,
      overtimeWeeklyTotal: calc.overtimeWeeklyTotal,
      // Prima por descanso trabajado (art. 73 LFT)
      isRestDayWorked: calc.isRestDayWorked,
      restDayWorkedMinutes: calc.restDayWorkedMinutes,
      restDayPremiumMinutes: calc.restDayPremiumMinutes,
      isSunday: calc.isSunday,
      status: finalStatus,
      // Jornada nocturna / mixta (art. 60 y 61 LFT)
      shiftType: calc.shiftType,
      nightMinutes: calc.nightMinutes,
      legalMaxMinutes: calc.legalMaxMinutes,
      legalOvertimeMinutes: calc.legalOvertimeMinutes,
    });
  } catch (error) {
    console.error('Check-out error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
