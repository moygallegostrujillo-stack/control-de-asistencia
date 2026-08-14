// ============================================================
// GET /api/auth/users-list
// Returns active users for the quick-access login buttons.
//  - GENERAL_ADMIN  → all active users
//  - SUCURSAL_ADMIN → only users in their sucursal
//  - SUPERVISOR     → only users in their sucursal (same as SUCURSAL_ADMIN)
//  - EMPLOYEE       → only themselves
// Includes employee info (employeeNumber, position, department)
// when available.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return unauthorizedResponse();

    let users;

    // RESILIENCE: select específicos (employeeNumber, position, department,
    // name, codigoLocal) en lugar de include completo. Evita que la lista
    // de usuarios se rompa si una columna de Employee/Sucursal no existe en prod.
    const userInclude = {
      sucursal: { select: { name: true, codigoLocal: true } },
      employee: { select: { employeeNumber: true, position: true, department: true } },
    };

    if (authUser.role === 'GENERAL_ADMIN') {
      // All active users
      users = await db.user.findMany({
        where: { isActive: true },
        include: userInclude,
        orderBy: [{ role: 'desc' }, { name: 'asc' }],
      });
    } else if (
      authUser.role === 'SUCURSAL_ADMIN' ||
      authUser.role === 'SUPERVISOR'
    ) {
      // Only users in their sucursal
      if (!authUser.sucursalId) {
        return NextResponse.json({ users: [] });
      }
      users = await db.user.findMany({
        where: {
          isActive: true,
          sucursalId: authUser.sucursalId,
        },
        include: userInclude,
        orderBy: [{ role: 'desc' }, { name: 'asc' }],
      });
    } else {
      // EMPLOYEE: only themselves
      const me = await db.user.findUnique({
        where: { id: authUser.id },
        include: userInclude,
      });
      users = me ? [me] : [];
    }

    const usersList = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      sucursalId: u.sucursalId,
      employeeId: u.employee?.id ?? null,
      employeeNumber: u.employee?.employeeNumber ?? null,
      position: u.employee?.position ?? null,
      department: u.employee?.department ?? null,
      sucursalName: u.sucursal?.name ?? null,
      sucursalCodigoLocal: u.sucursal?.codigoLocal ?? null,
    }));

    return NextResponse.json({ users: usersList });
  } catch (error) {
    console.error('[auth/users-list] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
