// ============================================================
// Auth Store (Zustand) — gestiona sesión cliente
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'GENERAL_ADMIN' | 'SUCURSAL_ADMIN' | 'EMPLOYEE';
  sucursalId: string | null;
  employeeId: string | null;
  sucursalName?: string | null;
  sucursalCodigoLocal?: string | null;
}

interface AuthState {
  user: SessionUser | null;
  isAuthenticated: boolean;
  consecutive401s: number;
  setUser: (user: SessionUser | null) => void;
  logout: () => void;
  increment401: () => void;
  reset401: () => void;
  setShouldForceLogout: (v: boolean) => void;
  shouldForceLogout: boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      consecutive401s: 0,
      shouldForceLogout: false,
      setUser: (user) => {
        if (user) {
          // Guardar payload para authFetch (base64)
          try {
            localStorage.setItem('auth-payload', JSON.stringify(user));
          } catch {}
        } else {
          try {
            localStorage.removeItem('auth-payload');
          } catch {}
        }
        set({ user, isAuthenticated: !!user });
      },
      logout: () => {
        try {
          localStorage.removeItem('auth-payload');
        } catch {}
        set({ user: null, isAuthenticated: false, consecutive401s: 0, shouldForceLogout: false });
      },
      increment401: () => {
        const count = useAuthStore.getState().consecutive401s + 1;
        set({ consecutive401s: count, shouldForceLogout: count >= 3 });
      },
      reset401: () => set({ consecutive401s: 0, shouldForceLogout: false }),
      setShouldForceLogout: (v) => set({ shouldForceLogout: v }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
