// ============================================================
// Auth — NextAuth JWT (firmado) + fallback legacy cookie (transición)
// ============================================================
//
// Phase A: migración a NextAuth.js v4 con JWT firmado.
// - Cookie preferida: `next-auth.session-token` (JWT firmado)
// - Fallback: `session_user` (base64 JSON, legacy — para no romper
//   sesiones existentes durante la transición)
//
// El JWT NO puede ser falsificado porque está firmado con
// NEXTAUTH_SECRET (HMAC-SHA512 via jose).
//
// Seguridad (gap #15 — OWASP session security):
// AMBAS cookies son httpOnly:true. La cookie legacy también es
// httpOnly aunque sea de transición, porque NUNCA se lee desde
// JavaScript del cliente — solo se decodifica server-side en
// getAuthUser() y middleware. Así, un ataque XSS no podría
// robarla. SameSite=strict previene CSRF. Secure=true en prod.
// ============================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';
import { db } from './db';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'GENERAL_ADMIN' | 'SUCURSAL_ADMIN' | 'SUPERVISOR' | 'EMPLOYEE';
  sucursalId: string | null;
  employeeId: string | null;
  sucursalName?: string | null;
  sucursalCodigoLocal?: string | null;
  mfaVerified?: boolean;
}

const SESSION_COOKIE = 'next-auth.session-token';
const LEGACY_COOKIE = 'session_user';
const SESSION_MAX_AGE = 8 * 3600;

/**
 * Decodifica el cookie legacy (base64 JSON) — solo para transición.
 */
function decodeLegacyCookie(cookie: string): any | null {
  try {
    const json = Buffer.from(cookie, 'base64').toString('utf-8');
    const payload = JSON.parse(json);
    if (payload && payload.id && payload.role) return payload;
  } catch {}
  return null;
}

/**
 * Obtiene el usuario autenticado.
 * Prioridad: NextAuth JWT → cookie legacy → Authorization header.
 */
export async function getAuthUser(req?: NextRequest): Promise<AuthUser | null> {
  // 1. NextAuth JWT (firmado, seguro)
  try {
    const token = await getToken({
      req: req as any,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (token && token.id && token.role) {
      let payload: AuthUser = {
        id: token.id as string,
        email: token.email as string,
        name: token.name as string,
        role: token.role as AuthUser['role'],
        sucursalId: (token.sucursalId as string) || null,
        employeeId: (token.employeeId as string) || null,
        sucursalName: (token.sucursalName as string) || null,
        sucursalCodigoLocal: (token.sucursalCodigoLocal as string) || null,
        mfaVerified: (token.mfaVerified as boolean) || false,
      };

      // Hidratar sucursal name/codigo si no vienen en el token
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
      return payload;
    }
  } catch {
    // getToken falla si no hay secret o cookie inválida
  }

  // 2. Cookie legacy (transición — solo lectura)
  try {
    const cookieStore = await cookies();
    const legacy = cookieStore.get(LEGACY_COOKIE)?.value;
    if (legacy) {
      const payload = decodeLegacyCookie(legacy);
      if (payload) {
        // Hidratar sucursal si hace falta
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
    }
  } catch {}

  // 3. Authorization header Bearer <base64> (legacy, para mobile/CLI)
  if (req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const payload = decodeLegacyCookie(authHeader.slice(7));
      if (payload) return payload as AuthUser;
    }
  }

  return null;
}

export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
}

export function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
}

export function isAdmin(user: AuthUser | null): boolean {
  return (
    user?.role === 'GENERAL_ADMIN' ||
    user?.role === 'SUCURSAL_ADMIN' ||
    user?.role === 'SUPERVISOR'
  );
}

export function isGeneralAdmin(user: AuthUser | null): boolean {
  return user?.role === 'GENERAL_ADMIN';
}

export function isSupervisor(user: AuthUser | null): boolean {
  return user?.role === 'SUPERVISOR';
}

/**
 * Devuelve el filtro de sucursal a aplicar en queries Prisma.
 * - GENERAL_ADMIN: {} (sin filtro)
 * - SUCURSAL_ADMIN / SUPERVISOR: { sucursalId: user.sucursalId }
 */
export function getSucursalFilter(user: AuthUser | null): { sucursalId?: string } {
  if (user?.role === 'GENERAL_ADMIN') return {};
  if (user?.sucursalId) return { sucursalId: user.sucursalId };
  return { sucursalId: '__NONE__' };
}

// ============================================================
// Helpers para crear sesión JWT programáticamente
// ============================================================
//
// Los endpoints custom (login, qr-login, quick-login) usan estos
// helpers para emitir un JWT firmado sin pasar por el flujo estándar
// de NextAuth signIn().
//
// IMPORTANTE: En Next.js App Router, los route handlers deben setear
// cookies en el NextResponse, no via cookies().set(). Por eso
// setSessionCookie retorna los pares nombre→valor y el handler los
// aplica con response.cookies.set().
// ============================================================

import { encode as jwtEncode } from 'next-auth/jwt';

export interface CookiePair {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    sameSite: 'strict' | 'lax' | 'none';
    secure: boolean;
    maxAge: number;
    path: string;
  };
}

/**
 * Genera los pares de cookies para una sesión JWT.
 * El handler debe aplicarlos al NextResponse.
 */
export async function buildSessionCookies(payload: any): Promise<CookiePair[]> {
  // 1. JWT firmado (preferido)
  const jwt = await jwtEncode({
    token: {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      sucursalId: payload.sucursalId,
      employeeId: payload.employeeId,
      sucursalName: payload.sucursalName,
      sucursalCodigoLocal: payload.sucursalCodigoLocal,
      mfaVerified: payload.mfaVerified ?? false,
    },
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge: SESSION_MAX_AGE,
  } as any);

  const isProd = process.env.NODE_ENV === 'production';

  const jwtCookie: CookiePair = {
    name: SESSION_COOKIE,
    value: jwt,
    options: {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProd,
      maxAge: SESSION_MAX_AGE,
      path: '/',
    },
  };

  // 2. Legacy (base64 sin firma, transición — 1h para forzar migración)
  //    httpOnly:true porque NUNCA se lee desde JS del cliente (gap #15).
  const legacyToken = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');
  const legacyCookie: CookiePair = {
    name: LEGACY_COOKIE,
    value: legacyToken,
    options: {
      httpOnly: true,
      sameSite: 'strict',
      secure: isProd,
      maxAge: 3600,
      path: '/',
    },
  };

  return [jwtCookie, legacyCookie];
}

/**
 * Aplica cookies de sesión a un NextResponse.
 * Uso en route handlers:
 *   const cookies = await buildSessionCookies(payload);
 *   const res = NextResponse.json({ user: payload });
 *   applySessionCookies(res, cookies);
 *   return res;
 */
export function applySessionCookies(
  res: NextResponse,
  cookies: CookiePair[]
): void {
  for (const c of cookies) {
    res.cookies.set(c.name, c.value, c.options);
  }
}

/**
 * Genera cookies de borrado para limpiar sesión.
 */
export function buildClearCookies(): CookiePair[] {
  return [
    {
      name: SESSION_COOKIE,
      value: '',
      options: {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 0,
        path: '/',
      },
    },
    {
      name: LEGACY_COOKIE,
      value: '',
      options: {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 0,
        path: '/',
      },
    },
  ];
}

// ============================================================
// Compatibilidad: wrappers que usan cookies() de next/headers
// (funcionan en Server Actions y middleware, NO en route handlers)
// ============================================================

export async function setSessionCookie(payload: any): Promise<void> {
  const pairs = await buildSessionCookies(payload);
  const cookieStore = await cookies();
  for (const c of pairs) {
    cookieStore.set(c.name, c.value, c.options);
  }
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(LEGACY_COOKIE);
}
