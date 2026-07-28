// ============================================================
// Auth — NextAuth JWT (firmado) — fuente ÚNICA de sesión
// ============================================================
//
// ⚠️  TAREA 3 (AUDIT DE SEGURIDAD):
// Se eliminó el fallback a cookie legacy `session_user` y al
// header `Authorization: Bearer <base64>`. Antes, cualquiera
// podía fabricar un payload JSON con `role: "GENERAL_ADMIN"`,
// codificarlo en base64 y enviarlo como cookie/header — el
// sistema lo aceptaba como sesión válida SIN verificar firma.
//
// Ahora la ÚNICA fuente de sesión válida es el JWT firmado por
// NextAuth (`next-auth.session-token`, HMAC-SHA512 via jose con
// NEXTAUTH_SECRET). El JWT no puede ser falsificado sin el secret.
//
// Los helpers `buildClearCookies` aún borran la cookie legacy
// (por si quedaron sesiones viejas en navegadores), pero ya
// NUNCA se acepta como autenticación.
// ============================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';
import { db } from './db';
import { CURRENT_PRIVACY_VERSION } from './privacy';

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
  // LFPDPPP — flag de consentimiento (cargado desde BD en login).
  privacyAccepted?: boolean;
  privacyVersion?: string | null;
}

const SESSION_COOKIE = 'next-auth.session-token';
const LEGACY_COOKIE = 'session_user'; // Solo se borra en logout; ya NO se acepta como auth.
const SESSION_MAX_AGE = 8 * 3600;

/**
 * Obtiene el usuario autenticado.
 *
 * ÚNICA fuente de sesión válida: el JWT firmado por NextAuth
 * (`next-auth.session-token`). El JWT está firmado con
 * NEXTAUTH_SECRET (HMAC-SHA512 via jose), por lo que NO puede
 * ser falsificado sin el secret.
 *
 * ⚠️ Tarea 3 (audit seguridad): el fallback a cookie legacy
 * `session_user` y al header `Authorization: Bearer <base64>`
 * fue REMOVIDO. Eran base64 sin firma criptográfica y cualquiera
 * podía fabricarlos con `role: "GENERAL_ADMIN"`.
 */
export async function getAuthUser(req?: NextRequest): Promise<AuthUser | null> {
  try {
    const token = await getToken({
      req: req as any,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (token && token.id && token.role) {
      // Si el JWT tiene los campos crudos (privacyAcceptedAt/Version) pero
      // no el booleano, derivarlos para compatibilidad con JWTs viejos.
      const tokenPrivacyAt = (token as any).privacyAcceptedAt || null;
      const tokenPrivacyVersion =
        (token.privacyVersion as string) ||
        (token as any).privacyAcceptedVersion ||
        null;
      const derivedPrivacyAccepted =
        (token.privacyAccepted as boolean) ||
        (!!tokenPrivacyAt && tokenPrivacyVersion === CURRENT_PRIVACY_VERSION);
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
        privacyAccepted: derivedPrivacyAccepted,
        privacyVersion: tokenPrivacyVersion,
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
      // LFPDPPP — incluir flag de consentimiento para que el middleware
      // lo valide sin consultar la BD en cada request.
      // El payload puede venir de Prisma (privacyAcceptedAt/Version) o de un
      // JWT existente (privacyAccepted/Version). Mapeamos ambos casos.
      privacyAccepted: !!(payload.privacyAcceptedAt ?? payload.privacyAccepted),
      privacyVersion: payload.privacyAcceptedVersion ?? payload.privacyVersion ?? null,
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

  // ⚠️ Tarea 3 (audit seguridad): la cookie legacy `session_user` ya NO se
  // emite. Era base64 sin firma y cualquiera podía fabricarla con
  // role: "GENERAL_ADMIN". La ÚNICA cookie de sesión válida ahora es el
  // JWT firmado por NextAuth. `buildClearCookies` sigue borrando la
  // legacy en logout para limpiar navegadores con sesiones viejas.
  return [jwtCookie];
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
