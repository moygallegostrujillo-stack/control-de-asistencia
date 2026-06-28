// ============================================================
// POST /api/auth/login
// Custom credentials login (no NextAuth session).
// Sets `session_user` cookie with base64(user payload) so the
// client can also read it and send it back as a Bearer token.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { getMexicoNow } from '@/lib/timezone';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const SESSION_MAX_AGE = 8 * 3600; // 8 hours, in seconds

// Rate limit placeholder:
// We have @upstash/ratelimit + @upstash/redis available. To throttle
// brute-force attempts per-IP/email, wire up a ratelimiter here:
//   import { Ratelimit } from '@upstash/ratelimit';
//   import { Redis } from '@upstash/redis';
//   const ratelimit = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(10, '1 m') });
//   const { success } = await ratelimit.limit(ip);
//   if (!success) return 429.
// For now we rely on the failedLoginAttempts/lockedUntil fields below.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = (body || {}) as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son obligatorios' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const { ip, ua } = getIpAndUA(req);
    const now = getMexicoNow().toJSDate();

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      include: { sucursal: true, employee: true },
    });

    // Always return a generic "invalid credentials" message to avoid
    // user-enumeration via timing or distinct errors.
    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Usuario inactivo. Contacta al administrador.' },
        { status: 403 }
      );
    }

    // Lockout check
    if (user.lockedUntil && user.lockedUntil > now) {
      const mins = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000);
      return NextResponse.json(
        {
          error: `Cuenta bloqueada. Intenta en ${mins} min.`,
          locked: true,
          retryAfterMinutes: mins,
        },
        { status: 423 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const lock = attempts >= MAX_LOGIN_ATTEMPTS;
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: lock
            ? new Date(Date.now() + LOCK_MINUTES * 60_000)
            : null,
        },
      });

      await auditLog({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user.id,
        sucursalId: user.sucursalId || undefined,
        ipAddress: ip,
        userAgent: ua,
        details: { method: 'password', attempts, locked: lock },
      });

      const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - attempts);
      return NextResponse.json(
        {
          error: lock
            ? `Cuenta bloqueada por ${LOCK_MINUTES} min.`
            : `Contraseña incorrecta. Intentos restantes: ${remaining}`,
          locked: lock,
          attemptsRemaining: remaining,
        },
        { status: 401 }
      );
    }

    // Success: reset counter + update last login
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: now,
      },
    });

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

    // base64-encoded JSON payload — client stores this in localStorage and
    // sends it back as `Authorization: Bearer <token>` on protected requests.
    const token = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');

    const cookieStore = await cookies();
    cookieStore.set('session_user', token, {
      httpOnly: false, // client can read for Bearer token
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    });

    await auditLog({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      sucursalId: user.sucursalId || undefined,
      ipAddress: ip,
      userAgent: ua,
      details: { method: 'password' },
    });

    return NextResponse.json({ user: payload, token });
  } catch (error) {
    console.error('[auth/login] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
