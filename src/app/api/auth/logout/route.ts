// ============================================================
// POST /api/auth/logout
// Clears the `session_user` cookie and logs the LOGOUT event.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, buildClearCookies } from '@/lib/auth';
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

    const res = NextResponse.json({ ok: true });
    for (const c of buildClearCookies()) {
      res.cookies.set(c.name, c.value, c.options);
    }
    return res;
  } catch (error) {
    console.error('[auth/logout] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
