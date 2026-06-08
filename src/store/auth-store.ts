import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'EMPLOYEE';
  employee: {
    id: string;
    employeeNumber: string;
    position: string;
    department: string;
    sucursal: string;
  } | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const SESSION_KEY = 'attendance_session';

function saveSession(user: User) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } catch {
    // localStorage not available
  }
}

function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // localStorage not available
  }
}

function loadSession(): User | null {
  try {
    const data = localStorage.getItem(SESSION_KEY);
    if (data) return JSON.parse(data);
  } catch {
    // localStorage not available or invalid data
  }
  return null;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error };
      }

      // Save to localStorage for persistence across page reloads
      saveSession(data.user);
      set({ user: data.user, isAuthenticated: true });
      return { success: true };
    } catch {
      return { success: false, error: 'Error de conexión' };
    }
  },

  logout: async () => {
    try {
      // Import authFetch dynamically to avoid circular deps
      const { authFetch } = await import('@/lib/fetch-helper');
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors
    } finally {
      clearSession();
      set({ user: null, isAuthenticated: false });
    }
  },

  checkAuth: async () => {
    // Always try to refresh from server first (to get latest employee data)
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          saveSession(data.user);
          set({ user: data.user, isAuthenticated: true, isLoading: false });
          return;
        }
      }
    } catch {
      // Server check failed, try localStorage
    }

    // Fallback: restore from localStorage
    const localUser = loadSession();
    if (localUser) {
      set({ user: localUser, isAuthenticated: true, isLoading: false });
      return;
    }

    set({ user: null, isAuthenticated: false, isLoading: false });
  },
}));
