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
import { emitCheckOut } from '@/lib/realtime';
import { getMexicoTodayDate } from '@/lib/timezone';
import { calculateOvertime, findScheduleForDate } from '@/lib/overtime-calculator';
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

    // fix #2 — calcular workedMinutes, overtimeMinutes, status con tolerancia de salida
    const updatedForCalc = {
      ...record,
      checkOutTime: now,
    } as any;

    const calc = calculateOvertime({
      record: updatedForCalc,
      schedule,
      sucursal: { checkoutToleranceMinutes: sucursal.checkoutToleranceMinutes },
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
        status: finalStatus,
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
        status: finalStatus,
        performedBy: user.email,
      },
    });

    // Emitir evento tiempo real (Socket.io) — no bloquea la respuesta
    emitCheckOut({
      employeeId,
      employeeName: record.employee.user.name,
      employeeNumber: record.employee.employeeNumber,
      sucursalId: record.employee.sucursalId,
      time: now.toISOString(),
      method: checkMethod,
      workedMinutes: calc.workedMinutes,
    }).catch(() => {});

    return NextResponse.json({
      record: updated,
      workedMinutes: calc.workedMinutes,
      overtimeMinutes: calc.overtimeMinutes,
      overtimeHours: calc.overtimeHours,
      status: finalStatus,
    });
  } catch (error) {
    console.error('Check-out error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
