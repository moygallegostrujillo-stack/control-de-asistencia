import { NextRequest } from 'next/server';

/**
 * Helper para extraer IP y User-Agent desde un NextRequest.
 * (Re-exportado desde audit.ts para mantener compatibilidad.)
 */
export { getIpAndUA } from './audit';

// ============================================================
// Auto-refresh del JWT cuando el middleware responde 403
// PRIVACY_CONSENT_REQUIRED.
//
// Problema que resuelve:
//   Si un usuario tenía un JWT viejo con privacyAccepted=false (emitido
//   antes de que el admin marcara su consentimiento en la BD, p.ej. vía
//   el SQL fix-privacy-consent.sql), el middleware bloquea TODAS las
//   APIs con 403. El usuario ve "Error al cargar datos: Debe aceptar el
//   Aviso de Privacidad" en todas las pestañas.
//
//   Con este auto-refresh, al detectar el 403, el frontend llama
//   automáticamente a /api/auth/refresh (que re-emite el JWT con los
//   datos frescos de la BD, incluyendo privacyAccepted=true). Luego
//   reintenta la petición original, que ahora pasa el middleware.
//
//   Si el refresh también falla (p.ej. el usuario de verdad no ha
//   aceptado el aviso), se redirige a /legal/aviso-de-privacidad.
// ============================================================

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  // Evitar múltiples refreshes simultáneos
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) return false;
      const data = await res.json();
      // Actualizar el payload en localStorage si el refresh incluyó el usuario
      if (data?.user) {
        try {
          // Mantener compatibilidad con auth-store: guardar el payload fresco
          localStorage.setItem('auth-payload', JSON.stringify(data.user));
        } catch {
          // ignore
        }
      }
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
    }
  })();

  return refreshPromise;
}

/**
 * Wrapper de fetch que añade el header Authorization: Bearer <payload>
 * a partir del usuario autenticado guardado en el store.
 *
 * Además, detecta el 403 PRIVACY_CONSENT_REQUIRED y auto-refresca el JWT.
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

  const res = await fetch(url, { ...options, headers });

  // Detectar 403 PRIVACY_CONSENT_REQUIRED y auto-refrescar el JWT.
  // Solo si la URL no es ya /api/auth/refresh o /api/user/privacy/*
  // (para evitar loops infinitos).
  if (res.status === 403) {
    try {
      const body = await res.clone().json();
      if (body?.code === 'PRIVACY_CONSENT_REQUIRED') {
        // No auto-refrescar si la petición ya es a un endpoint de privacy o auth
        const isPrivacyOrAuthEndpoint =
          url.startsWith('/api/auth/refresh') ||
          url.startsWith('/api/user/privacy') ||
          url.startsWith('/api/auth/login') ||
          url.startsWith('/api/auth/logout');

        if (!isPrivacyOrAuthEndpoint) {
          const refreshed = await refreshSession();
          if (refreshed) {
            // Reintentar la petición original con el JWT nuevo.
            // Las cookies httpOnly se envían automáticamente; el header
            // Authorization se reconstruye con el payload actualizado.
            let newAuthHeader = '';
            try {
              const stored = localStorage.getItem('auth-payload');
              if (stored) {
                newAuthHeader = `Bearer ${btoa(stored)}`;
              }
            } catch {
              // ignore
            }
            const retryHeaders: Record<string, string> = {
              'Content-Type': 'application/json',
              ...(options.headers as Record<string, string> || {}),
            };
            if (newAuthHeader) {
              retryHeaders['Authorization'] = newAuthHeader;
            }
            const retryRes = await fetch(url, { ...options, headers: retryHeaders });

            // Si el reintento SIGUE dando 403 PRIVACY_CONSENT_REQUIRED,
            // significa que el usuario realmente no ha aceptado el aviso
            // (el refresh re-emite el JWT pero privacyAccepted sigue false).
            // En ese caso, redirigir a la página del aviso para que acepte.
            if (retryRes.status === 403) {
              try {
                const retryBody = await retryRes.clone().json();
                if (retryBody?.code === 'PRIVACY_CONSENT_REQUIRED') {
                  if (typeof window !== 'undefined') {
                    window.location.href = '/legal/aviso-de-privacidad?required=1';
                  }
                }
              } catch {
                // no parseable — retornar la respuesta
              }
            }
            return retryRes;
          } else {
            // El refresh falló: el usuario realmente no ha aceptado.
            // Redirigir a la página del aviso de privacidad.
            if (typeof window !== 'undefined') {
              window.location.href = '/legal/aviso-de-privacidad?required=1';
            }
          }
        }
      }
    } catch {
      // Si no se puede parsear el body, retornar la respuesta original
    }
  }

  return res;
}
