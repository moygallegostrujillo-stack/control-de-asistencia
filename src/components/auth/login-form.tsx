'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Clock, QrCode, Shield, LogIn } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function LoginForm() {
  const { login } = useAuthStore();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('password');

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl overflow-hidden mb-4 shadow-lg">
            <img src="/attendance-logo.png" alt="Control de Asistencia" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Control de Asistencia</h1>
          <p className="text-muted-foreground mt-1">Sistema de Registro Diario de Asistencias</p>
        </div>

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
    // For QR login, we validate the code first, then the user needs to use password login
    // QR codes are used for check-in/out, not for session login
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
