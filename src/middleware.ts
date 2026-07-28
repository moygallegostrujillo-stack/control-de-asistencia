// ============================================================
// Middleware — Protege /api/* con NextAuth JWT (firmado) + RBAC
// ============================================================
//
// ⚠️ TAREA 3 (AUDIT DE SEGURIDAD):
// Se eliminó `decodeLegacyCookie` y el fallback a cookie `session_user`
// y al header `Authorization: Bearer <base64>`. Eran base64 sin firma
// criptográfica y cualquiera podía fabricarlos con `role: "GENERAL_ADMIN"`.
// La ÚNICA fuente de sesión válida ahora es el JWT firmado por NextAuth.
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { CURRENT_PRIVACY_VERSION, PRIVACY_PUBLIC_PATHS } from '@/lib/privacy';

interface SessionPayload {
  id: string;
  email: string;
  name: string;
  role: 'GENERAL_ADMIN' | 'SUCURSAL_ADMIN' | 'SUPERVISOR' | 'EMPLOYEE';
  sucursalId: string | null;
  employeeId: string | null;
  // LFPDPPP — flag de consentimiento (formato normalizado).
  privacyAccepted?: boolean;
  privacyVersion?: string;
}

async function parseSession(req: NextRequest): Promise<SessionPayload | null> {
  // ⚠️ Tarea 3 (audit seguridad): la ÚNICA fuente de sesión válida es el
  // JWT firmado por NextAuth (`next-auth.session-token`, HMAC-SHA512 via
  // jose con NEXTAUTH_SECRET). El fallback a cookie legacy `session_user`
  // y al header `Authorization: Bearer <base64>` fue REMOVIDO.
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
      return {
        id: token.id as string,
        email: token.email as string,
        name: token.name as string,
        role: token.role as SessionPayload['role'],
        sucursalId: (token.sucursalId as string) || null,
        employeeId: (token.employeeId as string) || null,
        privacyAccepted: derivedPrivacyAccepted,
        privacyVersion: tokenPrivacyVersion,
      };
    }
  } catch {}

  return null;
}

const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/qr-login',
  '/api/auth/quick-login',
  '/api/auth/session',
  '/api/auth/csrf',
  '/api/auth/providers',
  '/api/auth/signin',
  '/api/auth/signout',
  '/api/auth/callback',
  '/api/auth/_log',
  '/api/health',
  '/api/download',
  '/api/diagrama/download',
  '/api/route',
  // ⚠️ Tarea 1 (audit seguridad): /api/download-env y /api/seed REMOVIDOS de
  // rutas públicas. /api/download-env fue eliminado por completo (exponía .env).
  // /api/seed ahora requiere sesión + rol GENERAL_ADMIN (ver handler).
];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Health check raíz
  if (path === '/api' || path === '/api/route') {
    return NextResponse.next();
  }

  // Rutas públicas (auth, health, descargas, seed)
  if (PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }

  // Rutas públicas LFPDPPP (aviso de privacidad, accept, status, mydata*) —
  // mydata requiere sesión pero NO consentimiento (es el derecho de acceso).
  if (PRIVACY_PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }

  // Todo lo demás requiere sesión
  const session = await parseSession(req);
  if (!session) {
    // Si es una ruta API → 401 JSON; si es página → redirect a login.
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/?login=required', req.url));
  }

  // ============================================================
  // LFPDPPP — Validación de consentimiento del Aviso de Privacidad.
  // Si el usuario no ha aceptado la versión vigente, solo puede
  // acceder a /legal/aviso-de-privacidad. Todo lo demás queda bloqueado
  // hasta que acepte (art. 17 — consentimiento informado y expreso).
  // ============================================================
  const hasAcceptedPrivacy =
    session.privacyAccepted === true &&
    session.privacyVersion === CURRENT_PRIVACY_VERSION;

  if (!hasAcceptedPrivacy) {
    // Rutas API → 403 con código específico para que el front muestre modal.
    if (path.startsWith('/api/')) {
      return NextResponse.json(
        {
          error: 'Debe aceptar el Aviso de Privacidad para continuar.',
          code: 'PRIVACY_CONSENT_REQUIRED',
          currentVersion: CURRENT_PRIVACY_VERSION,
        },
        { status: 403 }
      );
    }
    // Páginas → redirect a la página del aviso con ?required=1.
    const url = req.nextUrl.clone();
    url.pathname = '/legal/aviso-de-privacidad';
    url.search = '?required=1';
    return NextResponse.redirect(url);
  }

  const role = session.role;
  // SUPERVISOR is intentionally NOT promoted here: they get the same
  // mutation restrictions as EMPLOYEE (no POST/PUT/DELETE on protected
  // resources) but can still GET any endpoint that an authenticated user
  // can read. Per-endpoint handlers enforce finer-grained scoping
  // (e.g. getSucursalFilter scopes queries to their sucursalId).
  const isGeneralAdmin = role === 'GENERAL_ADMIN';
  const isSucursalAdmin = role === 'SUCURSAL_ADMIN';
  const method = req.method;

  // /api/users → solo GENERAL_ADMIN (todos los métodos).
  if (path.startsWith('/api/users')) {
    if (!isGeneralAdmin) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
    }
  }

  // /api/company y /api/holidays → solo GENERAL_ADMIN en mutaciones
  // (POST/PUT/DELETE/PATCH). El GET es libre para cualquier usuario
  // autenticado (la lectura de datos de empresa y días feriados no es
  // sensible). La protección por método se mantiene aquí en middleware
  // y se revalida dentro de cada handler.
  if (
    path.startsWith('/api/company') ||
    path.startsWith('/api/holidays')
  ) {
    if (method !== 'GET' && !isGeneralAdmin) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
    }
  }

  // /api/sucursales POST/DELETE → solo GENERAL_ADMIN
  if (path.startsWith('/api/sucursales')) {
    if ((method === 'POST' || method === 'DELETE') && !isGeneralAdmin) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
    }
  }

  // /api/employees DELETE y /transfer → solo GENERAL_ADMIN
  if (path.startsWith('/api/employees')) {
    if (method === 'DELETE' && !isGeneralAdmin) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
    }
    if (path.endsWith('/transfer') && !isGeneralAdmin) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
    }
  }

  // /api/reports/comparative → solo GENERAL_ADMIN
  if (path.startsWith('/api/reports/comparative') && !isGeneralAdmin) {
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
  }

  // /api/attendance/justify → SUCURSAL_ADMIN+
  // /api/attendance/[id] (cuid de 20+ chars) → SUCURSAL_ADMIN+
  // Las rutas con nombre (today, history, check-in, meal-start, check-out, etc.)
  // NO se bloquean aquí — cada handler valida permisos internamente.
  const attendanceMatch = path.match(/^\/api\/attendance\/([^/]+)$/);
  const isCuid = attendanceMatch && attendanceMatch[1].length >= 20 && /^[a-z0-9]+$/i.test(attendanceMatch[1]);
  if (
    path.startsWith('/api/attendance/justify') ||
    (attendanceMatch && isCuid)
  ) {
    if (!isGeneralAdmin && !isSucursalAdmin) {
      return NextResponse.json({ error: 'Prohibido' }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
