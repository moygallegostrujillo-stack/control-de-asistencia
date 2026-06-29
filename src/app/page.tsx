'use client';

import { useEffect, useState } from 'react';
import { useAuthStore, type SessionUser } from '@/store/auth-store';
import { LoginForm } from '@/components/auth/login-form';
import { AdminLayout } from '@/components/layout/admin-layout';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, setUser, logout, shouldForceLogout, reset401 } = useAuthStore();
  const [checking, setChecking] = useState(true);

  // Verificar sesión al montar
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', {
          credentials: 'include',
        });
        if (mounted) {
          if (res.ok) {
            const data = await res.json();
            if (data.user) {
              setUser(data.user as SessionUser);
            } else {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        }
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [setUser]);

  // Logout forzado por 401s consecutivos
  useEffect(() => {
    if (shouldForceLogout) {
      (async () => {
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } catch {}
      })();
      logout();
    }
  }, [shouldForceLogout, logout]);

  // Listener global para 401
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.status === 401) {
        useAuthStore.getState().increment401();
      } else {
        useAuthStore.getState().reset401();
      }
    };
    window.addEventListener('auth:response', handler);
    return () => window.removeEventListener('auth:response', handler);
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  if (
    user.role === 'GENERAL_ADMIN' ||
    user.role === 'SUCURSAL_ADMIN' ||
    user.role === 'SUPERVISOR'
  ) {
    return <AdminLayout />;
  }

  return <EmployeeLayout />;
}
