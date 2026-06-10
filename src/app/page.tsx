'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { LoginForm } from '@/components/auth/login-form';
import { AdminLayout } from '@/components/layout/admin-layout';
import { EmployeeLayout } from '@/components/layout/employee-layout';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const { user, isAuthenticated, isLoading, checkAuth, logout } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);
  const [showDownloadBanner, setShowDownloadBanner] = useState(true);

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

  return (
    <>
      {/* Download Banner - floating at the top */}
      {showDownloadBanner && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-primary text-primary-foreground py-2 px-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" />
            <span>Descarga el proyecto para deploy en Vercel:</span>
          </div>
          <div className="flex items-center gap-2">
            <a href="/api/download" download="control-de-asistencia.zip">
              <Button size="sm" variant="secondary" className="h-7 text-xs">
                <Download className="w-3 h-3 mr-1" />
                Descargar ZIP
              </Button>
            </a>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => setShowDownloadBanner(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {!isAuthenticated || !user ? (
        <LoginForm />
      ) : user.role === 'ADMIN' ? (
        <AdminLayout />
      ) : (
        <EmployeeLayout />
      )}
    </>
  );
}
