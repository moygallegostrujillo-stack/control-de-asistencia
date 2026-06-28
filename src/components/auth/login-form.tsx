'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, QrCode, LogIn, Users, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';

interface QuickUser {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeNumber?: string;
  sucursalName?: string | null;
}

export function LoginForm() {
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quickUsers, setQuickUsers] = useState<QuickUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Cargar lista de usuarios para quick access
  useEffect(() => {
    setLoadingUsers(true);
    fetch('/api/auth/users-list')
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((data) => setQuickUsers(data.users || []))
      .catch(() => setQuickUsers([]))
      .finally(() => setLoadingUsers(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Email y contraseña son obligatorios');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Error al iniciar sesión');
        return;
      }
      setUser(data.user);
      toast.success(`Bienvenido, ${data.user.name}`);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (userId: number | string, userName: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/quick-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Error');
        return;
      }
      setUser(data.user);
      toast.success(`Acceso rápido: ${userName}`);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="border-zinc-200 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white">
              <LogIn className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl font-bold text-zinc-900">
              Control de Asistencia
            </CardTitle>
            <p className="text-sm text-zinc-500">NOM-037-STPS-2023</p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="password" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="password" className="gap-2">
                  <Lock className="h-4 w-4" /> Contraseña
                </TabsTrigger>
                <TabsTrigger value="quick" className="gap-2">
                  <Users className="h-4 w-4" /> Acceso rápido
                </TabsTrigger>
              </TabsList>

              <TabsContent value="password" className="mt-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@control.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-9"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-9 pr-9"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Iniciando...' : 'Iniciar sesión'}
                  </Button>
                </form>

                <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
                  <p className="font-semibold mb-1">Credenciales de prueba:</p>
                  <p>• <span className="font-mono">admin@control.com</span> / Admin#2025</p>
                  <p>• <span className="font-mono">admin.matriz@control.com</span> / Matriz#2025</p>
                  <p>• <span className="font-mono">admin.sucursal1@control.com</span> / Suc1#2025</p>
                  <p>• <span className="font-mono">ana.lopez@control.com</span> / Empleado#2025</p>
                </div>
              </TabsContent>

              <TabsContent value="quick" className="mt-4">
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {loadingUsers ? (
                    <p className="text-center text-sm text-zinc-500 py-8">Cargando usuarios...</p>
                  ) : quickUsers.length === 0 ? (
                    <p className="text-center text-sm text-zinc-500 py-8">No hay usuarios disponibles</p>
                  ) : (
                    quickUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => handleQuickLogin(u.id, u.name)}
                        disabled={loading}
                        className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 p-3 text-left transition hover:bg-zinc-50 disabled:opacity-50"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">{u.name}</p>
                          <p className="text-xs text-zinc-500 truncate">
                            {u.role === 'GENERAL_ADMIN'
                              ? 'Admin General'
                              : u.role === 'SUCURSAL_ADMIN'
                              ? `Admin ${u.sucursalName || 'Sucursal'}`
                              : u.employeeNumber
                              ? `Empleado ${u.employeeNumber}`
                              : 'Empleado'}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-zinc-400" />
                      </button>
                    ))
                  )}
                </div>
                <p className="mt-3 text-center text-xs text-zinc-400 flex items-center justify-center gap-1">
                  <QrCode className="h-3 w-3" /> Modo kiosco — solo para uso interno
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-zinc-400">
          v2.2 · {new Date().getFullYear()} · Control de Asistencia NOM-037
        </p>
      </motion.div>
    </div>
  );
}
