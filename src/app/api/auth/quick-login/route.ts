// ============================================================
// POST /api/auth/quick-login
// Public kiosk endpoint: trade a userId for a session payload.
// Intended for trusted on-device quick-access buttons (single-tap
// login). Do NOT expose externally without rate limiting / IP
// allow-list.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { auditLog, getIpAndUA } from '@/lib/audit';

const SESSION_MAX_AGE = 8 * 3600; // 8 hours

// Rate limit placeholder: apply @upstash/ratelimit per-IP. Since this
// endpoint skips password verification, it must be restricted to a
// trusted network (kiosk device) in production.

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
    };

    const token = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');

    const cookieStore = await cookies();
    cookieStore.set('session_user', token, {
      httpOnly: false,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    });

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

    return NextResponse.json({ user: payload, token });
  } catch (error) {
    console.error('[auth/quick-login] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
