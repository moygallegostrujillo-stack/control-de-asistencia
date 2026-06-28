// ============================================================
// Middleware — Protege /api/* con cookie session_user + RBAC
// ============================================================

import { NextResponse, type NextRequest } from 'next/server';

interface SessionPayload {
  id: string;
  email: string;
  name: string;
  role: 'GENERAL_ADMIN' | 'SUCURSAL_ADMIN' | 'EMPLOYEE';
  sucursalId: string | null;
  employeeId: string | null;
}

function parseSession(req: NextRequest): SessionPayload | null {
  // 1. Cookie
  const cookie = req.cookies.get('session_user')?.value;
  if (cookie) {
    try {
      const json = Buffer.from(cookie, 'base64').toString('utf-8');
      const payload = JSON.parse(json);
      if (payload.id && payload.role) return payload;
    } catch {}
  }
  // 2. Authorization header Bearer <base64>
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const json = Buffer.from(authHeader.slice(7), 'base64').toString('utf-8');
      const payload = JSON.parse(json);
      if (payload.id && payload.role) return payload;
    } catch {}
  }
  return null;
}

const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/qr-login',
  '/api/auth/quick-login',
  '/api/health',
  '/api/seed',
  '/api/download',
  '/api/download-env',
  '/api/route',
];

export function middleware(req: NextRequest) {
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
  const session = parseSession(req);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const role = session.role;
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

  // /api/attendance/justify y /api/attendance/[id] PUT → SUCURSAL_ADMIN+
  if (
    path.startsWith('/api/attendance/justify') ||
    path.match(/^\/api\/attendance\/[^/]+$/)
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
