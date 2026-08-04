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
//   PATCH  — Edita fechas/tipo/motivo de un registro existente. Solo ADMIN.
//            Body: { startDate?, endDate?, type?, reason? }
//            Permite corregir errores de captura en registros ya aprobados
//            (caso típico: incapacidad con fechas equivocadas).
//            Si type=VACACIONES y los días cambian, reajusta el saldo.
//            Log VACATION_EDIT audit.
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
import { toISODate, buildDateTimeInMexico } from '@/lib/timezone';

const VALID_TYPES = new Set([
  'VACACIONES',
  'PERMISO',
  'INCAPACIDAD',
  'MATERNIDAD',
  'PATERNIDAD',
  'OTRO',
]);

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

// ============================================================
// PATCH /api/vacations/[id]
// Edita campos de un Vacation existente. Solo ADMIN.
// Body: { startDate?, endDate?, type?, reason? }
//
// Permite corregir errores de captura en registros ya aprobados
// (caso típico: incapacidad de maternidad con fechas equivocadas).
//
// Reglas:
//   - SUCURSAL_ADMIN: solo registros de empleados de su sucursal.
//   - GENERAL_ADMIN: cualquiera.
//   - No se puede editar un registro CANCELLED.
//   - Las fechas se interpretan como hora de México (buildDateTimeInMexico).
//   - Si type=VACACIONES y los días cambian, se reajusta el saldo:
//       * Si antes estaba APPROVED y se descuentó saldo, se devuelve
//         el saldo viejo y se descuenta el nuevo.
//       * Si antes estaba PENDING (saldo no descontado), solo se
//         actualiza el campo `days` para cuando se apruebe.
//   - Log VACATION_EDIT audit con before/after.
// ============================================================
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { startDate, endDate, type, reason } = body as {
      startDate?: string; // "YYYY-MM-DD"
      endDate?: string; // "YYYY-MM-DD"
      type?: string;
      reason?: string | null;
    };

    // Validar tipo si se provee.
    if (type !== undefined && !VALID_TYPES.has(type)) {
      return NextResponse.json(
        { error: `Tipo inválido. Válidos: ${[...VALID_TYPES].join(', ')}` },
        { status: 400 }
      );
    }

    // Cargar registro existente.
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
        { error: 'Registro no encontrado' },
        { status: 404 }
      );
    }

    // No editar registros cancelados.
    if (existing.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'No se puede editar un registro cancelado' },
        { status: 409 }
      );
    }

    // SUCURSAL_ADMIN: solo su sucursal.
    if (!isGeneralAdmin(user)) {
      if (existing.employee.sucursalId !== user.sucursalId) {
        return forbiddenResponse();
      }
    }

    // -----------------------------------------------------
    // Parsear nuevas fechas (si se proveen) en hora de México.
    // -----------------------------------------------------
    let newStart: Date | undefined;
    let newEnd: Date | undefined;
    if (startDate !== undefined) {
      try {
        newStart = buildDateTimeInMexico(startDate, '00:00');
      } catch {
        return NextResponse.json(
          { error: 'startDate inválido (usar YYYY-MM-DD)' },
          { status: 400 }
        );
      }
    }
    if (endDate !== undefined) {
      try {
        newEnd = buildDateTimeInMexico(endDate, '00:00');
      } catch {
        return NextResponse.json(
          { error: 'endDate inválido (usar YYYY-MM-DD)' },
          { status: 400 }
        );
      }
    }

    // Determinar fechas efectivas (viejas o nuevas).
    const effectiveStart = newStart ?? existing.startDate;
    const effectiveEnd = newEnd ?? existing.endDate;

    if (effectiveStart > effectiveEnd) {
      return NextResponse.json(
        { error: 'La fecha de inicio no puede ser posterior a la de fin' },
        { status: 400 }
      );
    }

    // Recalcular días naturales.
    const newDays =
      Math.ceil(
        (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;

    if (newDays <= 0) {
      return NextResponse.json(
        { error: 'El rango de fechas debe ser de al menos 1 día' },
        { status: 400 }
      );
    }

    // Determinar type efectivo.
    const effectiveType = type ?? existing.type;

    // -----------------------------------------------------
    // Transacción: actualizar Vacation + reajustar saldo si aplica.
    // -----------------------------------------------------
    const vacation = await db.$transaction(async (tx) => {
      // Si el registro estaba APPROVED, type era VACACIONES, y los días
      // cambiaron, hay que reajustar el saldo del empleado.
      const wasApprovedVacation =
        existing.status === 'APPROVED' &&
        existing.type === 'VACACIONES' &&
        !existing.isPartial;

      const willBeApprovedVacation =
        existing.status === 'APPROVED' &&
        effectiveType === 'VACACIONES' &&
        !existing.isPartial;

      if (wasApprovedVacation || willBeApprovedVacation) {
        // Recargar saldo actual del empleado.
        const emp = await tx.employee.findUnique({
          where: { id: existing.employee.id },
          select: { vacationBalanceDays: true },
        });
        if (!emp) throw new Error('Empleado no encontrado');

        let balanceAdjustment = 0;
        // Devolver días viejos si antes descontó.
        if (wasApprovedVacation) {
          balanceAdjustment += existing.days;
        }
        // Descontar días nuevos si sigue siendo VACACIONES aprobada.
        if (willBeApprovedVacation) {
          balanceAdjustment -= newDays;
        }
        const newBalance = Math.max(0, emp.vacationBalanceDays + balanceAdjustment);
        await tx.employee.update({
          where: { id: existing.employee.id },
          data: { vacationBalanceDays: newBalance },
        });
      }

      const data: Record<string, unknown> = { days: newDays };
      if (newStart) data.startDate = newStart;
      if (newEnd) data.endDate = newEnd;
      if (type !== undefined) data.type = type;
      if (reason !== undefined) data.reason = reason ?? null;

      return tx.vacation.update({
        where: { id },
        data,
        include: {
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { id: true, name: true } },
              sucursal: { select: { id: true, name: true } },
            },
          },
        },
      });
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'VACATION_EDIT',
      entityType: 'VACATION',
      entityId: id,
      sucursalId: existing.employee.sucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: {
        employeeId: existing.employee.id,
        employeeName: vacation.employee.user.name,
        performedBy: user.email,
        before: {
          type: existing.type,
          startDate: toISODate(existing.startDate),
          endDate: toISODate(existing.endDate),
          days: existing.days,
          reason: existing.reason,
        },
        after: {
          type: effectiveType,
          startDate: toISODate(effectiveStart),
          endDate: toISODate(effectiveEnd),
          days: newDays,
          reason: reason !== undefined ? (reason ?? null) : existing.reason,
        },
        balanceAdjusted:
          existing.status === 'APPROVED' &&
          (existing.type === 'VACACIONES' || effectiveType === 'VACACIONES') &&
          !existing.isPartial,
      },
    });

    return NextResponse.json({ vacation });
  } catch (error) {
    console.error('PATCH /api/vacations/[id] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
