import { NextRequest, NextResponse } from 'next/server';

/**
 * Get the current authenticated user from the request.
 * Checks both cookie and Authorization header to support iframe contexts
 * where third-party cookies may be blocked.
 */
export function getAuthenticatedUser(request: NextRequest) {
  // Try cookie first
  const cookie = request.cookies.get('session_user');
  if (cookie) {
    try {
      return JSON.parse(cookie.value);
    } catch {
      // Cookie is invalid, try header
    }
  }

  // Try Authorization header as fallback (for iframe/third-party cookie scenarios)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const payload = authHeader.substring(7);
      return JSON.parse(decodeURIComponent(payload));
    } catch {
      // Header is invalid
    }
  }

  return null;
}

/**
 * Return a 401 response for unauthenticated requests.
 */
export function unauthorizedResponse() {
  return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
}

/**
 * Return a 403 response for unauthorized requests.
 */
export function forbiddenResponse() {
  return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
}
