'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore, type AdminView } from '@/store/app-store';
import { useAsyncData } from '@/hooks/use-async-data';
import { authFetch } from '@/lib/fetch-helper';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  LayoutDashboard, Users, CalendarCheck, FileBarChart, Shield, QrCode,
  LogOut, Menu, X, Clock, UserPlus, Download, Search,
  CheckCircle2, XCircle, AlertTriangle, Timer, MapPin,
  ChevronLeft, ChevronRight, RefreshCw, FileSpreadsheet, BookOpen, Building2,
  Pencil, Eye, EyeOff, ArrowRightLeft, Plus, Trash2, PenLine, AlertCircle, Calendar,
  UtensilsCrossed, Armchair
} from 'lucide-react';
import { UserManual } from '@/components/manual/user-manual';

// ==================== ADMIN SIDEBAR ====================
function AdminSidebar() {
  const { user, logout } = useAuthStore();
  const { currentView, setCurrentView, sidebarOpen, setSidebarOpen } = useAppStore();

  const menuItems: { id: AdminView; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Panel Principal', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'employees', label: 'Empleados', icon: <Users className="w-5 h-5" /> },
    { id: 'sucursales', label: 'Sucursales', icon: <Building2 className="w-5 h-5" /> },
    { id: 'attendance', label: 'Asistencias', icon: <CalendarCheck className="w-5 h-5" /> },
    { id: 'reports', label: 'Reportes', icon: <FileBarChart className="w-5 h-5" /> },
    { id: 'audit', label: 'Auditoría', icon: <Shield className="w-5 h-5" /> },
    { id: 'qr-terminal', label: 'Terminal QR', icon: <QrCode className="w-5 h-5" /> },
    { id: 'manual', label: 'Manual', icon: <BookOpen className="w-5 h-5" /> },
  ];

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      
      <aside className={`fixed top-0 left-0 h-full w-64 bg-card border-r z-50 transform transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden">
                  <img src="/attendance-logo.png" alt="Logo" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h2 className="font-semibold text-sm">Control de Asistencia</h2>
                  <p className="text-xs text-muted-foreground">Panel Administrativo</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 py-2">
            <nav className="space-y-1 px-2">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setCurrentView(item.id); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    currentView === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </nav>
          </ScrollArea>

          <div className="p-4 border-t">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">{user?.name?.charAt(0) || 'A'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ==================== STATUS BADGE ====================
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    PRESENT: { label: 'Presente', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
    LATE: { label: 'Retardo', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
    ABSENT: { label: 'Ausente', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
    EARLY_LEAVE: { label: 'Salida Anticipada', className: 'bg-orange-100 text-orange-800 hover:bg-orange-100' },
  };
  const c = config[status] || { label: status, className: '' };
  return <Badge className={c.className}>{c.label}</Badge>;
}

// ==================== ADMIN DASHBOARD ====================
function AdminDashboard() {
  const { toast } = useToast();
  const [sucursalFilter, setSucursalFilter] = useState('all');
  const [correctionRecord, setCorrectionRecord] = useState<CorrectionRecord | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: sucursalesData } = useAsyncData(async () => {
    const res = await authFetch('/api/sucursales');
    if (!res.ok) throw new Error('Error al cargar sucursales');
    return res.json();
  }, []);

  const sucursales = sucursalesData?.sucursales || [];
  // Deduplicate sucursales by name for Select (avoids duplicate key/value error)
  const uniqueSucursales = sucursales.filter((s: { name: string }, i: number, arr: { name: string }[]) =>
    arr.findIndex(x => x.name === s.name) === i
  );

  const { data: dashData, loading, refresh } = useAsyncData(async () => {
    const params = new URLSearchParams();
    if (sucursalFilter !== 'all') params.set('sucursal', sucursalFilter);
    const res = await authFetch(`/api/attendance/today?${params}`);
    if (!res.ok) throw new Error('Error al cargar datos');
    return res.json();
  }, [sucursalFilter, refreshKey]);

  const records = dashData?.records || [];
  const absentList = dashData?.absent || [];
  const stats = { 
    total: dashData?.total || 0, 
    checkedIn: dashData?.checkedIn || 0, 
    absent: (dashData?.absent || []).length 
  };

  const presentCount = records.filter((r: { status: string }) => r.status === 'PRESENT').length;
  const lateCount = records.filter((r: { status: string }) => r.status === 'LATE').length;

  // Break summary computations
  const mealRecords = records.filter((r: Record<string, unknown>) => !!(r as Record<string, unknown>).mealStart);
  const restRecords = records.filter((r: Record<string, unknown>) => !!(r as Record<string, unknown>).restStart);
  const mealCompleted = mealRecords.filter((r: Record<string, unknown>) => !!(r as Record<string, unknown>).mealEnd);
  const restCompleted = restRecords.filter((r: Record<string, unknown>) => !!(r as Record<string, unknown>).restEnd);
  const mealOnGoing = mealRecords.filter((r: Record<string, unknown>) => !(r as Record<string, unknown>).mealEnd);
  const restOnGoing = restRecords.filter((r: Record<string, unknown>) => !(r as Record<string, unknown>).restEnd);
  const mealExceeded = mealCompleted.filter((r: Record<string, unknown>) => (r as Record<string, unknown>).exceededMeal);
  const restExceeded = restCompleted.filter((r: Record<string, unknown>) => (r as Record<string, unknown>).exceededRest);
  const totalMealMinutes = mealCompleted.reduce((sum: number, r: Record<string, unknown>) => sum + ((r as Record<string, unknown>).mealDuration as number || 0), 0);
  const totalRestMinutes = restCompleted.reduce((sum: number, r: Record<string, unknown>) => sum + ((r as Record<string, unknown>).restDuration as number || 0), 0);

  const handleRefresh = async () => {
    try {
      await refresh();
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los datos', variant: 'destructive' });
    }
  };

  const handleCorrectionSaved = () => {
    setCorrectionRecord(null);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header - Stack on mobile, row on desktop */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Panel Principal</h1>
          <p className="text-sm text-muted-foreground mt-1">{format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Select value={sucursalFilter} onValueChange={setSucursalFilter}>
            <SelectTrigger className="w-full sm:w-52">
              <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las Sucursales</SelectItem>
              {uniqueSucursales.map((s: { id: string; name: string; isActive: boolean }) => (
                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards - 2 cols on mobile, 4 on desktop with better spacing */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-blue-700" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight">{stats.total}</p>
                <p className="text-xs text-muted-foreground whitespace-nowrap">Total Empleados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-700" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight">{presentCount}</p>
                <p className="text-xs text-muted-foreground whitespace-nowrap">Presentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight">{lateCount}</p>
                <p className="text-xs text-muted-foreground whitespace-nowrap">Retardos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-5 h-5 text-red-700" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight">{stats.absent}</p>
                <p className="text-xs text-muted-foreground whitespace-nowrap">Ausentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Table Card - with horizontal scroll for narrow screens */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Asistencias de Hoy</CardTitle>
          <CardDescription>Registro de entradas y salidas del día</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
          ) : records.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay registros de asistencia hoy</p>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="min-w-[1020px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[140px]">Empleado</TableHead>
                      <TableHead className="min-w-[90px]">Depto.</TableHead>
                      <TableHead className="min-w-[80px]">Entrada</TableHead>
                      <TableHead className="min-w-[80px]">Comida</TableHead>
                      <TableHead className="min-w-[80px]">Descanso</TableHead>
                      <TableHead className="min-w-[80px]">Salida</TableHead>
                      <TableHead className="min-w-[100px]">Estado</TableHead>
                      <TableHead className="min-w-[80px]">Método</TableHead>
                      <TableHead className="min-w-[120px]">Ubicación</TableHead>
                      <TableHead className="min-w-[100px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record: Record<string, unknown>) => {
                      const r = record as CorrectionRecord;
                      const needsCorrection = !r.checkInTime || !r.checkOutTime;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.employee?.user?.name || '—'}</TableCell>
                          <TableCell>{(r.employee as Record<string, unknown>)?.department as string || '—'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {r.checkInTime ? format(new Date(r.checkInTime), 'HH:mm') : '—'}
                              {r.checkInMethod === 'MANUAL' && <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-300">M</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>
                            {record.mealStart ? (
                              <div className="text-xs">
                                <span>{format(new Date(record.mealStart as string), 'HH:mm')}</span>
                                {' - '}
                                <span>{record.mealEnd ? format(new Date(record.mealEnd as string), 'HH:mm') : '...'}</span>
                                {record.mealDuration != null && <span className="text-muted-foreground ml-1">({record.mealDuration}m)</span>}
                                {record.exceededMeal && <span className="text-red-500 ml-1">⚠️</span>}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.restStart ? (
                              <div className="text-xs">
                                <span>{format(new Date(record.restStart as string), 'HH:mm')}</span>
                                {' - '}
                                <span>{record.restEnd ? format(new Date(record.restEnd as string), 'HH:mm') : '...'}</span>
                                {record.restDuration != null && <span className="text-muted-foreground ml-1">({record.restDuration}m)</span>}
                                {record.exceededRest && <span className="text-red-500 ml-1">⚠️</span>}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {r.checkOutTime ? format(new Date(r.checkOutTime), 'HH:mm') : '—'}
                              {r.checkOutMethod === 'MANUAL' && <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-600 border-amber-300">M</Badge>}
                            </div>
                          </TableCell>
                          <TableCell><StatusBadge status={r.status} /></TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {r.checkInMethod === 'QR' ? 'QR' : r.checkInMethod === 'MANUAL' ? 'Manual' : 'Pwd'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {r.checkInLatitude ? (
                              <Badge variant="outline" className="text-xs">
                                <MapPin className="w-3 h-3 mr-1" />
                                {r.checkInLatitude.toFixed(4)}, {r.checkInLongitude?.toFixed(4)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {needsCorrection ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCorrectionRecord(r)}
                                className="text-amber-700 border-amber-400 hover:bg-amber-50 gap-1 h-7"
                              >
                                <PenLine className="w-3 h-3" />
                                <span className="text-xs">Corregir</span>
                              </Button>
                            ) : (
                              <Badge variant="outline" className="text-xs text-green-600 border-green-300">Completo</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Break Summary Card - Comida & Descanso */}
      {records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Timer className="w-5 h-5 text-primary" />
              Resumen de Descansos
            </CardTitle>
            <CardDescription>Horas utilizadas en comida y descanso hoy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card className="border-orange-200 bg-orange-50/50">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <UtensilsCrossed className="w-5 h-5 text-orange-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold text-orange-800 leading-tight">{mealCompleted.length}<span className="text-sm font-normal text-orange-600">/{mealRecords.length}</span></p>
                      <p className="text-xs text-orange-600 whitespace-nowrap">Comida completada</p>
                    </div>
                  </div>
                  <p className="text-xs text-orange-700 mt-2 font-medium">{totalMealMinutes > 0 ? `Total: ${Math.floor(totalMealMinutes / 60)}h ${totalMealMinutes % 60}m · Prom: ${mealCompleted.length > 0 ? Math.round(totalMealMinutes / mealCompleted.length) : 0}m` : 'Sin registros aún'}</p>
                </CardContent>
              </Card>
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Armchair className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-2xl font-bold text-purple-800 leading-tight">{restCompleted.length}<span className="text-sm font-normal text-purple-600">/{restRecords.length}</span></p>
                      <p className="text-xs text-purple-600 whitespace-nowrap">Descanso completado</p>
                    </div>
                  </div>
                  <p className="text-xs text-purple-700 mt-2 font-medium">{totalRestMinutes > 0 ? `Total: ${Math.floor(totalRestMinutes / 60)}h ${totalRestMinutes % 60}m · Prom: ${restCompleted.length > 0 ? Math.round(totalRestMinutes / restCompleted.length) : 0}m` : 'Sin registros aún'}</p>
                </CardContent>
              </Card>
              <Card className={mealExceeded.length > 0 ? 'border-red-200 bg-red-50/50' : 'border-green-200 bg-green-50/50'}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className={mealExceeded.length > 0 ? 'w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0' : 'w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0'}>
                      {mealExceeded.length > 0 ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <CheckCircle2 className="w-5 h-5 text-green-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className={mealExceeded.length > 0 ? 'text-2xl font-bold text-red-800 leading-tight' : 'text-2xl font-bold text-green-800 leading-tight'}>{mealExceeded.length}</p>
                      <p className="text-xs whitespace-nowrap text-red-600">Exceso en comida</p>
                    </div>
                  </div>
                  <p className="text-xs mt-2 font-medium">{mealExceeded.length > 0 ? 'Requiere atención' : 'Sin exceso'}</p>
                </CardContent>
              </Card>
              <Card className={restExceeded.length > 0 ? 'border-red-200 bg-red-50/50' : 'border-green-200 bg-green-50/50'}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div className={restExceeded.length > 0 ? 'w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0' : 'w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0'}>
                      {restExceeded.length > 0 ? <AlertTriangle className="w-5 h-5 text-red-600" /> : <CheckCircle2 className="w-5 h-5 text-green-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className={restExceeded.length > 0 ? 'text-2xl font-bold text-red-800 leading-tight' : 'text-2xl font-bold text-green-800 leading-tight'}>{restExceeded.length}</p>
                      <p className="text-xs whitespace-nowrap text-red-600">Exceso en descanso</p>
                    </div>
                  </div>
                  <p className="text-xs mt-2 font-medium">{restExceeded.length > 0 ? 'Requiere atención' : 'Sin exceso'}</p>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Break Table */}
            {(mealRecords.length > 0 || restRecords.length > 0) && (
              <ScrollArea className="max-h-[300px]">
                <div className="min-w-[700px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[160px]">Empleado</TableHead>
                        <TableHead className="min-w-[180px]">
                          <div className="flex items-center gap-1"><UtensilsCrossed className="w-3 h-3 text-orange-500" /> Comida</div>
                        </TableHead>
                        <TableHead className="min-w-[80px]">Duración</TableHead>
                        <TableHead className="min-w-[180px]">
                          <div className="flex items-center gap-1"><Armchair className="w-3 h-3 text-purple-500" /> Descanso</div>
                        </TableHead>
                        <TableHead className="min-w-[80px]">Duración</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((record: Record<string, unknown>) => {
                        const r = record as Record<string, unknown>;
                        const emp = (r.employee as Record<string, unknown>) || {};
                        const user = (emp.user as Record<string, unknown>) || {};
                        const hasMeal = !!r.mealStart;
                        const hasRest = !!r.restStart;
                        if (!hasMeal && !hasRest) return null;
                        return (
                          <TableRow key={(r.id as string) || (user.name as string)}>
                            <TableCell className="font-medium text-sm">
                              <div>
                                <p className="truncate">{(user.name as string) || '—'}</p>
                                <p className="text-xs text-muted-foreground">{(emp.employeeNumber as string) || ''}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {hasMeal ? (
                                <div className="text-xs">
                                  <span>{format(new Date(r.mealStart as string), 'HH:mm')}</span>
                                  {' - '}
                                  <span>{r.mealEnd ? format(new Date(r.mealEnd as string), 'HH:mm') : <span className="text-orange-600 font-medium">En curso...</span>}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {hasMeal ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-medium">{r.mealDuration != null ? `${r.mealDuration}m` : '...'}</span>
                                  {r.exceededMeal && <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">Exceso</Badge>}
                                  {!r.mealEnd && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-orange-300 text-orange-600">Activo</Badge>}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {hasRest ? (
                                <div className="text-xs">
                                  <span>{format(new Date(r.restStart as string), 'HH:mm')}</span>
                                  {' - '}
                                  <span>{r.restEnd ? format(new Date(r.restEnd as string), 'HH:mm') : <span className="text-purple-600 font-medium">En curso...</span>}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {hasRest ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-medium">{r.restDuration != null ? `${r.restDuration}m` : '...'}</span>
                                  {r.exceededRest && <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">Exceso</Badge>}
                                  {!r.restEnd && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-purple-300 text-purple-600">Activo</Badge>}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}

            {/* No breaks message */}
            {mealRecords.length === 0 && restRecords.length === 0 && (
              <div className="text-center py-6">
                <Timer className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No se han registrado descansos hoy</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Absent Employees Card - with better spacing */}
      {absentList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-destructive">Empleados Ausentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {absentList.map((emp: { id: string; user: { name: string }; employeeNumber: string; department: string }) => (
                <div key={emp.id} className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5">
                  <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{emp.user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{emp.department}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {correctionRecord && (
        <ManualCorrectionDialog
          record={correctionRecord}
          open={!!correctionRecord}
          onClose={handleCorrectionSaved}
        />
      )}
    </div>
  );
}

// ==================== EMPLOYEES MANAGEMENT ====================
interface EmployeeForEdit {
  id: string;
  employeeNumber: string;
  position: string;
  department: string;
  sucursal: string;
  user: { id: string; name: string; email: string; isActive: boolean };
  workSchedules: Array<{ id: string; dayOfWeek: number; startTime: string; endTime: string; toleranceMinutes: number }>;
}

function EmployeesView() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [sucursalFilter, setSucursalFilter] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeForEdit | null>(null);
  const [transferEmployee, setTransferEmployee] = useState<EmployeeForEdit | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: sucursalesData } = useAsyncData(async () => {
    const res = await authFetch('/api/sucursales');
    if (!res.ok) throw new Error('Error al cargar sucursales');
    return res.json();
  }, [refreshKey]);

  const sucursales = sucursalesData?.sucursales || [];
  // Deduplicate sucursales by name for Select (avoids duplicate key/value error)
  const uniqueSucursales = sucursales.filter((s: { name: string }, i: number, arr: { name: string }[]) =>
    arr.findIndex(x => x.name === s.name) === i
  );

  const { data: empData, loading } = useAsyncData(async () => {
    const res = await authFetch('/api/employees');
    if (!res.ok) throw new Error('Error al cargar empleados');
    return res.json();
  }, [refreshKey]);

  const employees = empData?.employees || [];

  const filteredEmployees = employees
    .filter((e: { user: { name: string; email: string }; employeeNumber: string; department: string; sucursal: string }) => 
      e.user.name.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeNumber.toLowerCase().includes(search.toLowerCase()) ||
      e.user.email.toLowerCase().includes(search.toLowerCase()) ||
      e.department.toLowerCase().includes(search.toLowerCase()) ||
      (e.sucursal || '').toLowerCase().includes(search.toLowerCase())
    )
    .filter((e: { sucursal: string }) => sucursalFilter === 'all' || (e.sucursal || 'Matriz') === sucursalFilter);

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Empleados</h1>
          <p className="text-muted-foreground">Gestión de empleados y horarios</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Nuevo Empleado
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre, número, email o departamento..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={sucursalFilter} onValueChange={setSucursalFilter}>
          <SelectTrigger className="w-44"><Building2 className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las Sucursales</SelectItem>
            {uniqueSucursales.map((s: { id: string; name: string; isActive: boolean }) => (
              <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>
      ) : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-3">
            {filteredEmployees.map((emp: { id: string; employeeNumber: string; position: string; department: string; user: { id: string; name: string; email: string; isActive: boolean }; workSchedules: Array<{ id: string; dayOfWeek: number; startTime: string; endTime: string; toleranceMinutes: number }> }) => (
              <Card key={emp.id} className={selectedEmployee === emp.id ? 'ring-2 ring-primary' : ''}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-semibold text-primary">{emp.user.name.charAt(0)}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{emp.user.name}</h3>
                          <Badge variant="outline" className="text-xs">{emp.employeeNumber}</Badge>
                          {!emp.user.isActive && <Badge variant="destructive" className="text-xs">Inactivo</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{emp.position} · {emp.department} · <span className="text-primary inline-flex items-center gap-1"><Building2 className="w-3 h-3" />{emp.sucursal || 'Matriz'}</span></p>
                        <p className="text-xs text-muted-foreground">{emp.user.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap">
                      <EmployeeQRButton employeeId={emp.id} employeeName={emp.user.name} />
                      <Button variant="outline" size="sm" onClick={() => setTransferEmployee(emp as EmployeeForEdit)} title="Transferir sucursal">
                        <ArrowRightLeft className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setEditingEmployee(emp as EmployeeForEdit)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setSelectedEmployee(selectedEmployee === emp.id ? null : emp.id)}>
                        {selectedEmployee === emp.id ? 'Ocultar' : 'Horarios'}
                      </Button>
                    </div>
                  </div>
                  
                  {selectedEmployee === emp.id && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-medium mb-2">Horarios de Trabajo</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {emp.workSchedules.length > 0 ? emp.workSchedules.map((s: { id: string; dayOfWeek: number; startTime: string; endTime: string; toleranceMinutes: number }) => (
                          <div key={s.id} className="p-2 rounded-lg bg-muted text-sm">
                            <p className="font-medium">{dayNames[s.dayOfWeek]}</p>
                            <p className="text-xs text-muted-foreground">{s.startTime} - {s.endTime}</p>
                            <p className="text-xs text-muted-foreground">Tolerancia: {s.toleranceMinutes} min</p>
                          </div>
                        )) : (
                          <p className="text-sm text-muted-foreground">Sin horarios configurados</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      <EmployeeFormDialog open={showForm} onClose={() => { setShowForm(false); setRefreshKey(k => k + 1); }} />
      {editingEmployee && (
        <EmployeeEditDialog 
          key={editingEmployee.id}
          employee={editingEmployee} 
          open={!!editingEmployee} 
          onClose={() => { setEditingEmployee(null); setRefreshKey(k => k + 1); }} 
        />
      )}
      {transferEmployee && (
        <EmployeeTransferDialog
          key={`transfer-${transferEmployee.id}`}
          employee={transferEmployee}
          sucursales={sucursales}
          open={!!transferEmployee}
          onClose={() => { setTransferEmployee(null); setRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}

function EmployeeQRButton({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const fetchQR = async () => {
    try {
      const res = await authFetch(`/api/employees/${employeeId}/qr`);
      const data = await res.json();
      setQrUrl(data.qrDataUrl);
    } catch { /* ignore */ }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) fetchQR(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><QrCode className="w-4 h-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Código QR del Empleado</DialogTitle>
          <DialogDescription>{employeeName}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {qrUrl ? (
            <>
              <img src={qrUrl} alt={`QR de ${employeeName}`} className="w-64 h-64 rounded-lg border" />
              <Button variant="outline" size="sm" onClick={() => {
                const link = document.createElement('a');
                link.download = `qr_${employeeName.replace(/\s+/g, '_')}.png`;
                link.href = qrUrl;
                link.click();
              }}>
                <Download className="w-4 h-4 mr-2" />Descargar QR
              </Button>
            </>
          ) : (
            <div className="h-64 w-64 flex items-center justify-center bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Cargando QR...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', employeeNumber: '', position: '', department: '', sucursal: 'Matriz' });
  const [schedules, setSchedules] = useState<Array<{ dayOfWeek: number; startTime: string; endTime: string; toleranceMinutes: number }>>([
    { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', toleranceMinutes: 10 },
    { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', toleranceMinutes: 10 },
    { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', toleranceMinutes: 10 },
    { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', toleranceMinutes: 10 },
    { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', toleranceMinutes: 10 },
    { dayOfWeek: 6, startTime: '09:00', endTime: '14:00', toleranceMinutes: 10 },
  ]);

  const { data: sucursalesData } = useAsyncData(async () => {
    const res = await authFetch('/api/sucursales');
    if (!res.ok) throw new Error('Error al cargar sucursales');
    return res.json();
  }, []);

  const sucursales = sucursalesData?.sucursales || [];
  // Deduplicate sucursales by name for Select (avoids duplicate key/value error)
  const uniqueSucursales = sucursales.filter((s: { name: string }, i: number, arr: { name: string }[]) =>
    arr.findIndex(x => x.name === s.name) === i
  );

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const departments = ['Finanzas', 'Tecnología', 'RRHH', 'Ventas', 'Marketing', 'Operaciones', 'Administración', 'Otro'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate passwords match
    if (form.password !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden');
      return;
    }
    if (form.password.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setPasswordError('');
    setLoading(true);
    try {
      const res = await authFetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, schedules }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Empleado creado', description: `${form.name} ha sido registrado correctamente` });
        setForm({ name: '', email: '', password: '', employeeNumber: '', position: '', department: '', sucursal: 'Matriz' });
        setConfirmPassword('');
        setShowPassword(false);
        setShowConfirmPassword(false);
        onClose();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
    setLoading(false);
  };

  const toggleSchedule = (day: number) => {
    setSchedules(prev => {
      const exists = prev.find(s => s.dayOfWeek === day);
      if (exists) return prev.filter(s => s.dayOfWeek !== day);
      return [...prev, { dayOfWeek: day, startTime: '09:00', endTime: '18:00', toleranceMinutes: 10 }];
    });
  };

  const updateSchedule = (day: number, field: 'startTime' | 'endTime' | 'toleranceMinutes', value: string | number) => {
    setSchedules(prev => prev.map(s => s.dayOfWeek === day ? { ...s, [field]: value } : s));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Empleado</DialogTitle>
          <DialogDescription>Registre un nuevo empleado con sus horarios de trabajo</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Nombre completo</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
            <div className="space-y-2"><Label>Número de empleado</Label><Input value={form.employeeNumber} onChange={e => setForm({...form, employeeNumber: e.target.value})} placeholder="EMP-006" required /></div>
            <div className="space-y-2"><Label>Correo electrónico</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required /></div>
            <div className="space-y-2">
              <Label>Contraseña inicial</Label>
              <div className="relative">
                <Input 
                  type={showPassword ? 'text' : 'password'} 
                  value={form.password} 
                  onChange={e => { setForm({...form, password: e.target.value}); setPasswordError(''); }} 
                  required 
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confirmar contraseña</Label>
              <div className="relative">
                <Input 
                  type={showConfirmPassword ? 'text' : 'password'} 
                  value={confirmPassword} 
                  onChange={e => { setConfirmPassword(e.target.value); setPasswordError(''); }} 
                  required 
                  minLength={8}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && <p className="text-sm text-destructive font-medium">{passwordError}</p>}
              {confirmPassword && !passwordError && form.password === confirmPassword && (
                <p className="text-sm text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Las contraseñas coinciden
                </p>
              )}
            </div>
            <div className="space-y-2"><Label>Puesto</Label><Input value={form.position} onChange={e => setForm({...form, position: e.target.value})} required /></div>
            <div className="space-y-2"><Label>Departamento</Label><Select value={form.department} onValueChange={v => setForm({...form, department: v})}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Sucursal</Label><Select value={form.sucursal} onValueChange={v => setForm({...form, sucursal: v})}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{uniqueSucursales.filter((s: { isActive: boolean }) => s.isActive).map((s: { id: string; name: string }) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}{!uniqueSucursales.some((s: { name: string; isActive: boolean }) => s.name === 'Matriz' && s.isActive) && <SelectItem key="matriz-fallback" value="Matriz">Matriz</SelectItem>}</SelectContent></Select></div>
          </div>
          <Separator />
          <h3 className="font-medium">Horarios de Trabajo</h3>
          <div className="space-y-2">
            {dayNames.map((name, idx) => {
              const schedule = schedules.find(s => s.dayOfWeek === idx);
              return (
                <div key={idx} className={`p-3 rounded-lg border ${schedule ? 'bg-muted/50' : 'opacity-50'}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button type="button" variant={schedule ? 'default' : 'outline'} size="sm" onClick={() => toggleSchedule(idx)}>{name}</Button>
                    {schedule && (
                      <>
                        <div className="flex items-center gap-2"><Label className="text-xs">Entrada:</Label><Input type="time" value={schedule.startTime} onChange={e => updateSchedule(idx, 'startTime', e.target.value)} className="w-28" /></div>
                        <div className="flex items-center gap-2"><Label className="text-xs">Salida:</Label><Input type="time" value={schedule.endTime} onChange={e => updateSchedule(idx, 'endTime', e.target.value)} className="w-28" /></div>
                        <div className="flex items-center gap-2"><Label className="text-xs">Tolerancia:</Label><Input type="number" value={schedule.toleranceMinutes} onChange={e => updateSchedule(idx, 'toleranceMinutes', parseInt(e.target.value))} className="w-20" min={0} max={30} /><span className="text-xs text-muted-foreground">min</span></div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Registrar Empleado'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== EMPLOYEE EDIT DIALOG ====================
function EmployeeEditDialog({ employee, open, onClose }: { employee: EmployeeForEdit; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: employee.user.name,
    email: employee.user.email,
    position: employee.position,
    department: employee.department,
    sucursal: employee.sucursal || 'Matriz',
    isActive: employee.user.isActive,
  });

  const { data: sucursalesData } = useAsyncData(async () => {
    const res = await authFetch('/api/sucursales');
    if (!res.ok) throw new Error('Error al cargar sucursales');
    return res.json();
  }, []);

  const sucursales = sucursalesData?.sucursales || [];
  // Deduplicate sucursales by name for Select (avoids duplicate key/value error)
  const uniqueSucursales = sucursales.filter((s: { name: string }, i: number, arr: { name: string }[]) =>
    arr.findIndex(x => x.name === s.name) === i
  );

  const [schedules, setSchedules] = useState<Array<{ dayOfWeek: number; startTime: string; endTime: string; toleranceMinutes: number }>>(
    employee.workSchedules.length > 0
      ? employee.workSchedules.map(s => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          toleranceMinutes: s.toleranceMinutes,
        }))
      : [
          { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', toleranceMinutes: 10 },
          { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', toleranceMinutes: 10 },
          { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', toleranceMinutes: 10 },
          { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', toleranceMinutes: 10 },
          { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', toleranceMinutes: 10 },
          { dayOfWeek: 6, startTime: '09:00', endTime: '14:00', toleranceMinutes: 10 },
        ]
  );

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const departments = ['Finanzas', 'Tecnología', 'RRHH', 'Ventas', 'Marketing', 'Operaciones', 'Administración', 'Otro'];

  // Form is initialized from employee props in useState above.
  // The `key={employee.id}` on the Dialog forces remount when switching employees.

  const toggleSchedule = (day: number) => {
    setSchedules(prev => {
      const exists = prev.find(s => s.dayOfWeek === day);
      if (exists) return prev.filter(s => s.dayOfWeek !== day);
      return [...prev, { dayOfWeek: day, startTime: '09:00', endTime: '18:00', toleranceMinutes: 10 }];
    });
  };

  const updateSchedule = (day: number, field: 'startTime' | 'endTime' | 'toleranceMinutes', value: string | number) => {
    setSchedules(prev => prev.map(s => s.dayOfWeek === day ? { ...s, [field]: value } : s));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authFetch(`/api/employees/${employee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          position: form.position,
          department: form.department,
          sucursal: form.sucursal,
          isActive: form.isActive,
          schedules,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Empleado actualizado', description: `${form.name} ha sido actualizado correctamente` });
        onClose();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Empleado</DialogTitle>
          <DialogDescription>Modifique los datos y horarios de {employee.user.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre completo</Label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label>Número de empleado</Label>
              <Input value={employee.employeeNumber} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Correo electrónico</Label>
              <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label>Puesto</Label>
              <Input value={form.position} onChange={e => setForm({...form, position: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={form.department} onValueChange={v => setForm({...form, department: v})}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sucursal</Label>
              <Select value={form.sucursal} onValueChange={v => setForm({...form, sucursal: v})}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {uniqueSucursales.filter((s: { isActive: boolean }) => s.isActive).map((s: { id: string; name: string }) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                  {!uniqueSucursales.some((s: { name: string; isActive: boolean }) => s.name === 'Matriz' && s.isActive) && <SelectItem key="matriz-fallback" value="Matriz">Matriz</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <div className="flex items-center gap-3">
                <Label>Estado del empleado</Label>
                <button
                  type="button"
                  onClick={() => setForm({...form, isActive: !form.isActive})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.isActive ? 'bg-green-500' : 'bg-muted'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className={`text-sm font-medium ${form.isActive ? 'text-green-700' : 'text-muted-foreground'}`}>
                  {form.isActive ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
          </div>

          <Separator />
          <h3 className="font-medium">Horarios de Trabajo</h3>
          <div className="space-y-2">
            {dayNames.map((name, idx) => {
              const schedule = schedules.find(s => s.dayOfWeek === idx);
              return (
                <div key={idx} className={`p-3 rounded-lg border ${schedule ? 'bg-muted/50' : 'opacity-50'}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button type="button" variant={schedule ? 'default' : 'outline'} size="sm" onClick={() => toggleSchedule(idx)}>
                      {name}
                    </Button>
                    {schedule && (
                      <>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Entrada:</Label>
                          <Input type="time" value={schedule.startTime} onChange={e => updateSchedule(idx, 'startTime', e.target.value)} className="w-28" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Salida:</Label>
                          <Input type="time" value={schedule.endTime} onChange={e => updateSchedule(idx, 'endTime', e.target.value)} className="w-28" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Tolerancia:</Label>
                          <Input type="number" value={schedule.toleranceMinutes} onChange={e => updateSchedule(idx, 'toleranceMinutes', parseInt(e.target.value) || 0)} className="w-20" min={0} max={30} />
                          <span className="text-xs text-muted-foreground">min</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar Cambios'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== EMPLOYEE TRANSFER DIALOG ====================
function EmployeeTransferDialog({ employee, sucursales, open, onClose }: { 
  employee: EmployeeForEdit; 
  sucursales: Array<{ id: string; name: string; isActive: boolean }>;
  open: boolean; 
  onClose: () => void 
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [newSucursal, setNewSucursal] = useState('');
  // Deduplicate sucursales by name for Select (avoids duplicate key/value error)
  const uniqueSucursales = sucursales.filter((s: { name: string }, i: number, arr: { name: string }[]) =>
    arr.findIndex(x => x.name === s.name) === i
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSucursal) {
      toast({ title: 'Error', description: 'Seleccione una sucursal', variant: 'destructive' });
      return;
    }
    if (newSucursal === (employee.sucursal || 'Matriz')) {
      toast({ title: 'Error', description: 'El empleado ya está en esta sucursal', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch(`/api/employees/${employee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sucursal: newSucursal }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Empleado transferido', description: `${employee.user.name} transferido a ${newSucursal}` });
        onClose();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir Empleado</DialogTitle>
          <DialogDescription>Transferir a {employee.user.name} a otra sucursal</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Sucursal actual</p>
                <p className="font-medium">{employee.sucursal || 'Matriz'}</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nueva Sucursal</Label>
            <Select value={newSucursal} onValueChange={setNewSucursal}>
              <SelectTrigger><SelectValue placeholder="Seleccionar sucursal" /></SelectTrigger>
              <SelectContent>
                {uniqueSucursales.filter((s: { name: string }) => s.name !== (employee.sucursal || 'Matriz')).map((s: { id: string; name: string }) => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !newSucursal}>{loading ? 'Transfiriendo...' : 'Transferir'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== ATTENDANCE VIEW ====================
// ==================== MANUAL CORRECTION DIALOG ====================
interface CorrectionRecord {
  id: string;
  date: string;
  sucursal: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInMethod: string | null;
  checkOutMethod: string | null;
  checkInLatitude: number | null;
  checkInLongitude: number | null;
  mealStart: string | null;
  mealEnd: string | null;
  mealDuration: number | null;
  exceededMeal: boolean;
  restStart: string | null;
  restEnd: string | null;
  restDuration: number | null;
  exceededRest: boolean;
  breakStart: string | null;
  breakEnd: string | null;
  breakDuration: number | null;
  exceededBreak: boolean;
  status: string;
  notes: string | null;
  employee: { user: { name: string }; employeeNumber: string; sucursal: string; workSchedules: Array<{ dayOfWeek: number; startTime: string; endTime: string; toleranceMinutes: number }> };
}

function ManualCorrectionDialog({
  record,
  open,
  onClose,
}: {
  record: CorrectionRecord;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();

  // Compute default values based on record state
  const getDefaultTime = () => {
    const recordDate = new Date(String(record.date).slice(0, 10) + 'T12:00:00');
    const dayOfWeek = recordDate.getDay();
    const schedule = record.employee?.workSchedules?.find(s => s.dayOfWeek === dayOfWeek);
    if (record.checkInTime && !record.checkOutTime) {
      return schedule ? schedule.endTime : '18:00';
    } else if (!record.checkInTime) {
      return schedule ? schedule.startTime : '09:00';
    }
    return '18:00';
  };

  const defaultAction = record.checkInTime ? 'registerCheckout' as const : 'registerCheckin' as const;

  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<'registerCheckin' | 'registerCheckout'>(defaultAction);
  const [timeValue, setTimeValue] = useState(getDefaultTime());
  const [justification, setJustification] = useState('');
  const [overrideStatus, setOverrideStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeValue || !justification.trim()) {
      toast({ title: 'Error', description: 'Complete todos los campos obligatorios', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        action,
        justification: justification.trim(),
      };

      if (action === 'registerCheckout') {
        payload.checkOutTime = timeValue;
      } else {
        payload.checkInTime = timeValue;
      }

      if (overrideStatus) {
        payload.status = overrideStatus;
      }

      const res = await authFetch(`/api/attendance/${record.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        toast({ 
          title: 'Registro actualizado', 
          description: `Se registró ${action === 'registerCheckout' ? 'la salida' : 'la entrada'} de ${record.employee?.user?.name} correctamente` 
        });
        onClose();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
    setLoading(false);
  };

  const needsCheckin = !record.checkInTime;
  const needsCheckout = record.checkInTime && !record.checkOutTime;
  const isComplete = record.checkInTime && record.checkOutTime;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="w-5 h-5 text-primary" />
            Corrección Manual de Asistencia
          </DialogTitle>
          <DialogDescription>
            Registro de {record.employee?.user?.name} — {String(record.date).slice(0, 10)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current status summary */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Estado actual:</span>
              <StatusBadge status={record.status} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Entrada: </span>
                <span className="font-medium">
                  {record.checkInTime ? format(new Date(record.checkInTime), 'HH:mm:ss') : 'Sin registrar'}
                  {record.checkInMethod === 'MANUAL' && <Badge variant="outline" className="ml-1 text-xs text-amber-600">Manual</Badge>}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Salida: </span>
                <span className="font-medium">
                  {record.checkOutTime ? format(new Date(record.checkOutTime), 'HH:mm:ss') : 'Sin registrar'}
                  {record.checkOutMethod === 'MANUAL' && <Badge variant="outline" className="ml-1 text-xs text-amber-600">Manual</Badge>}
                </span>
              </div>
            </div>
            {record.notes && (
              <div className="mt-2 pt-2 border-t">
                <span className="text-xs text-muted-foreground">Notas: </span>
                <span className="text-xs">{record.notes}</span>
              </div>
            )}
          </div>

          {isComplete ? (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center">
              <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <p className="text-sm text-green-700">Este registro ya tiene entrada y salida registradas.</p>
              <p className="text-xs text-green-600 mt-1">Si necesita corregir, contacte al administrador del sistema.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Action selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Acción a realizar</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={action === 'registerCheckin' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAction('registerCheckin')}
                    disabled={!!record.checkInTime}
                    className="flex-1"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Registrar Entrada
                  </Button>
                  <Button
                    type="button"
                    variant={action === 'registerCheckout' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAction('registerCheckout')}
                    disabled={!record.checkInTime || !!record.checkOutTime}
                    className="flex-1"
                  >
                    <Timer className="w-4 h-4 mr-2" />
                    Registrar Salida
                  </Button>
                </div>
              </div>

              {/* Time input */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Hora de {action === 'registerCheckin' ? 'entrada' : 'salida'} *
                </Label>
                <Input
                  type="time"
                  value={timeValue}
                  onChange={(e) => setTimeValue(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Ingrese la hora en que el empleado {action === 'registerCheckin' ? 'llegó' : 'salió'} según su reporte
                </p>
              </div>

              {/* Optional status override */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Estado (opcional)</Label>
                <Select value={overrideStatus} onValueChange={setOverrideStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Calculado automáticamente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESENT">Presente</SelectItem>
                    <SelectItem value="LATE">Retardo</SelectItem>
                    {action === 'registerCheckout' && (
                      <SelectItem value="EARLY_LEAVE">Salida Anticipada</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Si no selecciona, el sistema calcula automáticamente según el horario
                </p>
              </div>

              {/* Mandatory justification */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1">
                  Justificación * 
                  <AlertCircle className="w-3 h-3 text-amber-500" />
                </Label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Ej: El empleado olvidó marcar su salida al salir a las 18:00 hrs. Reportado por el supervisor Juan Pérez."
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  required
                  minLength={5}
                />
                <p className="text-xs text-amber-600">
                  ⚠️ Obligatorio para cumplimiento NOM-037. Quedará registrado en la auditoría.
                </p>
              </div>

              {/* NOM-037 notice */}
              <div className="p-2 rounded border bg-amber-50 border-amber-200">
                <p className="text-xs text-amber-700">
                  📋 <strong>NOM-037:</strong> Esta corrección quedará registrada en el log de auditoría con su nombre, la fecha/hora y la justificación proporcionada.
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
                <Button type="submit" disabled={loading || !timeValue || justification.trim().length < 5}>
                  {loading ? 'Guardando...' : 'Registrar Corrección'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== ATTENDANCE VIEW ====================
function AttendanceView() {
  const { toast } = useToast();
  const [period, setPeriod] = useState('week');
  const [sucursalFilter, setSucursalFilter] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [correctionRecord, setCorrectionRecord] = useState<CorrectionRecord | null>(null);

  const { data: sucursalesData } = useAsyncData(async () => {
    const res = await authFetch('/api/sucursales');
    if (!res.ok) throw new Error('Error al cargar sucursales');
    return res.json();
  }, []);

  const sucursales = sucursalesData?.sucursales || [];
  // Deduplicate sucursales by name for Select (avoids duplicate key/value error)
  const uniqueSucursales = sucursales.filter((s: { name: string }, i: number, arr: { name: string }[]) =>
    arr.findIndex(x => x.name === s.name) === i
  );

  const { data: attData, loading } = useAsyncData(async () => {
    const params = new URLSearchParams({ period });
    if (sucursalFilter !== 'all') params.set('sucursal', sucursalFilter);
    const res = await authFetch(`/api/attendance/history?${params}`);
    if (!res.ok) throw new Error('Error al cargar registros');
    return res.json();
  }, [period, sucursalFilter, refreshKey]);

  const records = attData?.records || [];

  const handleCorrectionSaved = () => {
    setCorrectionRecord(null);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Registros de Asistencia</h1>
          <p className="text-muted-foreground">Historial completo de asistencias</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Hoy</SelectItem>
            <SelectItem value="week">Esta Semana</SelectItem>
            <SelectItem value="month">Este Mes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sucursalFilter} onValueChange={setSucursalFilter}>
          <SelectTrigger className="w-44"><Building2 className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las Sucursales</SelectItem>
            {uniqueSucursales.map((s: { id: string; name: string; isActive: boolean }) => (
              <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)}>
          <RefreshCw className="w-4 h-4 mr-2" />Actualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              <div className="min-w-[1100px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[100px]">Fecha</TableHead>
                      <TableHead className="min-w-[150px]">Empleado</TableHead>
                      {sucursalFilter === 'all' && <TableHead className="min-w-[100px]">Sucursal</TableHead>}
                      <TableHead className="min-w-[80px]">Entrada</TableHead>
                      <TableHead className="min-w-[100px]">Comida</TableHead>
                      <TableHead className="min-w-[100px]">Descanso</TableHead>
                      <TableHead className="min-w-[80px]">Salida</TableHead>
                      <TableHead className="min-w-[60px]">Horas</TableHead>
                      <TableHead className="min-w-[100px]">Estado</TableHead>
                      <TableHead className="min-w-[120px]">Ubicación</TableHead>
                      <TableHead className="min-w-[100px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {records.map((record: Record<string, unknown>, idx: number) => {
                    const r = record as CorrectionRecord;
                    let workedHours = '—';
                    if (r.checkInTime && r.checkOutTime) {
                      const diff = (new Date(r.checkOutTime).getTime() - new Date(r.checkInTime).getTime()) / 3600000;
                      workedHours = diff.toFixed(2) + 'h';
                    }
                    const needsCorrection = !r.checkInTime || !r.checkOutTime;
                    return (
                      <TableRow key={r.id || idx}>
                        <TableCell>{String(r.date).slice(0, 10)}</TableCell>
                        <TableCell><div><p className="font-medium">{r.employee?.user?.name || '—'}</p><p className="text-xs text-muted-foreground">{r.employee?.employeeNumber}</p></div></TableCell>
                        {sucursalFilter === 'all' && <TableCell><Badge variant="outline" className="text-xs"><Building2 className="w-3 h-3 mr-1" />{r.sucursal || r.employee?.sucursal || 'Matriz'}</Badge></TableCell>}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {r.checkInTime ? format(new Date(r.checkInTime), 'HH:mm:ss') : '—'}
                            {r.checkInMethod === 'MANUAL' && <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">M</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.mealStart ? (
                            <div className="text-xs">
                              <span>{format(new Date(r.mealStart), 'HH:mm')}</span>
                              {' - '}
                              <span>{r.mealEnd ? format(new Date(r.mealEnd), 'HH:mm') : '...'}</span>
                              {r.mealDuration != null && <span className="text-muted-foreground ml-1">({r.mealDuration}m)</span>}
                              {r.exceededMeal && <span className="text-red-500 ml-1">⚠️</span>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {r.restStart ? (
                            <div className="text-xs">
                              <span>{format(new Date(r.restStart), 'HH:mm')}</span>
                              {' - '}
                              <span>{r.restEnd ? format(new Date(r.restEnd), 'HH:mm') : '...'}</span>
                              {r.restDuration != null && <span className="text-muted-foreground ml-1">({r.restDuration}m)</span>}
                              {r.exceededRest && <span className="text-red-500 ml-1">⚠️</span>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {r.checkOutTime ? format(new Date(r.checkOutTime), 'HH:mm:ss') : '—'}
                            {r.checkOutMethod === 'MANUAL' && <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">M</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{workedHours}</TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell>{r.checkInLatitude ? <Badge variant="outline" className="text-xs"><MapPin className="w-3 h-3 mr-1" />{r.checkInLatitude.toFixed(4)}, {r.checkInLongitude?.toFixed(4)}</Badge> : '—'}</TableCell>
                        <TableCell>
                          {needsCorrection ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCorrectionRecord(r)}
                              className="text-amber-700 border-amber-400 hover:bg-amber-50 gap-1"
                            >
                              <PenLine className="w-3.5 h-3.5" />
                              <span className="text-xs">Corregir</span>
                            </Button>
                          ) : (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-300">Completo</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {correctionRecord && (
        <ManualCorrectionDialog
          record={correctionRecord}
          open={!!correctionRecord}
          onClose={handleCorrectionSaved}
        />
      )}
    </div>
  );
}

// ==================== REPORTS VIEW ====================
function ReportsView() {
  const { toast } = useToast();
  const [activeReport, setActiveReport] = useState('daily');
  const [period, setPeriod] = useState('day');
  const [sucursalFilter, setSucursalFilter] = useState('all');
  const [showPreview, setShowPreview] = useState(true);

  // Month/year navigation for historical reports
  const currentNow = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentNow.getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState(currentNow.getFullYear());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const monthNamesShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const isCurrentMonth = selectedMonth === currentNow.getMonth() && selectedYear === currentNow.getFullYear();

  const { data: sucursalesData } = useAsyncData(async () => {
    const res = await authFetch('/api/sucursales');
    if (!res.ok) throw new Error('Error al cargar sucursales');
    return res.json();
  }, []);

  const sucursales = sucursalesData?.sucursales || [];
  // Deduplicate sucursales by name for Select (avoids duplicate key/value error)
  const uniqueSucursales = sucursales.filter((s: { name: string }, i: number, arr: { name: string }[]) =>
    arr.findIndex(x => x.name === s.name) === i
  );

  const { data: reportData, loading } = useAsyncData(async () => {
    const endpoint = activeReport === 'daily' ? '/api/reports/daily' : 
                     activeReport === 'overtime' ? '/api/reports/overtime' : '/api/reports/absences';
    const sucursalParam = sucursalFilter !== 'all' ? `&sucursal=${sucursalFilter}` : '';
    
    let params = '';
    if (period === 'month') {
      // For month period, use startDate/endDate to support historical months
      const startDate = format(new Date(selectedYear, selectedMonth, 1), 'yyyy-MM-dd');
      const endDate = format(new Date(selectedYear, selectedMonth + 1, 0), 'yyyy-MM-dd');
      params = `startDate=${startDate}&endDate=${endDate}${sucursalParam}`;
    } else {
      params = `period=${period}${sucursalParam}`;
    }
    
    const res = await authFetch(`${endpoint}?${params}`);
    if (!res.ok) throw new Error('Error al generar reporte');
    return res.json();
  }, [activeReport, period, sucursalFilter, selectedMonth, selectedYear]);

  const handleExport = async (exportFormat: string) => {
    try {
      const params = new URLSearchParams();
      if (period === 'month') {
        const startDate = format(new Date(selectedYear, selectedMonth, 1), 'yyyy-MM-dd');
        const endDate = format(new Date(selectedYear, selectedMonth + 1, 0), 'yyyy-MM-dd');
        params.set('startDate', startDate);
        params.set('endDate', endDate);
      } else {
        params.set('period', period);
      }
      params.set('format', exportFormat === 'excel' ? 'excel' : 'csv');
      if (sucursalFilter !== 'all') params.set('sucursal', sucursalFilter);
      if (activeReport !== 'daily') params.set('reportType', activeReport);

      if (exportFormat === 'csv') {
        const res = await authFetch(`/api/reports/export?${params}`);
        if (res.ok) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const reportLabel = activeReport === 'overtime' ? 'horas_extra' : activeReport === 'absences' ? 'ausencias' : 'asistencias';
          const sucLabel = sucursalFilter !== 'all' ? `_${sucursalFilter.replace(/\s+/g, '_')}` : '';
          const periodFileLabel = period === 'month' ? `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}` : period;
          a.download = `reporte_${reportLabel}${sucLabel}_${periodFileLabel}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
          toast({ title: 'Exportado', description: 'Archivo CSV descargado' });
        }
      } else {
        const res = await authFetch(`/api/reports/export?${params}`);
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          const headers = Object.keys(data.data[0] || {});
          const csvContent = [
            headers.join('\t'),
            ...data.data.map((row: Record<string, unknown>) => headers.map(h => row[h] || '').join('\t'))
          ].join('\n');
          const blob = new Blob(['\ufeff' + csvContent], { type: 'application/vnd.ms-excel' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${data.filename || 'reporte'}.xls`;
          a.click();
          window.URL.revokeObjectURL(url);
          toast({ title: 'Exportado', description: 'Archivo Excel descargado' });
        }
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo exportar', variant: 'destructive' });
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('report-preview');
    if (!printContent) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Reporte de Asistencia - ${activeReport === 'daily' ? 'Diario' : activeReport === 'overtime' ? 'Horas Extra' : 'Ausencias'}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; color: #1a1a1a; }
          h1 { font-size: 24px; margin-bottom: 4px; }
          h2 { font-size: 16px; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
          th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
          th { background: #f5f5f5; font-weight: 600; }
          tr:nth-child(even) { background: #fafafa; }
          .summary { display: flex; gap: 24px; margin-bottom: 20px; }
          .summary-item { padding: 12px 20px; border-radius: 8px; background: #f8f8f8; border: 1px solid #eee; }
          .summary-item .label { font-size: 11px; color: #888; text-transform: uppercase; }
          .summary-item .value { font-size: 22px; font-weight: 700; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
          .badge-green { background: #dcfce7; color: #166534; }
          .badge-amber { background: #fef3c7; color: #92400e; }
          .badge-red { background: #fee2e2; color: #991b1b; }
          .badge-orange { background: #ffedd5; color: #9a3412; }
          .footer { margin-top: 30px; font-size: 11px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Control de Asistencia - ${activeReport === 'daily' ? 'Reporte Diario' : activeReport === 'overtime' ? 'Reporte de Horas Extra' : 'Reporte de Ausencias'}</h1>
        <h2>Período: ${periodLabel} | Generado: ${new Date().toLocaleString('es-MX')}</h2>
        ${printContent.innerHTML}
        <div class="footer">Sistema de Control de Asistencia · Registros inalterables · NOM-037</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const periodLabel = period === 'day' ? 'Hoy' : period === 'week' ? 'Esta Semana' : isCurrentMonth ? 'Este Mes' : `${monthNames[selectedMonth]} ${selectedYear}`;
  const reportLabel = activeReport === 'daily' ? 'Reporte Diario' : activeReport === 'overtime' ? 'Horas Extra' : 'Ausencias';

  const renderDailyReport = () => {
    const data = reportData as { records?: Array<Record<string, unknown>>; summary?: Record<string, unknown> } | null;
    if (!data) return null;
    const summary = data.summary || {};
    const records = data.records || [];

    // Group by sucursal for consolidado view
    const sucursalBreakdown: Record<string, { present: number; late: number; absent: number; total: number }> = {};
    if (sucursalFilter === 'all') {
      for (const record of records) {
        const r = record as { employee?: { sucursal?: string }; status: string };
        const suc = r.employee?.sucursal || 'Matriz';
        if (!sucursalBreakdown[suc]) sucursalBreakdown[suc] = { present: 0, late: 0, absent: 0, total: 0 };
        sucursalBreakdown[suc].total++;
        if (r.status === 'PRESENT') sucursalBreakdown[suc].present++;
        if (r.status === 'LATE') sucursalBreakdown[suc].late++;
        if (r.status === 'ABSENT') sucursalBreakdown[suc].absent++;
      }
    }
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-green-200 bg-green-50"><CardContent className="p-4"><div className="flex items-center gap-3"><CheckCircle2 className="w-8 h-8 text-green-600" /><div><p className="text-xs text-green-700 font-medium">Presentes</p><p className="text-2xl font-bold text-green-800">{String(summary.present || 0)}</p></div></div></CardContent></Card>
          <Card className="border-amber-200 bg-amber-50"><CardContent className="p-4"><div className="flex items-center gap-3"><AlertTriangle className="w-8 h-8 text-amber-600" /><div><p className="text-xs text-amber-700 font-medium">Retardos</p><p className="text-2xl font-bold text-amber-800">{String(summary.late || 0)}</p></div></div></CardContent></Card>
          <Card className="border-red-200 bg-red-50"><CardContent className="p-4"><div className="flex items-center gap-3"><XCircle className="w-8 h-8 text-red-600" /><div><p className="text-xs text-red-700 font-medium">Ausentes</p><p className="text-2xl font-bold text-red-800">{String(summary.absent || 0)}</p></div></div></CardContent></Card>
          <Card className="border-orange-200 bg-orange-50"><CardContent className="p-4"><div className="flex items-center gap-3"><Timer className="w-8 h-8 text-orange-600" /><div><p className="text-xs text-orange-700 font-medium">Hrs Extra</p><p className="text-2xl font-bold text-orange-800">{String(summary.totalOvertimeHours || 0)}</p></div></div></CardContent></Card>
        </div>

        {sucursalFilter === 'all' && Object.keys(sucursalBreakdown).length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Desglose por Sucursal</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(sucursalBreakdown).map(([suc, stats]) => (
                  <div key={suc} className="p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">{suc}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div><p className="font-bold text-lg">{stats.total}</p><p className="text-muted-foreground">Total</p></div>
                      <div><p className="font-bold text-lg text-green-700">{stats.present}</p><p className="text-muted-foreground">Presentes</p></div>
                      <div><p className="font-bold text-lg text-amber-700">{stats.late}</p><p className="text-muted-foreground">Retardos</p></div>
                      <div><p className="font-bold text-lg text-red-700">{stats.absent}</p><p className="text-muted-foreground">Ausentes</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {records.length > 0 ? (
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Detalle de Asistencias</CardTitle><CardDescription>{records.length} registro(s) en el período</CardDescription></CardHeader>
          <CardContent className="p-0"><ScrollArea className="max-h-[400px]">
            <div className="min-w-[800px]">
            <Table>
              <TableHeader><TableRow><TableHead className="min-w-[150px]">Empleado</TableHead>{sucursalFilter === 'all' && <TableHead className="min-w-[100px]">Sucursal</TableHead>}<TableHead className="min-w-[100px]">Fecha</TableHead><TableHead className="min-w-[80px]">Entrada</TableHead><TableHead className="min-w-[80px]">Salida</TableHead><TableHead className="min-w-[80px]">Hrs Trab.</TableHead><TableHead className="min-w-[80px]">Hrs Extra</TableHead><TableHead className="min-w-[100px]">Estado</TableHead></TableRow></TableHeader>
              <TableBody>
                {records.map((record: Record<string, unknown>, idx: number) => {
                  const r = record as { id: string; date: string; sucursal: string; checkInTime: string | null; checkOutTime: string | null; status: string; workedHours: number; overtimeHours: number; employee: { user: { name: string }; employeeNumber: string; sucursal: string } };
                  return (
                    <TableRow key={r.id || idx}>
                      <TableCell><div><p className="font-medium">{r.employee?.user?.name}</p><p className="text-xs text-muted-foreground">{r.employee?.employeeNumber}</p></div></TableCell>
                      {sucursalFilter === 'all' && <TableCell><Badge variant="outline" className="text-xs"><Building2 className="w-3 h-3 mr-1" />{r.sucursal || r.employee?.sucursal || 'Matriz'}</Badge></TableCell>}
                      <TableCell>{String(r.date).slice(0, 10)}</TableCell>
                      <TableCell>{r.checkInTime ? format(new Date(r.checkInTime), 'HH:mm:ss') : '—'}</TableCell>
                      <TableCell>{r.checkOutTime ? format(new Date(r.checkOutTime), 'HH:mm:ss') : '—'}</TableCell>
                      <TableCell>{r.workedHours || '—'}</TableCell>
                      <TableCell className="text-orange-600 font-medium">{r.overtimeHours || 0}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea></CardContent></Card>
        ) : (
          <Card><CardContent className="py-12 text-center"><CalendarCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No hay registros de asistencia en este período</p></CardContent></Card>
        )}
      </div>
    );
  };

  const renderOvertimeReport = () => {
    const data = reportData as { records?: Array<Record<string, unknown>>; summary?: Record<string, unknown> } | null;
    if (!data) return null;
    const summary = data.summary || {};
    const records = data.records || [];

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card className="border-blue-200 bg-blue-50"><CardContent className="p-4"><div className="flex items-center gap-3"><Clock className="w-8 h-8 text-blue-600" /><div><p className="text-xs text-blue-700 font-medium">Hrs Trabajadas</p><p className="text-2xl font-bold text-blue-800">{String(summary.totalWorkedHours || 0)}</p></div></div></CardContent></Card>
          <Card className="border-orange-200 bg-orange-50"><CardContent className="p-4"><div className="flex items-center gap-3"><Timer className="w-8 h-8 text-orange-600" /><div><p className="text-xs text-orange-700 font-medium">Hrs Extra (2x)</p><p className="text-2xl font-bold text-orange-800">{String(summary.totalOvertimeHours || 0)}</p></div></div></CardContent></Card>
          <Card className="border-purple-200 bg-purple-50"><CardContent className="p-4"><div className="flex items-center gap-3"><FileBarChart className="w-8 h-8 text-purple-600" /><div><p className="text-xs text-purple-700 font-medium">Registros</p><p className="text-2xl font-bold text-purple-800">{String(summary.totalRecords || 0)}</p></div></div></CardContent></Card>
        </div>
        {records.length > 0 ? (
          <Card><CardHeader className="pb-2"><CardTitle className="text-base">Detalle de Horas Extra</CardTitle><CardDescription>Las horas extra se pagan al doble según la ley laboral mexicana</CardDescription></CardHeader>
          <CardContent className="p-0"><ScrollArea className="max-h-[400px]">
            <div className="min-w-[800px]">
            <Table>
              <TableHeader><TableRow><TableHead className="min-w-[150px]">Empleado</TableHead>{sucursalFilter === 'all' && <TableHead className="min-w-[100px]">Sucursal</TableHead>}<TableHead className="min-w-[100px]">Fecha</TableHead><TableHead className="min-w-[80px]">Entrada</TableHead><TableHead className="min-w-[80px]">Salida</TableHead><TableHead className="min-w-[80px]">Hrs Trab.</TableHead><TableHead className="min-w-[80px]">Hrs Extra</TableHead><TableHead className="min-w-[100px]">Estado</TableHead></TableRow></TableHeader>
              <TableBody>
                {records.map((record: Record<string, unknown>, idx: number) => {
                  const r = record as { id: string; date: string; sucursal: string; checkInTime: string | null; checkOutTime: string | null; status: string; workedHours: number; overtimeHours: number; overtimeMinutes: number; employee: { user: { name: string }; employeeNumber: string; sucursal: string } };
                  return (
                    <TableRow key={r.id || idx}>
                      <TableCell><div><p className="font-medium">{r.employee?.user?.name}</p><p className="text-xs text-muted-foreground">{r.employee?.employeeNumber}</p></div></TableCell>
                      {sucursalFilter === 'all' && <TableCell><Badge variant="outline" className="text-xs"><Building2 className="w-3 h-3 mr-1" />{r.sucursal || r.employee?.sucursal || 'Matriz'}</Badge></TableCell>}
                      <TableCell>{String(r.date).slice(0, 10)}</TableCell>
                      <TableCell>{r.checkInTime ? format(new Date(r.checkInTime), 'HH:mm:ss') : '—'}</TableCell>
                      <TableCell>{r.checkOutTime ? format(new Date(r.checkOutTime), 'HH:mm:ss') : '—'}</TableCell>
                      <TableCell>{r.workedHours}</TableCell>
                      <TableCell><div className="font-bold text-orange-600">{r.overtimeHours}h</div><div className="text-xs text-muted-foreground">{r.overtimeMinutes}min</div></TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea></CardContent></Card>
        ) : (
          <Card><CardContent className="py-12 text-center"><Timer className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No hay registros de horas extra en este período</p></CardContent></Card>
        )}
      </div>
    );
  };

  const renderAbsencesReport = () => {
    const data = reportData as { absences?: Array<Record<string, unknown>>; totalWorkDays?: number } | null;
    if (!data) return null;
    const absences = data.absences || [];

    return (
      <div className="space-y-4">
        <Card className="border-slate-200"><CardContent className="p-4"><div className="flex items-center gap-3"><CalendarCheck className="w-6 h-6 text-muted-foreground" /><p className="text-sm">Días laborables en el período: <span className="font-bold text-lg">{data.totalWorkDays || 0}</span></p></div></CardContent></Card>
        {absences.length > 0 ? (
          <div className="space-y-3">
            {absences.map((absence: Record<string, unknown>, idx: number) => {
              const a = absence as { employeeId: string; employeeNumber: string; name: string; department: string; totalAbsentDays: number; absentDays: Array<{ date: string; dayOfWeek: string }> };
              return (
                <Card key={a.employeeId || idx} className="border-red-100">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><XCircle className="w-5 h-5 text-red-600" /></div>
                        <div><p className="font-medium">{a.name}</p><p className="text-sm text-muted-foreground">{a.employeeNumber} · {a.department}</p></div>
                      </div>
                      <Badge variant="destructive" className="text-sm">{a.totalAbsentDays} ausencia(s)</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {a.absentDays?.map((d, i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-red-50 border-red-200">{d.date} ({d.dayOfWeek})</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card><CardContent className="py-12 text-center"><CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" /><p className="text-green-700 font-medium">¡Sin ausencias en este período!</p><p className="text-muted-foreground text-sm">Todos los empleados registraron asistencia</p></CardContent></Card>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-muted-foreground">Reportes de asistencia, horas extra y ausencias</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}><Search className="w-4 h-4 mr-2" />{showPreview ? 'Ocultar' : 'Vista Previa'}</Button>
          <Button variant="outline" size="sm" onClick={handlePrint}><FileBarChart className="w-4 h-4 mr-2" />Imprimir</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}><Download className="w-4 h-4 mr-2" />CSV</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')}><FileSpreadsheet className="w-4 h-4 mr-2" />Excel</Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={activeReport} onValueChange={setActiveReport}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Reporte Diario</SelectItem>
            <SelectItem value="overtime">Horas Extra</SelectItem>
            <SelectItem value="absences">Ausencias</SelectItem>
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Hoy</SelectItem>
            <SelectItem value="week">Esta Semana</SelectItem>
            <SelectItem value="month">Mensual</SelectItem>
          </SelectContent>
        </Select>
        {period === 'month' && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
              if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(selectedYear - 1); }
              else setSelectedMonth(selectedMonth - 1);
            }}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" className="h-8 px-3 text-sm font-medium min-w-[160px] justify-center" onClick={() => setShowMonthPicker(true)}>
              <Calendar className="w-4 h-4 mr-2" />{monthNames[selectedMonth]} {selectedYear}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isCurrentMonth} onClick={() => {
              if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(selectedYear + 1); }
              else setSelectedMonth(selectedMonth + 1);
            }}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        )}
        <Select value={sucursalFilter} onValueChange={setSucursalFilter}>
          <SelectTrigger className="w-48"><Building2 className="w-4 h-4 mr-2 text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Consolidado (Todas)</SelectItem>
            {uniqueSucursales.map((s: { id: string; name: string; isActive: boolean }) => (
              <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">{reportLabel} · {periodLabel}{sucursalFilter !== 'all' ? ` · ${sucursalFilter}` : ''}</Badge>
      </div>

      {/* Month/Year Picker Dialog */}
      <Dialog open={showMonthPicker} onOpenChange={setShowMonthPicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar Mes y Año</DialogTitle>
            <DialogDescription>Elige el período para consultar el reporte</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" onClick={() => setSelectedYear(selectedYear - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-lg font-bold">{selectedYear}</span>
              <Button variant="outline" size="icon" disabled={selectedYear >= currentNow.getFullYear()} onClick={() => setSelectedYear(selectedYear + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {monthNamesShort.map((name, idx) => {
                const isDisabled = idx > currentNow.getMonth() && selectedYear === currentNow.getFullYear();
                const isCurrent = idx === selectedMonth;
                return (
                  <Button key={idx} variant={isCurrent ? 'default' : 'outline'} 
                    size="sm" className="text-xs"
                    disabled={isDisabled}
                    onClick={() => { setSelectedMonth(idx); setShowMonthPicker(false); }}>
                    {name}
                  </Button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>
      ) : showPreview ? (
        <div id="report-preview">
          {activeReport === 'daily' && renderDailyReport()}
          {activeReport === 'overtime' && renderOvertimeReport()}
          {activeReport === 'absences' && renderAbsencesReport()}
        </div>
      ) : (
        <Card><CardContent className="py-12 text-center"><FileBarChart className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">Vista previa oculta. Haz clic en &quot;Vista Previa&quot; para mostrar.</p></CardContent></Card>
      )}
    </div>
  );
}

// ==================== AUDIT LOG VIEW ====================
function AuditLogView() {
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const { data: auditData, loading } = useAsyncData(async () => {
    const res = await authFetch(`/api/audit?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error('Error al cargar auditoría');
    return res.json();
  }, [offset]);

  const logs = auditData?.logs || [];
  const total = auditData?.total || 0;

  const actionLabels: Record<string, string> = {
    LOGIN: 'Inicio de Sesión',
    LOGIN_FAILED: 'Intento de Acceso Fallido',
    LOGOUT: 'Cierre de Sesión',
    CHECK_IN: 'Registro de Entrada',
    CHECK_OUT: 'Registro de Salida',
    CREATE_EMPLOYEE: 'Creación de Empleado',
    UPDATE_EMPLOYEE: 'Actualización de Empleado',
    DEACTIVATE_EMPLOYEE: 'Desactivación de Empleado',
    EXPORT_REPORT: 'Exportación de Reporte',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Registro de Auditoría</h1>
        <p className="text-muted-foreground">Trazabilidad completa de todas las acciones del sistema</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[500px]">
              <div className="min-w-[700px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[130px]">Fecha/Hora</TableHead>
                    <TableHead className="min-w-[150px]">Usuario</TableHead>
                    <TableHead className="min-w-[120px]">Acción</TableHead>
                    <TableHead className="min-w-[200px]">Detalles</TableHead>
                    <TableHead className="min-w-[100px]">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log: { id: string; action: string; details: string | null; ipAddress: string | null; createdAt: string; user: { name: string; email: string; role: string } }) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">{format(new Date(log.createdAt), 'dd/MM/yyyy HH:mm:ss')}</TableCell>
                      <TableCell><div><p className="text-sm font-medium">{log.user.name}</p><p className="text-xs text-muted-foreground">{log.user.email}</p></div></TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{actionLabels[log.action] || log.action}</Badge></TableCell>
                      <TableCell className="max-w-48">{log.details ? <p className="text-xs text-muted-foreground truncate">{log.details}</p> : '—'}</TableCell>
                      <TableCell className="text-xs">{log.ipAddress || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Mostrando {offset + 1}-{Math.min(offset + limit, total)} de {total} registros</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );
}

// ==================== QR TERMINAL ====================
function QRTerminalView() {
  const [dynamicQR, setDynamicQR] = useState<{ qrDataUrl: string; expiresAt: string; code: string } | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [qrError, setQrError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQR = useCallback(async () => {
    setLoading(true);
    setQrError(null);
    try {
      const res = await authFetch('/api/qr/dynamic');
      const data = await res.json();
      if (!res.ok || data.error) {
        setQrError(data.error || data.details || 'Error al generar QR');
        setDynamicQR(null);
      } else if (data.qrDataUrl) {
        setDynamicQR(data);
      } else {
        setQrError('Respuesta inválida del servidor');
        setDynamicQR(null);
      }
    } catch (err) {
      setQrError('Error de conexión al generar QR');
      setDynamicQR(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQR();
  }, [fetchQR]);

  useEffect(() => {
    if (!autoRefresh || !dynamicQR) return;
    const interval = setInterval(fetchQR, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchQR, dynamicQR]);

  const timeUntilExpiry = dynamicQR ? Math.max(0, Math.floor((new Date(dynamicQR.expiresAt).getTime() - Date.now()) / 1000)) : 0;
  const expiryDate = dynamicQR ? new Date(dynamicQR.expiresAt) : null;
  const isValidExpiry = expiryDate && !isNaN(expiryDate.getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Terminal QR</h1>
          <p className="text-muted-foreground">Código QR dinámico para registro de asistencia</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setAutoRefresh(!autoRefresh)}>
            <Timer className="w-4 h-4 mr-2" />{autoRefresh ? 'Auto: ON' : 'Auto: OFF'}
          </Button>
          <Button size="sm" onClick={fetchQR} disabled={loading}><RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Generar Nuevo</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col items-center gap-6">
            <div className="text-center">
              <h2 className="text-xl font-bold mb-1">Escanee para Registrar Asistencia</h2>
              <p className="text-sm text-muted-foreground">El código se actualiza automáticamente cada 5 minutos</p>
            </div>
            
            {qrError && (
              <div className="w-72 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-center">
                <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-2" />
                <p className="text-sm text-destructive font-medium">{qrError}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={fetchQR}>
                  <RefreshCw className="w-4 h-4 mr-2" />Reintentar
                </Button>
              </div>
            )}

            {loading && !dynamicQR && !qrError && (
              <div className="w-72 h-72 flex items-center justify-center bg-muted rounded-2xl">
                <div className="text-center">
                  <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-3" />
                  <p className="text-muted-foreground">Generando código QR...</p>
                </div>
              </div>
            )}

            {dynamicQR && dynamicQR.qrDataUrl && (
              <>
                <div className="relative">
                  <img src={dynamicQR.qrDataUrl} alt="QR Dinámico" className="w-72 h-72 rounded-2xl border-4 border-primary/20 shadow-lg" />
                  {timeUntilExpiry < 60 && timeUntilExpiry > 0 && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="destructive" className="animate-pulse">Expira en {timeUntilExpiry}s</Badge>
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Expira: {isValidExpiry ? expiryDate.toLocaleTimeString('es-MX') : 'Calculando...'}
                  </p>
                </div>
              </>
            )}

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1"><Shield className="w-4 h-4" /><span>Código dinámico</span></div>
              <div className="flex items-center gap-1"><Timer className="w-4 h-4" /><span>Vigencia: 5 minutos</span></div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== SUCURSALES VIEW ====================
function SucursalesView() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingSucursal, setEditingSucursal] = useState<{ id: string; name: string; address: string; isActive: boolean; mealToleranceMinutes?: number; restToleranceMinutes?: number; breakToleranceMinutes?: number } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: sucData, loading } = useAsyncData(async () => {
    const res = await authFetch('/api/sucursales');
    if (!res.ok) throw new Error('Error al cargar sucursales');
    return res.json();
  }, [refreshKey]);

  const sucursales = sucData?.sucursales || [];

  const handleToggleActive = async (sucursal: { id: string; name: string; isActive: boolean }) => {
    try {
      const res = await authFetch(`/api/sucursales/${sucursal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !sucursal.isActive }),
      });
      if (res.ok) {
        toast({ title: sucursal.isActive ? 'Sucursal desactivada' : 'Sucursal activada', description: `${sucursal.name} ha sido ${sucursal.isActive ? 'desactivada' : 'activada'}` });
        setRefreshKey(k => k + 1);
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sucursales</h1>
          <p className="text-muted-foreground">Gestión de sucursales y ubicaciones</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nueva Sucursal
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>
      ) : sucursales.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">No hay sucursales registradas</p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />Crear Primera Sucursal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sucursales.map((sucursal: { id: string; name: string; address: string; isActive: boolean; employeeCount: number; createdAt: string; mealToleranceMinutes?: number; restToleranceMinutes?: number; breakToleranceMinutes?: number }) => (
            <Card key={sucursal.id} className={!sucursal.isActive ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">{sucursal.name}</h3>
                      {sucursal.address && <p className="text-sm text-muted-foreground">{sucursal.address}</p>}
                    </div>
                  </div>
                  <Badge className={sucursal.isActive ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-red-100 text-red-800 hover:bg-red-100'}>
                    {sucursal.isActive ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
                <div className="flex flex-col gap-1 mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{sucursal.employeeCount || 0} empleados</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Tolerancia comida: {sucursal.mealToleranceMinutes ?? sucursal.breakToleranceMinutes ?? 5} min</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Armchair className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Tolerancia descanso: {sucursal.restToleranceMinutes ?? sucursal.breakToleranceMinutes ?? 5} min</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingSucursal(sucursal)}>
                    <Pencil className="w-4 h-4 mr-1" />Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleToggleActive(sucursal)}>
                    {sucursal.isActive ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SucursalFormDialog open={showForm} onClose={() => { setShowForm(false); setRefreshKey(k => k + 1); }} />
      {editingSucursal && (
        <SucursalEditDialog
          key={editingSucursal.id}
          sucursal={editingSucursal}
          open={!!editingSucursal}
          onClose={() => { setEditingSucursal(null); setRefreshKey(k => k + 1); }}
        />
      )}
    </div>
  );
}

// ==================== SUCURSAL FORM DIALOG ====================
function SucursalFormDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', address: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'El nombre es requerido', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch('/api/sucursales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Sucursal creada', description: `${form.name} ha sido registrada correctamente` });
        setForm({ name: '', address: '' });
        onClose();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Sucursal</DialogTitle>
          <DialogDescription>Registre una nueva sucursal o ubicación de trabajo</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre de la Sucursal</Label>
            <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ej: Sucursal Centro" required />
          </div>
          <div className="space-y-2">
            <Label>Dirección</Label>
            <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Ej: Av. Principal 123, Col. Centro" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Crear Sucursal'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== SUCURSAL EDIT DIALOG ====================
function SucursalEditDialog({ sucursal, open, onClose }: { sucursal: { id: string; name: string; address: string; isActive: boolean; mealToleranceMinutes?: number; restToleranceMinutes?: number; breakToleranceMinutes?: number }; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: sucursal.name, address: sucursal.address || '', mealToleranceMinutes: sucursal.mealToleranceMinutes ?? sucursal.breakToleranceMinutes ?? 5, restToleranceMinutes: sucursal.restToleranceMinutes ?? sucursal.breakToleranceMinutes ?? 5 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'El nombre es requerido', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await authFetch(`/api/sucursales/${sucursal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, address: form.address, mealToleranceMinutes: form.mealToleranceMinutes, restToleranceMinutes: form.restToleranceMinutes }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Sucursal actualizada', description: `${form.name} ha sido actualizada correctamente` });
        onClose();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Sucursal</DialogTitle>
          <DialogDescription>Modifique los datos de la sucursal</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre de la Sucursal</Label>
            <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
          </div>
          <div className="space-y-2">
            <Label>Dirección</Label>
            <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Tolerancia de Comida (minutos)</Label>
            <Input type="number" value={form.mealToleranceMinutes} onChange={e => setForm({...form, mealToleranceMinutes: parseInt(e.target.value) || 5})} min={0} max={30} />
            <p className="text-xs text-muted-foreground">Minutos extra permitidos después de los 15 min de comida antes de marcar como exceso</p>
          </div>
          <div className="space-y-2">
            <Label>Tolerancia de Descanso (minutos)</Label>
            <Input type="number" value={form.restToleranceMinutes} onChange={e => setForm({...form, restToleranceMinutes: parseInt(e.target.value) || 5})} min={0} max={30} />
            <p className="text-xs text-muted-foreground">Minutos extra permitidos después de los 15 min de descanso antes de marcar como exceso</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar Cambios'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== MAIN ADMIN LAYOUT ====================
export function AdminLayout() {
  const { currentView } = useAppStore();
  const { setSidebarOpen } = useAppStore();

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <AdminDashboard />;
      case 'employees': return <EmployeesView />;
      case 'sucursales': return <SucursalesView />;
      case 'attendance': return <AttendanceView />;
      case 'reports': return <ReportsView />;
      case 'audit': return <AuditLogView />;
      case 'qr-terminal': return <QRTerminalView />;
      case 'manual': return <UserManual />;
      default: return <AdminDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AdminSidebar />
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b z-30 flex items-center px-4">
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
          <Menu className="w-5 h-5" />
        </Button>
        <h1 className="ml-3 font-semibold">Control de Asistencia</h1>
      </div>
      <main className="lg:ml-64 p-4 sm:p-6 mt-14 lg:mt-0 flex-1 overflow-x-auto">
        {renderView()}
      </main>
    </div>
  );
}
