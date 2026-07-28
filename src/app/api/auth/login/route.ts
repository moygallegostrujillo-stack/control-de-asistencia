// ============================================================
// POST /api/auth/login
// Login con credenciales (email + password + opcional MFA TOTP).
// Emite JWT firmado con NEXTAUTH_SECRET (Phase A — NextAuth.js v4).
//
// ⚠️ TAREA 6 (AUDIT DE SEGURIDAD): Rate limiting por IP.
// 10 intentos por IP cada 60s usando @upstash/ratelimit (con
// fallback a memoria si Upstash no está configurado). Esto
// complementa el bloqueo de cuenta tras 5 intentos fallidos
// (que es por email, no por IP) y previene credential stuffing
// distribuido desde múltiples emails.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { validateCredentials } from '@/lib/auth.config';
import { buildSessionCookies, applySessionCookies, buildClearCookies } from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

// Política de rate limiting para login: 10 intentos por IP cada 60s.
// Suficiente para un usuario que se equivoca de teclado, insuficiente
// para brute force (que además topa con el bloqueo de 5 intentos por email).
const LOGIN_RATE_LIMIT = 10;
const LOGIN_RATE_WINDOW = 60; // segundos

export async function POST(req: NextRequest) {
  try {
    // --- Rate limiting por IP (Tarea 6) ---
    const ip = getClientIp(req);
    const rl = await rateLimit('login', ip, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW);
    if (!rl.success) {
      const retryAfter = Math.ceil((rl.reset - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: `Demasiados intentos de inicio de sesión. Intenta de nuevo en ${retryAfter} segundos.`,
          code: 'RATE_LIMITED',
          retryAfter,
        },
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

    const body = await req.json().catch(() => ({}));
    const { email, password, mfaToken, backupCode } = (body || {}) as {
      email?: string;
      password?: string;
      mfaToken?: string;
      backupCode?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son obligatorios' },
        { status: 400 }
      );
    }

    const result = await validateCredentials(email, password, mfaToken, req, backupCode);

    // Caso especial: requiere MFA
    if (result.needsMfa) {
      return NextResponse.json(
        {
          error: 'Se requiere código MFA',
          needsMfa: true,
          email: email.toLowerCase().trim(),
        },
        { status: 200 }
      );
    }

    if (result.error || !result.user) {
      const isLocked = result.error?.includes('bloqueada');
      return NextResponse.json(
        { error: result.error || 'Credenciales inválidas' },
        { status: isLocked ? 423 : 401 }
      );
    }

    // Crear sesión JWT firmada
    const cookiePairs = await buildSessionCookies(result.user);
    const { ip: loginIp, ua } = getIpAndUA(req);
    await auditLog({
      userId: result.user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: result.user.id,
      sucursalId: result.user.sucursalId || undefined,
      ipAddress: loginIp,
      userAgent: ua,
      details: {
        method: 'password',
        mfaUsed: !!result.user.mfaVerified,
      },
    });

    const res = NextResponse.json({ user: result.user });
    applySessionCookies(res, cookiePairs);
    return res;
  } catch (error) {
    console.error('[auth/login] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE /api/auth/login — logout (limpia cookies)
// ============================================================

export async function DELETE(req: NextRequest) {
  try {
    const res = NextResponse.json({ ok: true });
    for (const c of buildClearCookies()) {
      res.cookies.set(c.name, c.value, c.options);
    }
    return res;
  } catch {
    return NextResponse.json({ error: 'Error al cerrar sesión' }, { status: 500 });
  }
}
