// ============================================================
// /api/vacations/balance/[employeeId]
//   GET — Devuelve el saldo de vacaciones de un empleado:
//         { employeeId, totalDays, usedDays, remainingDays, pendingDays }
//         - totalDays: employee.vacationBalanceDays (saldo configurable).
//         - usedDays: suma de `days` de vacaciones APPROVED tipo VACACIONES.
//         - remainingDays: totalDays - usedDays.
//         - pendingDays: suma de `days` de solicitudes PENDING (cualquier tipo).
//         Permisos: propio empleado, o ADMIN con scope de sucursal.
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

type Ctx = { params: Promise<{ employeeId: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const { employeeId } = await params;
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        sucursalId: true,
        vacationBalanceDays: true,
        user: { select: { id: true, name: true } },
      },
    });
    if (!employee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Permisos:
    // - El propio empleado (role EMPLOYEE con employeeId coincidente).
    // - SUCURSAL_ADMIN si el empleado está en su sucursal.
    // - GENERAL_ADMIN: cualquiera.
    const isSelf =
      user.role === 'EMPLOYEE' && user.employeeId === employeeId;
    let allowedAdmin = false;
    if (isAdmin(user)) {
      if (isGeneralAdmin(user)) {
        allowedAdmin = true;
      } else if (employee.sucursalId === user.sucursalId) {
        allowedAdmin = true;
      }
    }

    if (!isSelf && !allowedAdmin) {
      return forbiddenResponse();
    }

    // Días ya usados (APPROVED + type=VACACIONES).
    const approvedAgg = await db.vacation.aggregate({
      where: {
        employeeId,
        status: 'APPROVED',
        type: 'VACACIONES',
      },
      _sum: { days: true },
    });
    const usedDays = approvedAgg._sum.days ?? 0;

    // Días pendientes (PENDING, cualquier tipo — resaltamos que
    // podría reducir saldo al aprobarse si es VACACIONES).
    const pendingAgg = await db.vacation.aggregate({
      where: {
        employeeId,
        status: 'PENDING',
      },
      _sum: { days: true },
    });
    const pendingDays = pendingAgg._sum.days ?? 0;

    const totalDays = employee.vacationBalanceDays;
    const remainingDays = Math.max(0, totalDays - usedDays);

    return NextResponse.json({
      employeeId,
      employeeName: employee.user.name,
      totalDays,
      usedDays,
      remainingDays,
      pendingDays,
    });
  } catch (error) {
    console.error('GET /api/vacations/balance/[employeeId] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
