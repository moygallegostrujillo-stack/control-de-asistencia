// ============================================================
// POST /api/attendance/meal-end
// Termina el periodo de comida. Calcula mealDurationMinutes y mealExceeded.
// mealExceeded = duration > sucursal.mealDurationMinutes + sucursal.mealToleranceMinutes
// (30 min exacto = NO excedido)
// Body: { employeeId? }
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
import { emitBreakEnd } from '@/lib/realtime';
import { getMexicoTodayDate, minutesBetween } from '@/lib/timezone';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    const { employeeId: bodyEmployeeId } = body as { employeeId?: string };

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

    const todayDate = getMexicoTodayDate();

    const record = await db.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: todayDate } },
      include: {
        employee: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            sucursal: true,
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

    if (!record.mealStart) {
      return NextResponse.json(
        { error: 'No se ha iniciado la comida hoy' },
        { status: 400 }
      );
    }

    if (record.mealEnd) {
      return NextResponse.json(
        { error: 'Ya se ha terminado la comida hoy' },
        { status: 409 }
      );
    }

    if (record.checkOutTime) {
      return NextResponse.json(
        { error: 'Ya se ha registrado la salida hoy' },
        { status: 400 }
      );
    }

    if (
      user.role === 'SUCURSAL_ADMIN' &&
      user.sucursalId !== record.employee.sucursalId
    ) {
      return forbiddenResponse();
    }

    const now = new Date();
    const mealDurationMinutes = minutesBetween(record.mealStart, now);
    const sucursal = record.employee.sucursal;
    const maxAllowed =
      (sucursal.mealDurationMinutes || 30) +
      (sucursal.mealToleranceMinutes || 0);
    // 30 min exacto = NO excedido (solo > max)
    const mealExceeded = mealDurationMinutes > maxAllowed;

    const { ip, ua } = getIpAndUA(req);

    const updated = await db.attendanceRecord.update({
      where: { id: record.id },
      data: {
        mealEnd: now,
        mealDurationMinutes,
        mealExceeded,
      },
    });

    await auditLog({
      userId: user.id,
      action: 'MEAL_END',
      entityType: 'ATTENDANCE_RECORD',
      entityId: record.id,
      sucursalId: record.employee.sucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: {
        employeeId,
        employeeName: record.employee.user.name,
        mealEnd: now.toISOString(),
        mealDurationMinutes,
        mealExceeded,
        maxAllowed,
        performedBy: user.email,
      },
    });

    // Emitir evento tiempo real (Socket.io) — no bloquea la respuesta
    emitBreakEnd({
      employeeId,
      employeeName: record.employee.user.name,
      sucursalId: record.employee.sucursalId,
      time: now.toISOString(),
      durationMinutes: mealDurationMinutes,
      exceeded: mealExceeded,
    }).catch(() => {});

    return NextResponse.json({
      record: updated,
      mealDurationMinutes,
      mealExceeded,
      maxAllowed,
      message: mealExceeded
        ? `Comida terminada. Duración ${mealDurationMinutes} min. Excedió por ${
            mealDurationMinutes - maxAllowed
          } min`
        : `Comida terminada. Duración ${mealDurationMinutes} min. Dentro del tiempo permitido`,
    });
  } catch (error) {
    console.error('Meal-end error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
