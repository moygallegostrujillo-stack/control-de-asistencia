// ============================================================
// /api/vacations
//   GET — Lista de vacaciones/permisos con filtros opcionales:
//         ?status=&employeeId=&startDate=&endDate=&type=
//         - EMPLOYEE: solo las suyas.
//         - SUCURSAL_ADMIN: solo de empleados de su sucursal.
//         - GENERAL_ADMIN: todas.
//         Incluye employee.user.name y employee.sucursal.
//   POST — Cualquier usuario autenticado puede crear una
//          solicitud { employeeId, type, startDate, endDate, reason? }.
//          EMPLOYEE solo puede crear para sí mismo. Calcula `days`
//          = nº de días naturales entre startDate y endDate inclusive.
//          Log VACATION_REQUEST audit.
//
//          ADMIN puede "otorgar" directamente pasando grantMode:
//            ADMIN_GRANTED  → la solicitud nace APPROVED y, si type=VACACIONES
//                             y no es parcial, descuenta automáticamente los
//                             días del saldo (vacationBalanceDays).
//            EMPLOYEE_REQUEST (default) → nace PENDING, requiere aprobación.
//          Los permisos pariales (isPartial=true con startTime/endTime)
//          NO descuentan saldo (art. 76 LFT se aplica solo a vacaciones
//          completas por día natural).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
  type AuthUser,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { emitVacationRequested } from '@/lib/realtime';
import { toISODate } from '@/lib/timezone';

const VALID_TYPES = new Set([
  'VACACIONES',
  'PERMISO',
  'INCAPACIDAD',
  'MATERNIDAD',
  'PATERNIDAD',
  'OTRO',
]);

/**
 * Devuelve el filtro de `where` para acotar vacaciones según el rol
 * del usuario. EMPLOYEE: solo las suyas; SUCURSAL_ADMIN: solo su
 * sucursal; GENERAL_ADMIN: todas.
 */
function buildScopeFilter(user: AuthUser) {
  if (user.role === 'GENERAL_ADMIN') {
    return {}; // sin filtro
  }
  if (user.role === 'SUCURSAL_ADMIN') {
    return { employee: { sucursalId: user.sucursalId ?? '__NONE__' } };
  }
  // EMPLOYEE
  if (user.employeeId) {
    return { employeeId: user.employeeId };
  }
  return { employeeId: '__NONE__' };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status')?.trim();
    const employeeId = searchParams.get('employeeId')?.trim();
    const startDate = searchParams.get('startDate')?.trim();
    const endDate = searchParams.get('endDate')?.trim();
    const type = searchParams.get('type')?.trim();

    const where: Record<string, unknown> = { ...buildScopeFilter(user) };

    if (status) where.status = status;
    if (type) where.type = type;
    if (employeeId) {
      // EMPLOYEE no puede ver vacaciones ajenas aunque pase employeeId.
      if (user.role === 'EMPLOYEE' && employeeId !== user.employeeId) {
        return forbiddenResponse();
      }
      // SUCURSAL_ADMIN: verificar que el empleado pertenece a su sucursal.
      if (user.role === 'SUCURSAL_ADMIN') {
        const emp = await db.employee.findUnique({
          where: { id: employeeId },
          select: { sucursalId: true },
        });
        if (!emp || emp.sucursalId !== user.sucursalId) {
          return forbiddenResponse();
        }
      }
      where.employeeId = employeeId;
    }

    const dateRange: Record<string, Date> = {};
    if (startDate) {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) dateRange.gte = d;
    }
    if (endDate) {
      const d = new Date(endDate);
      if (!isNaN(d.getTime())) dateRange.lte = d;
    }
    if (Object.keys(dateRange).length > 0) {
      // Filtro por startDate dentro del rango solicitado.
      where.startDate = dateRange;
    }

    const vacations = await db.vacation.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            position: true,
            department: true,
            sucursalId: true,
            user: { select: { id: true, name: true, email: true } },
            sucursal: {
              select: { id: true, name: true, codigoLocal: true },
            },
          },
        },
        requestedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json({ vacations });
  } catch (error) {
    console.error('GET /api/vacations error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    const {
      employeeId,
      type,
      startDate,
      endDate,
      reason,
      grantMode,
      isPartial,
      startTime,
      endTime,
      partialHours,
    } = body as {
      employeeId?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
      reason?: string | null;
      grantMode?: string;
      isPartial?: boolean;
      startTime?: string;
      endTime?: string;
      partialHours?: number;
    };

    // -----------------------------------------------------
    // Validaciones básicas
    // -----------------------------------------------------
    if (!employeeId || !type || !startDate || !endDate) {
      return NextResponse.json(
        {
          error:
            'Faltan campos requeridos: employeeId, type, startDate, endDate',
        },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.has(type)) {
      return NextResponse.json(
        { error: `Tipo inválido. Válidos: ${[...VALID_TYPES].join(', ')}` },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Formato de fecha inválido (usar YYYY-MM-DD)' },
        { status: 400 }
      );
    }
    if (start > end) {
      return NextResponse.json(
        { error: 'La fecha de inicio no puede ser posterior a la de fin' },
        { status: 400 }
      );
    }

    // -----------------------------------------------------
    // Verificar empleado y permisos del solicitante
    // -----------------------------------------------------
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        sucursalId: true,
        isActive: true,
        userId: true,
        user: { select: { id: true, name: true } },
      },
    });
    if (!employee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // EMPLOYEE solo puede solicitar para sí mismo.
    if (user.role === 'EMPLOYEE') {
      if (employeeId !== user.employeeId) {
        return forbiddenResponse();
      }
    }
    // SUCURSAL_ADMIN: el empleado debe pertenecer a su sucursal.
    if (user.role === 'SUCURSAL_ADMIN') {
      if (employee.sucursalId !== user.sucursalId) {
        return forbiddenResponse();
      }
    }
    // GENERAL_ADMIN: sin restricción extra.

    // -----------------------------------------------------
    // Cálculo de días naturales (inclusive)
    // -----------------------------------------------------
    const days =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (days <= 0) {
      return NextResponse.json(
        { error: 'El rango de fechas debe ser de al menos 1 día' },
        { status: 400 }
      );
    }

    // -----------------------------------------------------
    // Modo de otorgamiento
    //   EMPLOYEE_REQUEST (default) → nace PENDING, requiere aprobación.
    //   ADMIN_GRANTED (solo ADMIN)  → nace APPROVED y descuenta saldo
    //                                  si type=VACACIONES y no es parcial.
    // -----------------------------------------------------
    const isGrant = grantMode === 'ADMIN_GRANTED';
    if (isGrant && !isAdmin(user)) {
      return forbiddenResponse(); // solo admin puede otorgar directamente
    }
    const isPartialFlag = isPartial === true;

    // Para permisos parciales, startTime es obligatorio.
    if (isPartialFlag && !startTime) {
      return NextResponse.json(
        { error: 'Los permisos parciales requieren hora de inicio (startTime).' },
        { status: 400 }
      );
    }

    // Parsear horas parciales (opcional).
    let parsedStart: Date | null = null;
    let parsedEnd: Date | null = null;
    if (isPartialFlag && startTime) {
      parsedStart = new Date(`${startDate}T${startTime}:00`);
      if (isNaN(parsedStart.getTime())) {
        return NextResponse.json({ error: 'startTime inválido (HH:mm)' }, { status: 400 });
      }
      if (endTime) {
        parsedEnd = new Date(`${startDate}T${endTime}:00`);
        if (isNaN(parsedEnd.getTime())) {
          return NextResponse.json({ error: 'endTime inválido (HH:mm)' }, { status: 400 });
        }
      }
    }

    // Si es otorgamiento admin, descuenta saldo en la misma transacción
    // (solo VACACIONES completas, no parciales, no permisos).
    const shouldDeduct = isGrant && type === 'VACACIONES' && !isPartialFlag;

    // -----------------------------------------------------
    // Crear (transacción si descuenta saldo)
    // -----------------------------------------------------
    const vacation = await db.$transaction(async (tx) => {
      if (shouldDeduct) {
        // Recargar saldo actual del empleado para evitar carreras.
        const emp = await tx.employee.findUnique({
          where: { id: employeeId },
          select: { vacationBalanceDays: true },
        });
        if (!emp) throw new Error('Empleado no encontrado');
        const newBalance = Math.max(0, emp.vacationBalanceDays - days);
        await tx.employee.update({
          where: { id: employeeId },
          data: { vacationBalanceDays: newBalance },
        });
      }

      return tx.vacation.create({
        data: {
          employeeId,
          type: type as any,
          startDate: start,
          endDate: end,
          days: isPartialFlag ? 0 : days, // permiso parcial = 0 días naturales
          reason: reason ?? null,
          status: isGrant ? 'APPROVED' : 'PENDING',
          grantMode: isGrant ? 'ADMIN_GRANTED' : 'EMPLOYEE_REQUEST',
          isPartial: isPartialFlag,
          startTime: parsedStart,
          endTime: parsedEnd,
          partialHours: isPartialFlag ? (partialHours ?? null) : null,
          requestedById: user.id,
          approvedById: isGrant ? user.id : null,
          approvedAt: isGrant ? new Date() : null,
        },
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
      action: isGrant ? 'VACATION_GRANT' : 'VACATION_REQUEST',
      entityType: 'VACATION',
      entityId: vacation.id,
      sucursalId: employee.sucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: {
        employeeId,
        employeeName: employee.user.name,
        type,
        startDate: toISODate(start),
        endDate: toISODate(end),
        days: isPartialFlag ? 0 : days,
        reason: reason ?? null,
        grantMode: isGrant ? 'ADMIN_GRANTED' : 'EMPLOYEE_REQUEST',
        isPartial: isPartialFlag,
        partialHours: isPartialFlag ? (partialHours ?? null) : null,
        deductedBalance: shouldDeduct,
      },
    });

    // Emitir evento tiempo real (Socket.io) — no bloquea la respuesta
    if (!isGrant) {
      emitVacationRequested({
        vacationId: vacation.id,
        employeeId,
        employeeName: employee.user.name,
        type,
        startDate: toISODate(start),
        endDate: toISODate(end),
        days: isPartialFlag ? 0 : days,
        sucursalId: employee.sucursalId ?? undefined,
      }).catch(() => {});
    }

    return NextResponse.json({ vacation }, { status: 201 });
  } catch (error) {
    console.error('POST /api/vacations error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
