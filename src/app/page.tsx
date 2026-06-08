'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { LoginForm } from '@/components/auth/login-form';
import { AdminLayout } from '@/components/layout/admin-layout';
import { EmployeeLayout } from '@/components/layout/employee-layout';

export default function Home() {
  const { user, isAuthenticated, isLoading, checkAuth, logout } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkAuth().finally(() => setAuthChecked(true));
  }, [checkAuth]);

  // Global 401 handler - if any API call returns 401, force logout
  useEffect(() => {
    const originalFetch = window.fetch;
    let consecutive401s = 0;

    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);

      if (response.status === 401) {
        consecutive401s++;
        // If we get 3 consecutive 401s, force logout and reload
        if (consecutive401s >= 3) {
          consecutive401s = 0;
          document.cookie = 'session_user=; path=/; max-age=0';
          window.location.reload();
        }
      } else {
        consecutive401s = 0;
      }

      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  if (isLoading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <LoginForm />;
  }

  if (user.role === 'ADMIN') {
    return <AdminLayout />;
  }

  return <EmployeeLayout />;
}
