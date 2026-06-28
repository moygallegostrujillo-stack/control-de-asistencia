import { NextRequest } from 'next/server';

/**
 * Helper para extraer IP y User-Agent desde un NextRequest.
 * (Re-exportado desde audit.ts para mantener compatibilidad.)
 */
export { getIpAndUA } from './audit';

/**
 * Wrapper de fetch que añade el header Authorization: Bearer <payload>
 * a partir del usuario autenticado guardado en el store.
 *
 * Uso en cliente:
 *   const res = await authFetch('/api/attendance/today', { method: 'GET' });
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Construir payload desde localStorage (definido por auth-store)
  let authHeader = '';
  try {
    const stored = localStorage.getItem('auth-payload');
    if (stored) {
      authHeader = `Bearer ${btoa(stored)}`;
    }
  } catch {
    // ignore
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  return fetch(url, { ...options, headers });
}
