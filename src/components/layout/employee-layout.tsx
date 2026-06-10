'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore, type EmployeeView } from '@/store/app-store';
import { useAsyncData } from '@/hooks/use-async-data';
import { authFetch } from '@/lib/fetch-helper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  LogOut, Clock, LogIn, QrCode, History, MapPin,
  CheckCircle2, XCircle, AlertTriangle, Timer, RefreshCw,
  Navigation, Fingerprint, Building2, AlertOctagon
} from 'lucide-react';

// ==================== STATUS BADGE ====================
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    PRESENT: { label: 'Presente', className: 'bg-green-100 text-green-800' },
    LATE: { label: 'Retardo', className: 'bg-amber-100 text-amber-800' },
    ABSENT: { label: 'Ausente', className: 'bg-red-100 text-red-800' },
    EARLY_LEAVE: { label: 'Salida Anticipada', className: 'bg-orange-100 text-orange-800' },
  };
  const c = config[status] || { label: status, className: '' };
  return <Badge className={c.className}>{c.label}</Badge>;
}

// ==================== CURRENT TIME ====================
function CurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);
  return <h2 className="text-4xl font-mono font-bold tabular-nums">{format(time, 'HH:mm:ss')}</h2>;
}

// ==================== BREAK TIMER ====================
function BreakTimer({ startTime, minMinutes }: { startTime: string; minMinutes: number }) {
  const [elapsed, setElapsed] = useState(0);
  const [canEnd, setCanEnd] = useState(false);

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const update = () => {
      const now = Date.now();
      const diff = Math.floor((now - start) / 1000);
      setElapsed(diff);
      setCanEnd(diff >= minMinutes * 60);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startTime, minMinutes]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="text-center space-y-2">
      <div className="text-2xl font-mono font-bold text-orange-600">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
      <p className="text-xs text-muted-foreground">
        {canEnd
          ? '✅ Tiempo mínimo cumplido. Puede terminar.'
          : `⏳ Faltan ${minMinutes - minutes - 1} min ${60 - seconds} seg para completar los ${minMinutes} minutos mínimos.`
        }
      </p>
      {!canEnd && (
        <div className="w-full bg-orange-100 rounded-full h-2 mt-1">
          <div
            className="bg-orange-500 h-2 rounded-full transition-all duration-1000"
            style={{ width: `${Math.min(100, (elapsed / (minMinutes * 60)) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ==================== EMPLOYEE NAVIGATION ====================
function EmployeeNav({ currentView, setCurrentView }: { currentView: EmployeeView; setCurrentView: (v: EmployeeView) => void }) {
  const { user, logout } = useAuthStore();
  const navItems: { id: EmployeeView; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Registrar', icon: <Fingerprint className="w-5 h-5" /> },
    { id: 'history', label: 'Historial', icon: <History className="w-5 h-5" /> },
    { id: 'my-qr', label: 'Mi QR', icon: <QrCode className="w-5 h-5" /> },
  ];

  return (
    <header className="fixed bottom-0 left-0 right-0 bg-card border-t z-30 md:bottom-auto md:top-0">
      <div className="flex items-center justify-between max-w-4xl mx-auto px-4 h-16">
        <div className="hidden md:flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden">
            <img src="/attendance-logo.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">Mi Asistencia</h1>
            <p className="text-xs text-muted-foreground">{user?.name}</p>
          </div>
        </div>
        <nav className="flex items-center gap-1 md:gap-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                currentView === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {item.icon}
              <span className="hidden md:inline">{item.label}</span>
            </button>
          ))}
        </nav>
        <Button variant="ghost" size="sm" onClick={logout} className="hidden md:flex">
          <LogOut className="w-4 h-4 mr-2" />Salir
        </Button>
      </div>
    </header>
  );
}

// ==================== EMPLOYEE CHECK-IN/OUT ====================
function EmployeeDashboard() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [startingBreak, setStartingBreak] = useState(false);
  const [endingBreak, setEndingBreak] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showQRInput, setShowQRInput] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: todayData, loading } = useAsyncData(async () => {
    const res = await authFetch('/api/attendance/today');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Error al cargar datos de asistencia');
    }
    return res.json();
  }, [refreshKey]);

  const todayRecord = todayData?.record || null;
  const schedule = todayData?.schedule || null;
  
  const hasEmployeeRecord = !!user?.employee?.id;

  const getLocation = useCallback((): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('La geolocalización no está disponible en este dispositivo'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(new Error(`Error de geolocalización: ${err.message}`)),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  useEffect(() => {
    getLocation().then(loc => setLocation(loc)).catch(err => setLocationError(err.message));
  }, [getLocation]);

  const handleCheckIn = async (method: 'PASSWORD' | 'QR') => {
    let loc = location;
    if (!loc) {
      try { loc = await getLocation(); setLocation(loc); } catch (err) {
        const error = err instanceof Error ? err.message : 'Error de geolocalización';
        setLocationError(error);
        toast({ title: 'Geolocalización requerida', description: error, variant: 'destructive' });
        return;
      }
    }
    if (method === 'QR' && !qrCode.trim()) {
      toast({ title: 'Error', description: 'Escanee o ingrese un código QR', variant: 'destructive' });
      return;
    }
    setCheckingIn(true);
    try {
      const res = await authFetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: user?.employee?.id || undefined,
          latitude: loc.lat,
          longitude: loc.lng,
          method,
          qrCode: method === 'QR' ? qrCode : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Entrada registrada', description: `Registrado a las ${format(new Date(data.record.checkInTime), 'HH:mm:ss')}` });
        setRefreshKey(k => k + 1);
        setShowQRInput(false);
        setQrCode('');
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
    setCheckingIn(false);
  };

  const handleCheckOut = async (method: 'PASSWORD' | 'QR') => {
    let loc = location;
    if (!loc) {
      try { loc = await getLocation(); setLocation(loc); } catch (err) {
        const error = err instanceof Error ? err.message : 'Error de geolocalización';
        toast({ title: 'Geolocalización requerida', description: error, variant: 'destructive' });
        return;
      }
    }
    if (method === 'QR' && !qrCode.trim()) {
      toast({ title: 'Error', description: 'Escanee o ingrese un código QR', variant: 'destructive' });
      return;
    }
    setCheckingOut(true);
    try {
      const res = await authFetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: user?.employee?.id || undefined,
          latitude: loc.lat,
          longitude: loc.lng,
          method,
          qrCode: method === 'QR' ? qrCode : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Salida registrada', description: `Registrado a las ${format(new Date(data.record.checkOutTime), 'HH:mm:ss')}` });
        setRefreshKey(k => k + 1);
        setShowQRInput(false);
        setQrCode('');
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
    setCheckingOut(false);
  };

  // ---- Break handlers ----
  const handleBreakStart = async () => {
    setStartingBreak(true);
    try {
      const res = await authFetch('/api/attendance/break-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: user?.employee?.id || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: 'Descanso iniciado',
          description: data.message || 'Se ha registrado el inicio de su descanso. Mínimo 30 minutos.',
        });
        setRefreshKey(k => k + 1);
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
    setStartingBreak(false);
  };

  const handleBreakEnd = async () => {
    setEndingBreak(true);
    try {
      const res = await authFetch('/api/attendance/break-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: user?.employee?.id || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: data.exceededBreak ? '⚠️ Descanso terminado con exceso' : 'Descanso terminado',
          description: data.message || `Duración: ${data.breakDuration} min`,
          variant: data.exceededBreak ? 'destructive' : 'default',
        });
        setRefreshKey(k => k + 1);
      } else {
        toast({ title: 'No se puede terminar el descanso', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
    setEndingBreak(false);
  };

  // ---- State derivations ----
  const record = todayRecord as {
    checkInTime: string | null; checkOutTime: string | null;
    status: string; checkInLatitude: number | null; checkInLongitude: number | null;
    checkInMethod: string | null;
    breakStart: string | null; breakEnd: string | null;
    breakDuration: number | null; exceededBreak: boolean;
    mealStart: string | null; mealEnd: string | null;
    mealDuration: number | null; exceededMeal: boolean;
    restStart: string | null; restEnd: string | null;
    restDuration: number | null; exceededRest: boolean;
  } | null;

  const sched = schedule as {
    startTime: string; endTime: string; toleranceMinutes: number;
  } | null;

  const isCheckedIn = !!record?.checkInTime;
  const isCheckedOut = !!record?.checkOutTime;

  // New system: breakStart/breakEnd
  const isOnBreak = !!(record?.breakStart && !record?.breakEnd);
  const breakCompleted = !!(record?.breakStart && record?.breakEnd);

  // Old system backward compat: mealStart/restStart
  const isOnOldMeal = !record?.breakStart && !!record?.mealStart && !record?.mealEnd;
  const isOnOldRest = !record?.breakStart && !!record?.restStart && !record?.restEnd;
  const oldMealCompleted = !record?.breakStart && !!record?.mealStart && !!record?.mealEnd;
  const oldRestCompleted = !record?.breakStart && !!record?.restStart && !!record?.restEnd;
  const oldBreakCompleted = oldMealCompleted && oldRestCompleted;

  // Currently in any break (new or old system)
  const isOnAnyBreak = isOnBreak || isOnOldMeal || isOnOldRest;
  // All breaks completed
  const allBreaksCompleted = breakCompleted || oldBreakCompleted;
  // No breaks started yet
  const noBreaksStarted = !record?.breakStart && !record?.mealStart && !record?.restStart;

  // Determine the effective break start time for the timer
  const effectiveBreakStart = record?.breakStart || record?.mealStart || record?.restStart || null;

  // Determine break duration for display
  const effectiveBreakDuration = record?.breakDuration
    || ((record?.mealDuration || 0) + (record?.restDuration || 0))
    || null;

  // Determine if break was exceeded
  const effectiveExceededBreak = record?.exceededBreak || record?.exceededMeal || record?.exceededRest || false;

  const now = new Date();

  // Calculate shift duration for break eligibility
  let isEligibleForBreak = false;
  if (sched) {
    const [startH, startM] = sched.startTime.split(':').map(Number);
    const [endH, endM] = sched.endTime.split(':').map(Number);
    const shiftMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    isEligibleForBreak = shiftMinutes >= 480; // 8 hours
  }

  // Helper to get break time range string for display
  const getBreakTimeRange = () => {
    if (record?.breakStart) {
      const start = format(new Date(record.breakStart), 'HH:mm');
      const end = record.breakEnd ? format(new Date(record.breakEnd), 'HH:mm') : '—';
      return `${start} - ${end}`;
    }
    // Old system: combine meal + rest
    const mealStart = record?.mealStart ? format(new Date(record.mealStart), 'HH:mm') : null;
    const restEnd = record?.restEnd ? format(new Date(record.restEnd), 'HH:mm') : null;
    if (mealStart && restEnd) return `${mealStart} - ${restEnd}`;
    if (mealStart) return `${mealStart} - —`;
    return '—';
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {/* Missing employee record warning */}
      {!hasEmployeeRecord && user?.role === 'EMPLOYEE' && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertOctagon className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive text-sm">Registro de empleado incompleto</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Su cuenta no tiene un perfil de empleado asociado. Contacte al administrador para que registre su perfil de empleado. Las funciones de asistencia no estarán disponibles.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-center">
        <CurrentTime />
        <p className="text-muted-foreground text-sm mt-1">{format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}</p>
      </div>

      {sched && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /><span className="text-sm">Horario de hoy:</span></div>
              <div className="text-sm font-medium">{sched.startTime} - {sched.endTime}<span className="text-xs text-muted-foreground ml-2">(Tolerancia: {sched.toleranceMinutes} min)</span></div>
            </div>
            {isEligibleForBreak && (
              <div className="flex flex-col gap-1 mt-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Timer className="w-3 h-3" />
                  <span>Descanso: 30 min</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {user?.employee?.sucursal && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Sucursal:</span>
              <span className="text-sm font-medium">{user.employee.sucursal}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main status card */}
      <Card className={
        isOnAnyBreak ? 'border-orange-200 bg-orange-50' :
        isCheckedOut ? 'border-green-200 bg-green-50' :
        isCheckedIn ? 'border-blue-200 bg-blue-50' : ''
      }>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-4"><div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>
          ) : isCheckedOut ? (
            /* ===== COMPLETED DAY ===== */
            <div className="text-center space-y-3">
              <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto" />
              <h2 className="text-xl font-bold text-green-800">Jornada Completada</h2>
              <div className="space-y-1 text-sm text-green-700">
                <p>Entrada: {record?.checkInTime ? format(new Date(record.checkInTime), 'HH:mm:ss') : '—'}</p>
                {(record?.breakStart || record?.mealStart || record?.restStart) && (
                  <p className="flex items-center justify-center gap-1">
                    <Timer className="w-3 h-3" />
                    Descanso: {getBreakTimeRange()}
                    {effectiveBreakDuration ? ` (${effectiveBreakDuration} min)` : ''}
                    {effectiveExceededBreak && <span className="text-red-600 ml-1">⚠️ Exceso</span>}
                  </p>
                )}
                <p>Salida: {record?.checkOutTime ? format(new Date(record.checkOutTime), 'HH:mm:ss') : '—'}</p>
                {record?.checkInLatitude && <p className="text-xs flex items-center justify-center gap-1"><MapPin className="w-3 h-3" />{record.checkInLatitude.toFixed(4)}, {record.checkInLongitude?.toFixed(4)}</p>}
              </div>
            </div>
          ) : isOnAnyBreak ? (
            /* ===== ON BREAK ===== */
            <div className="text-center space-y-4">
              <div className="space-y-2">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                  <Timer className="w-8 h-8 text-amber-600" />
                </div>
                <h2 className="text-xl font-bold text-amber-800">En Descanso</h2>
                <p className="text-sm text-amber-600">Entrada: {record?.checkInTime ? format(new Date(record.checkInTime), 'HH:mm:ss') : '—'}</p>
                <p className="text-sm text-amber-500">Inicio: {effectiveBreakStart ? format(new Date(effectiveBreakStart), 'HH:mm:ss') : '—'}</p>
              </div>

              {effectiveBreakStart && <BreakTimer startTime={effectiveBreakStart} minMinutes={30} />}

              <div className="border-t my-3" />
              <div className="space-y-3">
                <Button
                  className="w-full bg-amber-600 hover:bg-amber-700"
                  size="lg"
                  onClick={handleBreakEnd}
                  disabled={endingBreak}
                >
                  {endingBreak ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                      Registrando...
                    </div>
                  ) : (
                    <><Timer className="w-5 h-5 mr-2" />Terminar Descanso</>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Tiempo mínimo de descanso: 30 minutos
                </p>
              </div>
            </div>
          ) : isCheckedIn ? (
            /* ===== CHECKED IN STATE (not on break) ===== */
            <div className="text-center space-y-4">
              <div className="space-y-2">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto"><LogIn className="w-8 h-8 text-blue-600" /></div>
                <h2 className="text-xl font-bold text-blue-800">En Jornada</h2>
                <p className="text-sm text-blue-600">Entrada registrada: {record?.checkInTime ? format(new Date(record.checkInTime), 'HH:mm:ss') : '—'}</p>
                {record?.checkInLatitude && <p className="text-xs text-blue-500 flex items-center justify-center gap-1"><MapPin className="w-3 h-3" />{record.checkInLatitude.toFixed(4)}, {record.checkInLongitude?.toFixed(4)}</p>}
              </div>

              {/* Completed break info */}
              {allBreaksCompleted && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm space-y-1">
                  <p className="font-medium text-amber-800 flex items-center justify-center gap-1">
                    <Timer className="w-4 h-4" />
                    Descanso completado ({effectiveBreakDuration || 0} min)
                  </p>
                </div>
              )}

              <div className="border-t my-3" />
              <div className="space-y-3">
                {/* Break button - only if eligible for 8h shifts */}
                {isEligibleForBreak && (
                  <div className="space-y-2">
                    {noBreaksStarted ? (
                      <Button
                        variant="outline"
                        className="w-full border-amber-400 text-amber-700 hover:bg-amber-50"
                        size="lg"
                        onClick={handleBreakStart}
                        disabled={startingBreak}
                      >
                        {startingBreak ? (
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
                            Registrando...
                          </div>
                        ) : (
                          <><Timer className="w-5 h-5 mr-2" />Iniciar Descanso (30 min)</>
                        )}
                      </Button>
                    ) : allBreaksCompleted ? (
                      <>
                        <Button
                          variant="outline"
                          className="w-full border-muted text-muted-foreground cursor-not-allowed opacity-50"
                          size="lg"
                          disabled
                        >
                          <Timer className="w-5 h-5 mr-2" />Descanso ya utilizado
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                          Solo se permite un descanso por día
                        </p>
                      </>
                    ) : null}
                  </div>
                )}

                {!isEligibleForBreak && sched && (
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Timer className="w-3 h-3" />
                    Turno menor a 8h — Sin derecho a descanso
                  </p>
                )}

                <Button className="w-full" size="lg" onClick={() => handleCheckOut('PASSWORD')} disabled={checkingOut}>
                  {checkingOut ? <div className="flex items-center gap-2"><div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />Registrando...</div> : <><LogOut className="w-5 h-5 mr-2" />Registrar Fin de Jornada</>}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setShowQRInput(true)}>
                  <QrCode className="w-4 h-4 mr-2" />Registrar Fin de Jornada con QR
                </Button>
              </div>
            </div>
          ) : (
            /* ===== NOT CHECKED IN STATE ===== */
            <div className="text-center space-y-4">
              <div className="space-y-2">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto"><Fingerprint className="w-8 h-8 text-muted-foreground" /></div>
                <h2 className="text-xl font-bold">Registrar Entrada</h2>
                {record?.status === 'LATE' && <Badge className="bg-amber-100 text-amber-800">Registrado con retardo</Badge>}
              </div>
              {locationError && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2"><MapPin className="w-4 h-4 shrink-0" />{locationError}</div>
              )}
              {location && <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Navigation className="w-3 h-3" />Ubicación: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>}
              <div className="space-y-3">
                <Button className="w-full" size="lg" onClick={() => handleCheckIn('PASSWORD')} disabled={checkingIn || !!locationError || !hasEmployeeRecord}>
                  {checkingIn ? <div className="flex items-center gap-2"><div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />Registrando...</div> : <><LogIn className="w-5 h-5 mr-2" />Registrar Entrada</>}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setShowQRInput(true)} disabled={!!locationError || !hasEmployeeRecord}>
                  <QrCode className="w-4 h-4 mr-2" />Registrar Entrada con QR
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showQRInput && (
        <Dialog open={showQRInput} onOpenChange={setShowQRInput}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isCheckedIn ? 'Registrar Fin de Jornada con QR' : 'Registrar Entrada con QR'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Código QR</Label>
                <Input placeholder="Escanee o ingrese el código QR del terminal" value={qrCode} onChange={e => setQrCode(e.target.value)} />
                <p className="text-xs text-muted-foreground">Escanee el código QR mostrado en el terminal de asistencia</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowQRInput(false)}>Cancelar</Button>
                <Button className="flex-1" onClick={() => isCheckedIn ? handleCheckOut('QR') : handleCheckIn('QR')} disabled={checkingIn || checkingOut}>
                  {isCheckedIn ? 'Registrar Fin de Jornada' : 'Registrar Entrada'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ==================== EMPLOYEE HISTORY ====================
function EmployeeHistory() {
  const [period, setPeriod] = useState('month');
  const { data: histData, loading } = useAsyncData(async () => {
    const res = await authFetch(`/api/attendance/history?period=${period}`);
    if (!res.ok) throw new Error('Error');
    return res.json();
  }, [period]);

  const records = histData?.records || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Mi Historial</h2>
        <select value={period} onChange={e => setPeriod(e.target.value)} className="text-sm border rounded-lg px-3 py-1.5 bg-background">
          <option value="week">Esta Semana</option>
          <option value="month">Este Mes</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>
      ) : records.length === 0 ? (
        <Card><CardContent className="p-8 text-center"><History className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No hay registros de asistencia</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {records.map((record: Record<string, unknown>, idx: number) => {
            const r = record as {
              id: string; date: string; checkInTime: string | null; checkOutTime: string | null;
              status: string; checkInLatitude: number | null; checkInLongitude: number | null;
              checkInMethod: string | null;
              breakStart: string | null; breakEnd: string | null;
              breakDuration: number | null; exceededBreak: boolean;
              mealStart: string | null; mealEnd: string | null;
              mealDuration: number | null; exceededMeal: boolean;
              restStart: string | null; restEnd: string | null;
              restDuration: number | null; exceededRest: boolean;
            };
            let workedHours = '—';
            if (r.checkInTime && r.checkOutTime) {
              const diff = (new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime()) / 3600000;
              workedHours = diff.toFixed(2) + 'h';
            }

            // Determine break info for this record
            const hasBreak = !!(r.breakStart || r.mealStart || r.restStart);
            const breakDur = r.breakDuration || ((r.mealDuration || 0) + (r.restDuration || 0)) || 0;
            const breakExceeded = r.exceededBreak || r.exceededMeal || r.exceededRest || false;

            // Get break time range
            let breakTimeRange = '';
            if (r.breakStart) {
              const start = format(new Date(r.breakStart), 'HH:mm');
              const end = r.breakEnd ? format(new Date(r.breakEnd), 'HH:mm') : '—';
              breakTimeRange = `${start} - ${end}`;
            } else if (r.mealStart) {
              const start = format(new Date(r.mealStart), 'HH:mm');
              const end = r.restEnd ? format(new Date(r.restEnd), 'HH:mm') : (r.mealEnd ? format(new Date(r.mealEnd), 'HH:mm') : '—');
              breakTimeRange = `${start} - ${end}`;
            }

            return (
              <Card key={r.id || idx}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{String(r.date).slice(0, 10)}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>🟢 {r.checkInTime ? format(new Date(r.checkInTime), 'HH:mm') : '—'}</span>
                        <span>🔴 {r.checkOutTime ? format(new Date(r.checkOutTime), 'HH:mm') : '—'}</span>
                        <span>⏱️ {workedHours}</span>
                      </div>
                      {hasBreak && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          <p className="font-medium text-amber-700 flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            Descanso: {breakTimeRange}{breakDur ? ` (${breakDur} min)` : ''}
                            {breakExceeded && <span className="text-red-500 ml-1">⚠️</span>}
                          </p>
                        </div>
                      )}
                      {r.checkInLatitude && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{r.checkInLatitude.toFixed(4)}, {r.checkInLongitude?.toFixed(4)}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={r.status} />
                      {r.checkInMethod && <Badge variant="outline" className="text-xs">{r.checkInMethod}</Badge>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ==================== EMPLOYEE QR ====================
function EmployeeMyQR() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [retryKey, setRetryKey] = useState(0);
  const { data: qrData, loading, error } = useAsyncData(async () => {
    if (!user?.employee?.id) return null;
    const res = await authFetch(`/api/employees/${user.employee.id}/qr`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Error al generar QR');
    }
    return res.json();
  }, [user?.employee?.id, retryKey]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Mi Código QR</h2>
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground text-center">Presente este código QR en el terminal de asistencia para registrar su entrada o salida</p>
            {loading ? (
              <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-xl"><div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>
            ) : error ? (
              <div className="w-64 h-64 flex items-center justify-center bg-destructive/10 rounded-xl border border-destructive/20 p-4 text-center">
                <div>
                  <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-2" />
                  <p className="text-sm text-destructive mb-2">{(error instanceof Error ? error.message : String(error)) || 'No se pudo generar el QR'}</p>
                  <Button variant="outline" size="sm" onClick={() => setRetryKey(k => k + 1)}>
                    <RefreshCw className="w-4 h-4 mr-2" />Reintentar
                  </Button>
                </div>
              </div>
            ) : qrData?.qrDataUrl ? (
              <>
                <img src={qrData.qrDataUrl} alt="Mi Código QR" className="w-64 h-64 rounded-xl border-2 shadow-md" />
                <div className="text-center">
                  <p className="font-medium">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">{user?.employee?.employeeNumber} · {user?.employee?.position}</p>
                  <p className="text-sm text-muted-foreground">{user?.employee?.department}</p>
                  <p className="text-sm text-primary flex items-center justify-center gap-1 mt-1"><Building2 className="w-3 h-3" />{user?.employee?.sucursal || 'Matriz'}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  const link = document.createElement('a');
                  link.download = `qr_${user?.name?.replace(/\s+/g, '_')}.png`;
                  link.href = qrData.qrDataUrl;
                  link.click();
                }}>Descargar QR</Button>
              </>
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-xl"><p className="text-muted-foreground">No se pudo generar el QR</p></div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== MAIN EMPLOYEE LAYOUT ====================
export function EmployeeLayout() {
  const { currentView, setCurrentView } = useAppStore();

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <EmployeeDashboard />;
      case 'history': return <EmployeeHistory />;
      case 'my-qr': return <EmployeeMyQR />;
      default: return <EmployeeDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pt-20">
      <EmployeeNav currentView={currentView as EmployeeView} setCurrentView={(v) => setCurrentView(v)} />
      <main className="p-4 max-w-4xl mx-auto">{renderView()}</main>
    </div>
  );
}
