// ============================================================
// POST /api/auth/quick-login
// Public kiosk endpoint: trade a userId for a session payload.
// Intended for trusted on-device quick-access buttons (single-tap
// login). Do NOT expose externally without rate limiting / IP
// allow-list.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildSessionCookies, applySessionCookies } from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { userId } = (body || {}) as { userId?: string };

    if (!userId) {
      return NextResponse.json(
        { error: 'userId es requerido' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: { sucursal: true, employee: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Usuario inactivo' },
        { status: 403 }
      );
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
      mfaVerified: false, // quick-login skips MFA (kiosk trusts the device)
    };

    // Crear sesión JWT firmada (Phase A — NextAuth)
    const cookiePairs = await buildSessionCookies(payload);

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'QUICK_LOGIN',
      entityType: 'User',
      entityId: user.id,
      sucursalId: user.sucursalId || undefined,
      ipAddress: ip,
      userAgent: ua,
      details: { method: 'quick' },
    });

    const res = NextResponse.json({ user: payload });
    applySessionCookies(res, cookiePairs);
    return res;
  } catch (error) {
    console.error('[auth/quick-login] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
