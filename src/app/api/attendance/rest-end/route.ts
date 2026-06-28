// ============================================================
// POST /api/attendance/rest-end
// Termina el descanso. Calcula restDurationMinutes y restExceeded.
// restExceeded = duration > 15 + sucursal.restToleranceMinutes
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

    if (!record.restStart) {
      return NextResponse.json(
        { error: 'No se ha iniciado el descanso hoy' },
        { status: 400 }
      );
    }

    if (record.restEnd) {
      return NextResponse.json(
        { error: 'Ya se ha terminado el descanso hoy' },
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
    const restDurationMinutes = minutesBetween(record.restStart, now);
    const sucursal = record.employee.sucursal;
    const maxAllowed =
      (sucursal.restDurationMinutes || 15) +
      (sucursal.restToleranceMinutes || 0);
    const restExceeded = restDurationMinutes > maxAllowed;

    const { ip, ua } = getIpAndUA(req);

    const updated = await db.attendanceRecord.update({
      where: { id: record.id },
      data: {
        restEnd: now,
        restDurationMinutes,
        restExceeded,
      },
    });

    await auditLog({
      userId: user.id,
      action: 'REST_END',
      entityType: 'ATTENDANCE_RECORD',
      entityId: record.id,
      sucursalId: record.employee.sucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: {
        employeeId,
        employeeName: record.employee.user.name,
        restEnd: now.toISOString(),
        restDurationMinutes,
        restExceeded,
        maxAllowed,
        performedBy: user.email,
      },
    });

    return NextResponse.json({
      record: updated,
      restDurationMinutes,
      restExceeded,
      maxAllowed,
      message: restExceeded
        ? `Descanso terminado. Duración ${restDurationMinutes} min. Excedió por ${
            restDurationMinutes - maxAllowed
          } min`
        : `Descanso terminado. Duración ${restDurationMinutes} min. Dentro del tiempo permitido`,
    });
  } catch (error) {
    console.error('Rest-end error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
