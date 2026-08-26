// ============================================================
// POST /api/auth/quick-login
// Public kiosk endpoint: trade a userId for a session payload.
// Intended for trusted on-device quick-access buttons (single-tap
// login). Do NOT expose externally without rate limiting / IP
// allow-list.
//
// 🔒 CLEANUP (26-ago-2026): hardening en 3 capas (sin romper kiosk).
// - Rate limit real: 20 intentos por IP cada 60s (usando lib/rate-limit).
// - Anti-impersonación admin: GENERAL_ADMIN no puede usar quick-login
//   (debe usar password + MFA). Previene escalamiento de privilegios.
// - Auditoría ampliada: QUICK_LOGIN_FORBIDDEN_ADMIN + rate-limit 429.
// - Opcional: cliente puede setear ALLOW_QUICK_LOGIN=false en Vercel
//   para desactivar el kiosk por completo si deja de usarlo.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildSessionCookies, applySessionCookies } from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const QUICK_LOGIN_RATE_LIMIT = 20;
const QUICK_LOGIN_RATE_WINDOW = 60; // segundos

export async function POST(req: NextRequest) {
  try {
    // --- Rate limiting por IP (26-ago-2026) ---
    const ip = getClientIp(req);
    const rl = await rateLimit('quick-login', ip, QUICK_LOGIN_RATE_LIMIT, QUICK_LOGIN_RATE_WINDOW);
    if (!rl.success) {
      const retryAfter = Math.ceil((rl.reset - Date.now()) / 1000);
      return NextResponse.json(
        { error: `Demasiados intentos. Intenta de nuevo en ${retryAfter} segundos.`, code: 'RATE_LIMITED' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(rl.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rl.reset),
          },
        }
      );
    }

    // --- Guard opcional con env var (26-ago-2026) ---
    // Si el cliente setea ALLOW_QUICK_LOGIN=false en Vercel, el kiosk se
    // desactiva por completo. Default: permite (para no romper kiosk existente).
    if (process.env.ALLOW_QUICK_LOGIN === 'false') {
      const { ua } = getIpAndUA(req);
      await auditLog({
        action: 'QUICK_LOGIN_DISABLED',
        entityType: 'User',
        entityId: 'quick-login',
        ipAddress: ip,
        userAgent: ua,
        details: { reason: 'ALLOW_QUICK_LOGIN=false — kiosk desactivado' },
      }).catch(() => undefined);
      return NextResponse.json(
        { error: 'Quick-login desactivado en este entorno' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { userId } = (body || {}) as { userId?: string };

    if (!userId) {
      return NextResponse.json(
        { error: 'userId es requerido' },
        { status: 400 }
      );
    }

    // RESILIENCE: select específicos para no romper login si falta columna.
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        sucursal: { select: { name: true, codigoLocal: true } },
        employee: { select: { id: true } },
      },
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

    // Anti-impersonación (26-ago-2026): GENERAL_ADMIN no puede usar quick-login.
    // Solo EMPLOYEE y SUCURSAL_ADMIN pueden. Previene escalamiento de privilegios.
    if (user.role === 'GENERAL_ADMIN') {
      const { ua } = getIpAndUA(req);
      await auditLog({
        userId: user.id,
        action: 'QUICK_LOGIN_FORBIDDEN_ADMIN',
        entityType: 'User',
        entityId: user.id,
        sucursalId: user.sucursalId || undefined,
        ipAddress: ip,
        userAgent: ua,
        details: { reason: 'GENERAL_ADMIN no puede usar quick-login — requiere password+MFA' },
      }).catch(() => undefined);
      return NextResponse.json(
        { error: 'Administrador general debe usar login con contraseña y MFA' },
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

    const { ua } = getIpAndUA(req);
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
