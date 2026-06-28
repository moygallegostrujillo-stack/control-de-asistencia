// ============================================================
// GET /api/auth/me
// Returns the current authenticated user, enriched with
// sucursal info (name, codigoLocal) and employeeId.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return unauthorizedResponse();

    // Re-fetch the user with relations so we can include sucursal info
    // (name, codigoLocal) and employeeId in the response.
    const user = await db.user.findUnique({
      where: { id: authUser.id },
      include: { sucursal: true, employee: true },
    });

    if (!user || !user.isActive) {
      return unauthorizedResponse();
    }

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sucursalId: user.sucursalId,
      employeeId: user.employee?.id ?? null,
      sucursalName: user.sucursal?.name ?? null,
      sucursalCodigoLocal: user.sucursal?.codigoLocal ?? null,
    };

    return NextResponse.json({ user: payload });
  } catch (error) {
    console.error('[auth/me] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
