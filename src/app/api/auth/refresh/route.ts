// ============================================================
// POST /api/auth/refresh
// Requires auth. Since we use an 8hr `session_user` cookie (no
// real JWT refresh), this endpoint simply re-returns the current
// user with fresh data from the DB.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return unauthorizedResponse();

    // Re-fetch the user to return fresh data (role/sucursal may have changed)
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

    return NextResponse.json({ ok: true, user: payload });
  } catch (error) {
    console.error('[auth/refresh] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
