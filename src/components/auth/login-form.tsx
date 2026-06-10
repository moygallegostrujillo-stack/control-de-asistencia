'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Clock, QrCode, Shield, LogIn, Users, Building2, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QuickUser {
  id: string;
  name: string;
  email: string;
  role: string;
  employee: {
    id: string;
    department: string;
    sucursal: string;
    position: string;
  } | null;
}

export function LoginForm() {
  const { login, setUser } = useAuthStore();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('password');
  const [quickUsers, setQuickUsers] = useState<QuickUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [quickLoading, setQuickLoading] = useState<string | null>(null);

  // Fetch users list on mount for quick login
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch('/api/auth/users-list');
        if (res.ok) {
          const data = await res.json();
          setQuickUsers(data.users || []);
        }
      } catch {
        // Silently fail - quick login is optional
      }
      setLoadingUsers(false);
    };
    fetchUsers();
  }, []);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Error', description: 'Ingrese email y contraseña', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) {
      toast({ title: 'Error de acceso', description: result.error, variant: 'destructive' });
    }
  };

  const handleQuickLogin = async (user: QuickUser) => {
    setQuickLoading(user.id);
    try {
      const res = await fetch('/api/auth/quick-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Set the user in the store directly
        setUser(data.user);
        toast({
          title: `Bienvenido, ${user.name}`,
          description: 'Acceso rápido exitoso',
        });
      } else {
        toast({ title: 'Error', description: data.error || 'No se pudo iniciar sesión', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
    setQuickLoading(null);
  };

  const admins = quickUsers.filter(u => u.role === 'ADMIN');
  const employees = quickUsers.filter(u => u.role === 'EMPLOYEE');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl overflow-hidden mb-4 shadow-lg">
            <img src="/attendance-logo.png" alt="Control de Asistencia" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Control de Asistencia</h1>
          <p className="text-muted-foreground mt-1">Sistema de Registro Diario de Asistencias</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Login Form */}
          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="password" className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Contraseña
                  </TabsTrigger>
                  <TabsTrigger value="qr" className="flex items-center gap-2">
                    <QrCode className="w-4 h-4" />
                    Código QR
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="password" className="mt-4">
                  <CardTitle className="text-lg">Iniciar Sesión</CardTitle>
                  <CardDescription>Ingrese sus credenciales para acceder al sistema</CardDescription>
                </TabsContent>
                
                <TabsContent value="qr" className="mt-4">
                  <CardTitle className="text-lg">Acceso con QR</CardTitle>
                  <CardDescription>Escanee el código QR dinámico del terminal</CardDescription>
                </TabsContent>
              </Tabs>
            </CardHeader>

            <CardContent>
              {activeTab === 'password' ? (
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="correo@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                        Verificando...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <LogIn className="w-4 h-4" />
                        Iniciar Sesión
                      </div>
                    )}
                  </Button>
                </form>
              ) : (
                <QRLoginTab />
              )}
            </CardContent>
          </Card>

          {/* Right: Quick Access */}
          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Acceso Rápido</CardTitle>
                  <CardDescription>Haga clic en su nombre para ingresar directamente</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 rounded-full border-3 border-primary border-t-transparent animate-spin" />
                </div>
              ) : quickUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No hay usuarios disponibles</p>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-3 pr-2">
                    {/* Admin Section */}
                    {admins.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Administradores</p>
                        <div className="space-y-2">
                          {admins.map(user => (
                            <button
                              key={user.id}
                              onClick={() => handleQuickLogin(user)}
                              disabled={quickLoading !== null}
                              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent hover:border-primary/30 transition-colors text-left disabled:opacity-50"
                            >
                              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <Shield className="w-4 h-4 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{user.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                              </div>
                              {quickLoading === user.id && (
                                <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {admins.length > 0 && employees.length > 0 && (
                      <Separator className="my-2" />
                    )}

                    {/* Employees Section */}
                    {employees.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Empleados</p>
                        <div className="space-y-2">
                          {employees.map(user => (
                            <button
                              key={user.id}
                              onClick={() => handleQuickLogin(user)}
                              disabled={quickLoading !== null}
                              className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent hover:border-primary/30 transition-colors text-left disabled:opacity-50"
                            >
                              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-semibold text-amber-700">{user.name.charAt(0)}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{user.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {user.employee?.department || ''}{user.employee?.sucursal ? ` · ${user.employee.sucursal}` : ''}
                                </p>
                              </div>
                              {quickLoading === user.id && (
                                <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-3 h-3" />
            <span>Registros inalterables · Trazabilidad completa · NOM-037</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function QRLoginTab() {
  const { login } = useAuthStore();
  const { toast } = useToast();
  const [qrCode, setQrCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [dynamicQR, setDynamicQR] = useState<{ qrDataUrl: string; expiresAt: string } | null>(null);

  const fetchDynamicQR = async () => {
    try {
      const res = await fetch('/api/qr/dynamic');
      const data = await res.json();
      if (data.qrDataUrl && data.expiresAt) {
        setDynamicQR({ qrDataUrl: data.qrDataUrl, expiresAt: data.expiresAt });
      } else {
        toast({ title: 'Error', description: data.error || data.details || 'No se pudo generar el código QR', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo generar el código QR', variant: 'destructive' });
    }
  };

  const handleQRLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrCode.trim()) {
      toast({ title: 'Error', description: 'Ingrese el código QR', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/qr-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'QR Válido', description: 'Código QR validado. Use su contraseña para iniciar sesión.' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-3">
          Los códigos QR dinámicos se generan en el terminal de asistencia. 
          Para iniciar sesión, use su contraseña.
        </p>
        <Button variant="outline" size="sm" onClick={fetchDynamicQR} className="mb-3">
          <QrCode className="w-4 h-4 mr-2" />
          Generar QR de Terminal
        </Button>
        {dynamicQR && (
          <div className="flex flex-col items-center gap-2">
            <img src={dynamicQR.qrDataUrl} alt="QR Dinámico" className="w-48 h-48 rounded-lg border" />
            <p className="text-xs text-muted-foreground">
              Expira: {new Date(dynamicQR.expiresAt).toLocaleTimeString('es-MX')}
            </p>
          </div>
        )}
      </div>
      
      <div className="border-t pt-4">
        <p className="text-sm text-muted-foreground mb-2">O ingrese código manualmente:</p>
        <form onSubmit={handleQRLogin} className="space-y-3">
          <Input
            placeholder="Código QR"
            value={qrCode}
            onChange={(e) => setQrCode(e.target.value)}
            disabled={loading}
          />
          <Button type="submit" variant="secondary" className="w-full" disabled={loading}>
            {loading ? 'Verificando...' : 'Validar QR'}
          </Button>
        </form>
      </div>
    </div>
  );
}
