// ============================================================
// /api/work-schedules
//   GET — Horarios de trabajo.
//          Requiere autenticación (cualquier rol).
//          ?employeeId=<id>  →  horarios de ese empleado.
//               * SUCURSAL_ADMIN: valida que el empleado pertenezca
//                 a su sucursal (403 en caso contrario).
//               * EMPLOYEE: solo puede consultar su propio employeeId
//                 (403 en caso contrario).
//          Sin ?employeeId:
//               * EMPLOYEE  →  sus propios horarios.
//               * ADMIN     →  todos (filtrados por sucursal para
//                              SUCURSAL_ADMIN).
//          Incluye employee.user.name.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  getSucursalFilter,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
} from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId')?.trim() || null;

    // -----------------------------------------------------
    // Caso A: se solicita un empleado específico.
    // -----------------------------------------------------
    if (employeeId) {
      const employee = await db.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          sucursalId: true,
          userId: true,
        },
      });

      if (!employee) {
        return NextResponse.json(
          { error: 'Empleado no encontrado' },
          { status: 404 }
        );
      }

      // EMPLOYEE: solo puede ver sus propios horarios.
      if (user.role === 'EMPLOYEE') {
        if (user.employeeId !== employee.id) {
          return forbiddenResponse();
        }
      }
      // SUCURSAL_ADMIN: el empleado debe ser de su sucursal.
      else if (user.role === 'SUCURSAL_ADMIN') {
        if (employee.sucursalId !== user.sucursalId) {
          return forbiddenResponse();
        }
      }
      // GENERAL_ADMIN: sin restricción.

      const schedules = await db.workSchedule.findMany({
        where: { employeeId },
        include: {
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ dayOfWeek: 'asc' }],
      });

      return NextResponse.json({ schedules });
    }

    // -----------------------------------------------------
    // Caso B: sin employeeId.
    // -----------------------------------------------------
    if (user.role === 'EMPLOYEE') {
      // EMPLOYEE: sus propios horarios.
      if (!user.employeeId) {
        return NextResponse.json({ schedules: [] });
      }
      const schedules = await db.workSchedule.findMany({
        where: { employeeId: user.employeeId },
        include: {
          employee: {
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [{ employeeId: 'asc' }, { dayOfWeek: 'asc' }],
      });
      return NextResponse.json({ schedules });
    }

    // ADMIN (SUCURSAL_ADMIN o GENERAL_ADMIN): todos los horarios,
    // filtrados por sucursal para SUCURSAL_ADMIN vía getSucursalFilter
    // (que aplica sobre Employee.sucursalId).
    const sucursalFilter = getSucursalFilter(user);

    const schedules = await db.workSchedule.findMany({
      where: {
        employee: { ...sucursalFilter },
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            sucursalId: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [
        { employee: { user: { name: 'asc' } } },
        { dayOfWeek: 'asc' },
      ],
    });

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('GET /api/work-schedules error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
