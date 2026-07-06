// ============================================================
// POST /api/attendance/break-cancel
// Legacy alias for /api/attendance/meal-cancel.
// If meal in progress (mealStart set, mealEnd null), cancel it.
// Otherwise, if rest in progress (restStart set, restEnd null), cancel it.
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

    // Determinar qué descanso está en curso
    const mealInProgress = !!record.mealStart && !record.mealEnd;
    const restInProgress = !!record.restStart && !record.restEnd;

    if (!mealInProgress && !restInProgress) {
      return NextResponse.json(
        { error: 'No hay un descanso en curso para cancelar' },
        { status: 400 }
      );
    }

    const now = new Date();
    const sucursal = record.employee.sucursal;
    const { ip, ua } = getIpAndUA(req);

    let cancelledType: 'MEAL' | 'REST' = 'MEAL';
    let durationMinutes = 0;
    let exceeded = false;
    let maxAllowed = 0;

    const updateData: Record<string, unknown> = {};

    if (mealInProgress) {
      cancelledType = 'MEAL';
      durationMinutes = minutesBetween(record.mealStart!, now);
      maxAllowed =
        (sucursal.mealDurationMinutes || 30) +
        (sucursal.mealToleranceMinutes || 0);
      exceeded = durationMinutes > maxAllowed;
      updateData.mealEnd = now;
      updateData.mealDurationMinutes = durationMinutes;
      updateData.mealExceeded = exceeded;
    } else if (restInProgress) {
      cancelledType = 'REST';
      durationMinutes = minutesBetween(record.restStart!, now);
      maxAllowed =
        (sucursal.restDurationMinutes || 15) +
        (sucursal.restToleranceMinutes || 0);
      exceeded = durationMinutes > maxAllowed;
      updateData.restEnd = now;
      updateData.restDurationMinutes = durationMinutes;
      updateData.restExceeded = exceeded;
    }

    const updated = await db.attendanceRecord.update({
      where: { id: record.id },
      data: updateData,
    });

    await auditLog({
      userId: user.id,
      action: cancelledType === 'MEAL' ? 'MEAL_CANCEL' : 'REST_CANCEL',
      entityType: 'ATTENDANCE_RECORD',
      entityId: record.id,
      sucursalId: record.employee.sucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: {
        employeeId,
        employeeName: record.employee.user.name,
        cancelledAt: now.toISOString(),
        cancelledType,
        durationMinutes,
        exceeded,
        maxAllowed,
        legacyEndpoint: 'break-cancel',
        performedBy: user.email,
      },
    });

    return NextResponse.json({
      record: updated,
      cancelledType,
      durationMinutes,
      exceeded,
      message: `Descanso (${cancelledType}) cancelado. Duración registrada: ${durationMinutes} min`,
    });
  } catch (error) {
    console.error('Break-cancel (legacy) error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
