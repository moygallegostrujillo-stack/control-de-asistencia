// ============================================================
// Middleware — Protege /api/* con NextAuth JWT + RBAC
// (con fallback a cookie legacy para transición)
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

interface SessionPayload {
  id: string;
  email: string;
  name: string;
  role: 'GENERAL_ADMIN' | 'SUCURSAL_ADMIN' | 'SUPERVISOR' | 'EMPLOYEE';
  sucursalId: string | null;
  employeeId: string | null;
}

function decodeLegacyCookie(cookie: string): SessionPayload | null {
  try {
    const json = Buffer.from(cookie, 'base64').toString('utf-8');
    const payload = JSON.parse(json);
    if (payload && payload.id && payload.role) return payload;
  } catch {}
  return null;
}

async function parseSession(req: NextRequest): Promise<SessionPayload | null> {
  // 1. NextAuth JWT (firmado, seguro) — preferido
  try {
    const token = await getToken({
      req: req as any,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (token && token.id && token.role) {
      return {
        id: token.id as string,
        email: token.email as string,
        name: token.name as string,
        role: token.role as SessionPayload['role'],
        sucursalId: (token.sucursalId as string) || null,
        employeeId: (token.employeeId as string) || null,
      };
    }
  } catch {}

  // 2. Cookie legacy `session_user` (base64, transición)
  const cookie = req.cookies.get('session_user')?.value;
  if (cookie) {
    const payload = decodeLegacyCookie(cookie);
    if (payload) return payload;
  }

  // 3. Authorization header Bearer <base64> (legacy, mobile/CLI)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const payload = decodeLegacyCookie(authHeader.slice(7));
    if (payload) return payload;
  }

  return null;
}

const PUBLIC_PATHS = [
  '/api/auth/login',
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
  '/api/seed',
  '/api/download',
  '/api/download-env',
  '/api/diagrama/download',
  '/api/route',
];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Health check raíz
  if (path === '/api' || path === '/api/route') {
    return NextResponse.next();
  }

  // Rutas públicas
  if (PUBLIC_PATHS.some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }

  // Todo lo demás requiere sesión
  const session = await parseSession(req);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
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
