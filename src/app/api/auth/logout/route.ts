// ============================================================
// POST /api/auth/logout
// Clears the `session_user` cookie and logs the LOGOUT event.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAuthUser } from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const { ip, ua } = getIpAndUA(req);

    if (user) {
      await auditLog({
        userId: user.id,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: user.id,
        sucursalId: user.sucursalId || undefined,
        ipAddress: ip,
        userAgent: ua,
        details: {},
      });
    }

    const cookieStore = await cookies();
    cookieStore.set('session_user', '', {
      httpOnly: false,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0,
      path: '/',
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[auth/logout] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
