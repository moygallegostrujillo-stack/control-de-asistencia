// ============================================================
// Auth — Custom cookie-based session (compatible con middleware)
// ============================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { db } from './db';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'GENERAL_ADMIN' | 'SUCURSAL_ADMIN' | 'EMPLOYEE';
  sucursalId: string | null;
  employeeId: string | null;
  sucursalName?: string | null;
  sucursalCodigoLocal?: string | null;
}

/**
 * Obtiene el usuario autenticado desde cookie o Authorization header.
 */
export async function getAuthUser(req?: NextRequest): Promise<AuthUser | null> {
  let payload: any = null;

  // 1. Cookie session_user (via next/headers cookies())
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get('session_user')?.value;
    if (cookie) {
      const json = Buffer.from(cookie, 'base64').toString('utf-8');
      payload = JSON.parse(json);
    }
  } catch {
    // cookies() not available (e.g. in some contexts) — fall through
  }

  // 2. Authorization header Bearer <base64>
  if (!payload && req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const json = Buffer.from(authHeader.slice(7), 'base64').toString('utf-8');
        payload = JSON.parse(json);
      } catch {}
    }
  }

  if (!payload || !payload.id || !payload.role) {
    return null;
  }

  // Hidratar sucursal name/codigo desde DB si es necesario
  if (payload.sucursalId && !payload.sucursalName) {
    const suc = await db.sucursal.findUnique({
      where: { id: payload.sucursalId },
      select: { name: true, codigoLocal: true },
    });
    if (suc) {
      payload.sucursalName = suc.name;
      payload.sucursalCodigoLocal = suc.codigoLocal;
    }
  }

  return payload as AuthUser;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
}

export function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
}

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'GENERAL_ADMIN' || user?.role === 'SUCURSAL_ADMIN';
}

export function isGeneralAdmin(user: AuthUser | null): boolean {
  return user?.role === 'GENERAL_ADMIN';
}

/**
 * Devuelve el filtro de sucursal a aplicar en queries Prisma.
 * - GENERAL_ADMIN: {} (sin filtro)
 * - SUCURSAL_ADMIN: { sucursalId: user.sucursalId }
 */
export function getSucursalFilter(user: AuthUser | null): { sucursalId?: string } {
  if (user?.role === 'GENERAL_ADMIN') return {};
  if (user?.sucursalId) return { sucursalId: user.sucursalId };
  return { sucursalId: '__NONE__' };
}

/**
 * Construye el payload de sesión y setea la cookie.
 */
export async function setSessionCookie(payload: any): Promise<void> {
  const token = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
  const cookieStore = await cookies();
  cookieStore.set('session_user', token, {
    httpOnly: false,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 3600,
    path: '/',
  });
}

/**
 * Limpia la cookie de sesión.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session_user');
}
