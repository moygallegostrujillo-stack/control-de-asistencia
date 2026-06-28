// ============================================================
// POST /api/auth/qr-login
// Kiosk flow: validate a dynamic QR code, mark it as used, and
// auto-login the admin who generated it (createdById).
// Returns the same base64 payload + cookie as /login.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { validateQRToken } from '@/lib/qr';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { getMexicoNow } from '@/lib/timezone';

const SESSION_MAX_AGE = 8 * 3600; // 8 hours

// Rate limit placeholder: apply @upstash/ratelimit per-IP if this
// endpoint is exposed beyond the local kiosk network.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code } = (body || {}) as { code?: string };

    if (!code) {
      return NextResponse.json(
        { error: 'Código QR es requerido' },
        { status: 400 }
      );
    }

    // 1. Validate HMAC signature + expiry (5 min window, see lib/qr.ts)
    const validation = validateQRToken(code);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.reason || 'Código QR inválido' },
        { status: 401 }
      );
    }

    // 2. Look up the DynamicQR row and verify it is unused + unexpired
    const now = getMexicoNow().toJSDate();
    const dynamicQR = await db.dynamicQR.findUnique({
      where: { code },
    });

    if (!dynamicQR) {
      return NextResponse.json(
        { error: 'Código QR no registrado' },
        { status: 404 }
      );
    }

    if (dynamicQR.used) {
      return NextResponse.json(
        { error: 'El código QR ya fue utilizado' },
        { status: 401 }
      );
    }

    if (dynamicQR.expiresAt <= now) {
      return NextResponse.json(
        { error: 'El código QR ha expirado' },
        { status: 401 }
      );
    }

    // 3. Mark the QR as used so it can't be replayed
    await db.dynamicQR.update({
      where: { id: dynamicQR.id },
      data: { used: true },
    });

    // 4. Resolve the user who generated the QR (kiosk auto-login)
    if (!dynamicQR.createdById) {
      return NextResponse.json(
        { error: 'El código QR no tiene un usuario asociado' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: dynamicQR.createdById },
      include: { sucursal: true, employee: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Usuario no disponible' },
        { status: 401 }
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
      action: 'QR_LOGIN',
      entityType: 'User',
      entityId: user.id,
      sucursalId: user.sucursalId || undefined,
      ipAddress: ip,
      userAgent: ua,
      details: { method: 'qr', qrId: dynamicQR.id },
    });

    return NextResponse.json({ user: payload, token });
  } catch (error) {
    console.error('[auth/qr-login] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
