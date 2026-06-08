import { useAuthStore } from '@/store/auth-store';

/**
 * Authenticated fetch wrapper that includes the Authorization header
 * to support iframe contexts where third-party cookies may be blocked.
 * Reads user data directly from the zustand store (in-memory) for reliability.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (typeof window === 'undefined') return fetch(url, options);

  // Read directly from zustand store state (always in sync, no timing issues)
  const state = useAuthStore.getState();
  const headers: Record<string, string> = {};

  // Copy existing headers
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      for (const [key, value] of options.headers) {
        headers[key] = value;
      }
    } else {
      Object.assign(headers, options.headers);
    }
  }

  // Add Authorization header if user is authenticated
  if (state.user) {
    headers['Authorization'] = `Bearer ${encodeURIComponent(JSON.stringify(state.user))}`;
  }

  return fetch(url, { ...options, headers });
}
