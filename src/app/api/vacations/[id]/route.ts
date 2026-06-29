// ============================================================
// /api/vacations/[id]
//   PUT    — Aprueba o rechaza una solicitud. Solo ADMIN:
//            SUCURSAL_ADMIN (solo empleados de su sucursal) o
//            GENERAL_ADMIN (cualquiera).
//            Body: { status: 'APPROVED'|'REJECTED', rejectionReason? }
//            - APPROVED: set approvedById, approvedAt; si type=VACACIONES,
//              decrementar employee.vacationBalanceDays por `days`.
//            - REJECTED: set rejectionReason.
//            Log VACATION_APPROVE o VACATION_REJECT audit.
//   DELETE — Cancela una solicitud PENDING. Permitido si:
//            - el solicitante es el currentUser, o
//            - es ADMIN (SUCURSAL_ADMIN solo si el empleado es de su sucursal).
//            Set status=CANCELLED. Log VACATION_CANCEL.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
  isGeneralAdmin,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { emitVacationStatus } from '@/lib/realtime';
import { toISODate } from '@/lib/timezone';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { status, rejectionReason } = body as {
      status?: string;
      rejectionReason?: string | null;
    };

    if (status !== 'APPROVED' && status !== 'REJECTED') {
      return NextResponse.json(
        { error: "status debe ser 'APPROVED' o 'REJECTED'" },
        { status: 400 }
      );
    }
    if (status === 'REJECTED' && !rejectionReason) {
      return NextResponse.json(
        { error: 'rejectionReason es requerido al rechazar' },
        { status: 400 }
      );
    }

    const existing = await db.vacation.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, sucursalId: true, vacationBalanceDays: true },
        },
      },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    // Solo se puede resolver una solicitud PENDING.
    if (existing.status !== 'PENDING') {
      return NextResponse.json(
        {
          error: `La solicitud ya fue procesada (estado actual: ${existing.status})`,
        },
        { status: 409 }
      );
    }

    // SUCURSAL_ADMIN: el empleado debe pertenecer a su sucursal.
    if (!isGeneralAdmin(user)) {
      if (existing.employee.sucursalId !== user.sucursalId) {
        return forbiddenResponse();
      }
    }

    // -----------------------------------------------------
    // Transacción: actualizar Vacation + (opcional) decrementar saldo
    // -----------------------------------------------------
    const vacation = await db.$transaction(async (tx) => {
      if (status === 'APPROVED') {
        // Si es VACACIONES, descontar del saldo del empleado.
        if (existing.type === 'VACACIONES') {
          const newBalance = Math.max(
            0,
            existing.employee.vacationBalanceDays - existing.days
          );
          await tx.employee.update({
            where: { id: existing.employee.id },
            data: { vacationBalanceDays: newBalance },
          });
        }

        return tx.vacation.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedById: user.id,
            approvedAt: new Date(),
            rejectionReason: null,
          },
        });
      }
      // REJECTED
      return tx.vacation.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: rejectionReason ?? null,
        },
      });
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: status === 'APPROVED' ? 'VACATION_APPROVE' : 'VACATION_REJECT',
      entityType: 'VACATION',
      entityId: id,
      sucursalId: existing.employee.sucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: {
        employeeId: existing.employee.id,
        type: existing.type,
        startDate: toISODate(existing.startDate),
        endDate: toISODate(existing.endDate),
        days: existing.days,
        status,
        rejectionReason: rejectionReason ?? null,
        balanceDecremented:
          status === 'APPROVED' && existing.type === 'VACACIONES'
            ? existing.days
            : 0,
      },
    });

    // Emitir evento tiempo real (Socket.io) — no bloquea la respuesta
    emitVacationStatus({
      vacationId: id,
      employeeId: existing.employee.id,
      status,
      approvedBy: user.id,
      sucursalId: existing.employee.sucursalId ?? undefined,
    }).catch(() => {});

    return NextResponse.json({ vacation });
  } catch (error) {
    console.error('PUT /api/vacations/[id] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    const existing = await db.vacation.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, sucursalId: true } },
      },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    // Solo PENDING se puede cancelar.
    if (existing.status !== 'PENDING') {
      return NextResponse.json(
        {
          error: `Solo se pueden cancelar solicitudes PENDING (estado actual: ${existing.status})`,
        },
        { status: 409 }
      );
    }

    // Permisos: solicitante, o ADMIN con scope de sucursal correcto.
    const isRequester = existing.requestedById === user.id;
    let allowedAdmin = false;
    if (isAdmin(user)) {
      if (isGeneralAdmin(user)) {
        allowedAdmin = true;
      } else if (existing.employee.sucursalId === user.sucursalId) {
        allowedAdmin = true;
      }
    }

    if (!isRequester && !allowedAdmin) {
      return forbiddenResponse();
    }

    const vacation = await db.vacation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'VACATION_CANCEL',
      entityType: 'VACATION',
      entityId: id,
      sucursalId: existing.employee.sucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: {
        employeeId: existing.employee.id,
        type: existing.type,
        startDate: toISODate(existing.startDate),
        endDate: toISODate(existing.endDate),
        days: existing.days,
        byAdmin: allowedAdmin && !isRequester,
      },
    });

    return NextResponse.json({ vacation });
  } catch (error) {
    console.error('DELETE /api/vacations/[id] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
