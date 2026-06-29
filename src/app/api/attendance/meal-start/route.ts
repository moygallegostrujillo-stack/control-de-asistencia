// ============================================================
// POST /api/attendance/meal-start
// Inicia el periodo de comida (solo turnos >= 8h)
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
import { emitBreakStart } from '@/lib/realtime';
import { getMexicoTodayDate, getDayOfWeek } from '@/lib/timezone';

const MIN_SHIFT_MINUTES = 8 * 60; // 8 horas

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    const { employeeId: bodyEmployeeId } = body as { employeeId?: string };

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

    const todayDate = getMexicoTodayDate();

    const record = await db.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date: todayDate } },
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
        { error: 'Debe registrar su entrada antes de iniciar la comida' },
        { status: 400 }
      );
    }

    if (record.checkOutTime) {
      return NextResponse.json(
        { error: 'Ya se ha registrado la salida hoy' },
        { status: 400 }
      );
    }

    if (record.mealStart) {
      return NextResponse.json(
        { error: 'Ya se ha iniciado la comida hoy' },
        { status: 409 }
      );
    }

    // SUCURSAL_ADMIN solo puede operar en empleados de su sucursal
    if (
      user.role === 'SUCURSAL_ADMIN' &&
      user.sucursalId !== record.employee.sucursalId
    ) {
      return forbiddenResponse();
    }

    // Validar turno >= 8h
    const dow = getDayOfWeek(todayDate);
    const todaySchedule = record.employee.workSchedules.find(
      (s) => s.dayOfWeek === dow && !s.isWeeklyRest
    );

    if (todaySchedule) {
      const [sh, sm] = todaySchedule.startTime.split(':').map(Number);
      const [eh, em] = todaySchedule.endTime.split(':').map(Number);
      let shiftMinutes = eh * 60 + em - (sh * 60 + sm);
      if (shiftMinutes < 0) shiftMinutes += 24 * 60;
      if (shiftMinutes < MIN_SHIFT_MINUTES) {
        return NextResponse.json(
          {
            error: `La comida solo aplica para turnos de 8 horas o más. Hoy: ${todaySchedule.startTime}–${todaySchedule.endTime} (${Math.floor(
              shiftMinutes / 60
            )}h ${shiftMinutes % 60}m)`,
          },
          { status: 400 }
        );
      }
    }

    const now = new Date();
    const { ip, ua } = getIpAndUA(req);

    const updated = await db.attendanceRecord.update({
      where: { id: record.id },
      data: { mealStart: now },
    });

    await auditLog({
      userId: user.id,
      action: 'MEAL_START',
      entityType: 'ATTENDANCE_RECORD',
      entityId: record.id,
      sucursalId: record.employee.sucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: {
        employeeId,
        employeeName: record.employee.user.name,
        mealStart: now.toISOString(),
        performedBy: user.email,
      },
    });

    // Emitir evento tiempo real (Socket.io) — no bloquea la respuesta
    emitBreakStart({
      employeeId,
      employeeName: record.employee.user.name,
      sucursalId: record.employee.sucursalId,
      time: now.toISOString(),
    }).catch(() => {});

    return NextResponse.json({
      record: updated,
      message: 'Comida iniciada',
    });
  } catch (error) {
    console.error('Meal-start error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
