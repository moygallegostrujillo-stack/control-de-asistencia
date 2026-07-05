// ============================================================
// /api/vacations/balance/[employeeId]
//   GET — Devuelve el saldo de vacaciones de un empleado:
//         { employeeId, employeeName, totalDays, usedDays, remainingDays,
//           pendingDays, availableDays }
//         - totalDays:     employee.vacationBalanceDays (saldo vivo, ya
//                          neto de vacaciones APPROVED descontadas).
//         - usedDays:      histórico: suma de `days` de vacaciones
//                          APPROVED tipo VACACIONES (informativo).
//         - remainingDays: totalDays (el saldo vivo YA refleja los
//                          descuentos; NO restar usedDays de nuevo).
//         - pendingDays:   suma de `days` de solicitudes PENDING tipo
//                          VACACIONES (las que aún podrían descontarse).
//         - availableDays: remainingDays - pendingDays (lo que queda
//                          disponible si se aprueban las pendientes).
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

    // Días ya usados (APPROVED + type=VACACIONES) — valor histórico.
    // NOTA: estos días YA fueron descontados de vacationBalanceDays en
    // el momento de la aprobación/otorgamiento, así que NO se restan
    // de nuevo del saldo disponible.
    const approvedAgg = await db.vacation.aggregate({
      where: {
        employeeId,
        status: 'APPROVED',
        type: 'VACACIONES',
      },
      _sum: { days: true },
    });
    const usedDays = approvedAgg._sum.days ?? 0;

    // Días pendientes (PENDING, solo VACACIONES — permisos no descuentan).
    const pendingAgg = await db.vacation.aggregate({
      where: {
        employeeId,
        status: 'PENDING',
        type: 'VACACIONES',
      },
      _sum: { days: true },
    });
    const pendingDays = pendingAgg._sum.days ?? 0;

    const totalDays = employee.vacationBalanceDays;
    // remainingDays = saldo vivo (ya neto de descuentos por aprobación).
    const remainingDays = Math.max(0, totalDays);
    // availableDays = lo que queda si se aprueban todas las pendientes.
    const availableDays = Math.max(0, totalDays - pendingDays);

    return NextResponse.json({
      employeeId,
      employeeName: employee.user.name,
      totalDays,
      usedDays,
      remainingDays,
      pendingDays,
      availableDays,
    });
  } catch (error) {
    console.error('GET /api/vacations/balance/[employeeId] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
