'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore, type AdminView } from '@/store/app-store';
import { authFetch } from '@/lib/fetch-helper';
import { useAttendanceToday, type TodayResponse } from '@/hooks/queries/use-attendance-today';
import { useDynamicQR } from '@/hooks/queries/use-dynamic-qr';
import { FreshnessIndicator } from '@/components/shared/freshness-indicator';
import { PollingToast } from '@/components/shared/polling-toast';
import { roleLabel, sucursalLabel, can } from '@/lib/rbac';
import type { AuthUser } from '@/lib/auth';
import { useRealtime } from '@/hooks/use-realtime';
import { cn } from '@/lib/utils';
import { formatTimeInMexico, formatDateInMexico, formatMinutes, formatDateTimeInMexico, getMexicoTodayISO } from '@/lib/timezone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis, Legend } from 'recharts';
import { toast } from 'sonner';
import {
  LayoutDashboard, Users, Building2, ShieldCheck, CalendarCheck, History as HistoryIcon,
  FileBarChart, ScrollText, QrCode, Building, Settings as SettingsIcon,
  LogOut, Menu, Clock, UserPlus, Download, Search,
  CheckCircle2, XCircle, AlertTriangle, Timer, MapPin,
  ChevronLeft, ChevronRight, RefreshCw, Plus, Trash2, Pencil,
  ArrowRightLeft, Eye, Lock, Unlock, KeyRound, Power,
  CalendarDays, Briefcase, Hash, Mail, Phone, IdCard,
  ChevronDown, ChevronUp, Loader2, Image as ImageIcon, Save,
  Coffee, Utensils, X, FileSpreadsheet, Printer, Hourglass, UserCheck, UserX,
  LogIn,
  Shield, ShieldAlert, Copy, ArrowLeft, Check,
  Maximize2, Minimize2,
} from 'lucide-react';

// ============================================================
// Types (subset of API payloads used by views)
// ============================================================

type Role = 'GENERAL_ADMIN' | 'SUCURSAL_ADMIN' | 'SUPERVISOR' | 'EMPLOYEE';

interface EmployeeRow {
  id: string;
  employeeNumber: string;
  position: string;
  department: string;
  sucursalId: string;
  isActive: boolean;
  hireDate?: string | null;
  vacationBalanceDays?: number;
  user: { id: string; name: string; email: string; isActive: boolean };
  sucursal: { id: string; name: string; codigoLocal: string | null };
  workSchedules?: Array<{ id: string; dayOfWeek: number; startTime: string; endTime: string; toleranceMinutes: number; isWeeklyRest: boolean }>;
}

interface SucursalRow {
  id: string;
  name: string;
  codigoLocal: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
  enforceGeofence: boolean;
  mealToleranceMinutes: number;
  restToleranceMinutes: number;
  mealDurationMinutes: number;
  restDurationMinutes: number;
  checkoutToleranceMinutes: number;
  isActive: boolean;
  employeeCount?: number;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  sucursalId: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
  sucursal?: { id: string; name: string; codigoLocal: string | null } | null;
  employee?: { id: string; employeeNumber: string; position: string; department: string; isActive: boolean } | null;
}

interface VacationRow {
  id: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  rejectionReason: string | null;
  employeeId: string;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  employee: {
    id: string;
    employeeNumber: string;
    position: string;
    department: string;
    sucursalId: string;
    user: { id: string; name: string; email: string };
    sucursal: { id: string; name: string; codigoLocal: string | null };
  };
  requestedBy: { id: string; name: string; email: string } | null;
  approvedBy: { id: string; name: string; email: string } | null;
}

interface HolidayRow {
  id: string;
  date: string;
  name: string;
  description: string | null;
  isOfficial: boolean;
}

interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  sucursalId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  userId: string | null;
  user: { id: string; name: string; email: string; role: Role } | null;
}

interface CompanyRow {
  id: string;
  razonSocial: string;
  rfc: string;
  registroPatronal: string | null;
  domicilioFiscal: string | null;
  telefono: string | null;
  email: string | null;
  representanteLegal: string | null;
  logoUrl: string | null;
}

// ============================================================
// Helpers
// ============================================================

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Presente',
  LATE: 'Retardo',
  ABSENT: 'Ausente',
  EARLY_LEAVE: 'Salida Anticipada',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PRESENT: 'default',
  LATE: 'secondary',
  ABSENT: 'destructive',
  EARLY_LEAVE: 'outline',
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status;
  const variant = STATUS_VARIANT[status] ?? 'outline';
  const cls =
    status === 'PRESENT' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
    : status === 'LATE' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200'
    : status === 'ABSENT' ? 'bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200'
    : status === 'EARLY_LEAVE' ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-100 border-zinc-200'
    : '';
  return <Badge variant={variant} className={cls}>{label}</Badge>;
}

const VACATION_TYPE_LABEL: Record<string, string> = {
  VACACIONES: 'Vacaciones',
  PERMISO: 'Permiso',
  INCAPACIDAD: 'Incapacidad',
  MATERNIDAD: 'Maternidad',
  PATERNIDAD: 'Paternidad',
  OTRO: 'Otro',
};

const VACATION_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};

const VACATION_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  APPROVED: 'default',
  REJECTED: 'destructive',
  CANCELLED: 'outline',
};

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  LOGIN_FAILED: 'Intento fallido',
  CREATE_EMPLOYEE: 'Crear empleado',
  UPDATE_EMPLOYEE: 'Actualizar empleado',
  DEACTIVATE_EMPLOYEE: 'Desactivar empleado',
  TRANSFER: 'Transferir empleado',
  CREATE_SUCURSAL: 'Crear sucursal',
  UPDATE_SUCURSAL: 'Actualizar sucursal',
  DELETE_SUCURSAL: 'Eliminar sucursal',
  CREATE_USER: 'Crear usuario',
  UPDATE_USER: 'Actualizar usuario',
  PASSWORD_RESET: 'Resetear contraseña',
  ACCOUNT_UNLOCK: 'Desbloquear cuenta',
  CHECK_IN: 'Registro de entrada',
  CHECK_OUT: 'Registro de salida',
  MEAL_START: 'Inicio de comida',
  MEAL_END: 'Fin de comida',
  MEAL_CANCEL: 'Cancelar comida',
  REST_START: 'Inicio de descanso',
  REST_END: 'Fin de descanso',
  REST_CANCEL: 'Cancelar descanso',
  MANUAL_CORRECTION: 'Corrección manual',
  VACATION_REQUEST: 'Solicitud de vacaciones',
  VACATION_APPROVE: 'Aprobación de vacaciones',
  VACATION_REJECT: 'Rechazo de vacaciones',
  VACATION_CANCEL: 'Cancelación de vacaciones',
  CREATE_COMPANY: 'Crear empresa',
  UPDATE_COMPANY: 'Actualizar empresa',
  COMPANY_LOGO_UPLOAD: 'Subir logo',
  HOLIDAY_CREATE: 'Crear feriado',
  HOLIDAY_DELETE: 'Eliminar feriado',
  QR_DYNAMIC_GENERATE: 'Generar QR dinámico',
  JUSTIFY_SUBMIT: 'Enviar justificación',
};

function actionLabel(a: string): string {
  return ACTION_LABELS[a] ?? a;
}

// Custom scrollbar styling (Tailwind v4 arbitrary)
const SCROLLBAR_CLASS = '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700';

async function apiGet<T>(url: string): Promise<T> {
  const res = await authFetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Error ${res.status}`);
  }
  return res.json();
}

async function apiSend<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await authFetch(url, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Error ${res.status}`);
  }
  return data as T;
}

function useDebounced<T extends string>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-rose-50 p-3 mb-3">
        <AlertTriangle className="h-6 w-6 text-rose-600" />
      </div>
      <p className="text-sm font-medium text-foreground">Error al cargar datos</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-md">{message}</p>
    </div>
  );
}

function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

// ============================================================
// NAV ITEMS
// ============================================================

interface NavItem {
  id: AdminView;
  label: string;
  labelSucursal?: string; // alternate label for SUCURSAL_ADMIN
  icon: React.ElementType;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['GENERAL_ADMIN', 'SUCURSAL_ADMIN', 'SUPERVISOR'] },
  { id: 'employees', label: 'Empleados', icon: Users, roles: ['GENERAL_ADMIN', 'SUCURSAL_ADMIN'] },
  { id: 'sucursales', label: 'Sucursales', labelSucursal: 'Mi Sucursal', icon: Building2, roles: ['GENERAL_ADMIN', 'SUCURSAL_ADMIN'] },
  { id: 'users', label: 'Usuarios y Roles', icon: ShieldCheck, roles: ['GENERAL_ADMIN'] },
  { id: 'vacations', label: 'Vacaciones y Permisos', icon: CalendarCheck, roles: ['GENERAL_ADMIN', 'SUCURSAL_ADMIN'] },
  { id: 'history', label: 'Historial', icon: HistoryIcon, roles: ['GENERAL_ADMIN', 'SUCURSAL_ADMIN', 'SUPERVISOR'] },
  { id: 'reports', label: 'Reportes', icon: FileBarChart, roles: ['GENERAL_ADMIN', 'SUCURSAL_ADMIN', 'SUPERVISOR'] },
  { id: 'audit', label: 'Auditoría', icon: ScrollText, roles: ['GENERAL_ADMIN', 'SUCURSAL_ADMIN', 'SUPERVISOR'] },
  { id: 'qr-terminal', label: 'Terminal QR', icon: QrCode, roles: ['GENERAL_ADMIN', 'SUCURSAL_ADMIN'] },
  { id: 'company', label: 'Empresa y Feriados', icon: Building, roles: ['GENERAL_ADMIN'] },
  { id: 'settings', label: 'Configuración', icon: SettingsIcon, roles: ['GENERAL_ADMIN', 'SUCURSAL_ADMIN'] },
];

function navItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((n) => n.roles.includes(role));
}

const VIEW_TITLES: Record<AdminView, string> = {
  dashboard: 'Dashboard',
  employees: 'Empleados',
  sucursales: 'Sucursales',
  users: 'Usuarios y Roles',
  vacations: 'Vacaciones y Permisos',
  history: 'Historial de Asistencia',
  reports: 'Reportes',
  audit: 'Auditoría',
  'qr-terminal': 'Terminal QR',
  company: 'Empresa y Feriados',
  settings: 'Configuración',
};


// ============================================================
// DASHBOARD VIEW
// ============================================================

interface DashboardViewProps {
  role: Role;
  userSucursalId: string | null;
  userSucursalName: string | null;
  userSucursalCodigoLocal: string | null;
}

function DashboardView({ role, userSucursalId }: DashboardViewProps) {
  const isGA = role === 'GENERAL_ADMIN';
  // SUPERVISOR can view the dashboard but cannot correct attendance
  // records (no 'attendance:correct' permission in rbac PERMISSIONS).
  const canCorrect = can({ role } as AuthUser, 'attendance:correct');
  const [selectedSucursalId, setSelectedSucursalId] = useState<string>('all');
  const [sucursales, setSucursales] = useState<SucursalRow[]>([]);
  const [loadingSucursales, setLoadingSucursales] = useState(isGA);
  const { preselectedEmployeeId, setPreselectedEmployeeId } = useAppStore();
  const [correctionRecord, setCorrectionRecord] = useState<any | null>(null);

  // Cargar sucursales para el selector (GA only)
  useEffect(() => {
    if (!isGA) return;
    let mounted = true;
    (async () => {
      try {
        const data = await apiGet<{ sucursales: SucursalRow[] }>('/api/sucursales');
        if (mounted) {
          setSucursales(data.sucursales);
          setLoadingSucursales(false);
        }
      } catch (e) {
        if (mounted) setLoadingSucursales(false);
      }
    })();
    return () => { mounted = false; };
  }, [isGA]);

  const effectiveSucursalId = isGA
    ? (selectedSucursalId === 'all' ? null : selectedSucursalId)
    : userSucursalId;

  const { data, isLoading, isFetching, isError, error, refetch, dataUpdatedAt } = useAttendanceToday(effectiveSucursalId);

  const prevCountRef = useRef(0);

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const stats = data?.stats;
  const records: any[] = (data?.records as any[]) || [];
  const absents: any[] = (data?.absents as any[]) || [];

  // KPIs
  const totalEmpleados = stats?.total ?? 0;
  const present = stats?.present ?? 0;
  const late = stats?.late ?? 0;
  const absent = stats?.absent ?? 0;
  const asistenciaPct = totalEmpleados > 0 ? Math.round(((present + late) / totalEmpleados) * 100) : 0;
  const impuntualidadPct = totalEmpleados > 0 ? Math.round((late / totalEmpleados) * 100) : 0;
  const overtimeHours = stats?.overtimeHours ?? 0;
  const onBreak = stats?.onBreak ?? 0;
  const breakExceeded = stats?.breakExceeded ?? 0;
  const breakTotalMinutes = stats?.breakTotalMinutes ?? 0;

  // Break summary
  const breakSummary = useMemo(() => {
    let completed = 0;
    let inProgress = 0;
    let exceeded = 0;
    let totalMinutes = 0;
    for (const r of records) {
      const mealDone = r.mealStart && r.mealEnd;
      const restDone = r.restStart && r.restEnd;
      const mealInProgress = r.mealStart && !r.mealEnd;
      const restInProgress = r.restStart && !r.restEnd;
      if (mealDone || restDone) completed += 1;
      if (mealInProgress || restInProgress) inProgress += 1;
      if (r.mealExceeded || r.restExceeded) exceeded += 1;
      if (r.mealDurationMinutes) totalMinutes += r.mealDurationMinutes;
      if (r.restDurationMinutes) totalMinutes += r.restDurationMinutes;
    }
    return { completed, inProgress, exceeded, totalMinutes };
  }, [records]);

  // Comparative data per sucursal (for bar chart) — derive from records
  const comparativeData = useMemo(() => {
    const map = new Map<string, { name: string; present: number; late: number; total: number }>();
    for (const r of records) {
      const sucName = r.employee?.sucursal?.name || '—';
      const key = r.employee?.sucursal?.id || sucName;
      if (!map.has(key)) map.set(key, { name: sucName, present: 0, late: 0, total: 0 });
      const item = map.get(key)!;
      item.total += 1;
      if (r.status === 'PRESENT') item.present += 1;
      if (r.status === 'LATE') item.late += 1;
    }
    // Include absents per sucursal
    for (const a of absents) {
      const sucName = a.sucursalName || '—';
      if (!map.has(sucName)) map.set(sucName, { name: sucName, present: 0, late: 0, total: 0 });
      map.get(sucName)!.total += 1;
    }
    return Array.from(map.values()).map((s) => ({
      name: s.name,
      puntualidad: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
      present: s.present,
      late: s.late,
    }));
  }, [records, absents]);

  function handleOpenCorrection(record: any) {
    setCorrectionRecord(record);
  }

  async function handleSaveCorrection(checkInTime: string, checkOutTime: string, notes: string) {
    if (!correctionRecord) return;
    try {
      await apiSend(`/api/attendance/${correctionRecord.id}`, 'PUT', { checkInTime, checkOutTime, notes });
      toast.success('Registro actualizado', { description: 'La corrección fue guardada y marcada como pendiente de justificación.' });
      setCorrectionRecord(null);
      refetch();
    } catch (e) {
      toast.error('Error al corregir', { description: (e as Error).message });
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        <PollingToast
          data={records}
          prevCountRef={prevCountRef}
          entityLabel="asistencia de hoy"
        />

        {/* Top row: KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={Users}
            label="Empleados activos"
            value={totalEmpleados.toString()}
            sub={`${present + late} presentes · ${absent} ausentes`}
            tone="zinc"
          />
          <KpiCard
            icon={CheckCircle2}
            label="Asistencia hoy"
            value={`${asistenciaPct}%`}
            sub={`${present + late} de ${totalEmpleados}`}
            tone="emerald"
          />
          <KpiCard
            icon={AlertTriangle}
            label="Impuntualidad"
            value={`${impuntualidadPct}%`}
            sub={`${late} retardos`}
            tone="amber"
          />
          <KpiCard
            icon={Clock}
            label="Horas extra"
            value={`${overtimeHours} h`}
            sub="Acumuladas hoy"
            tone="zinc"
          />
        </div>

        {/* Sucursal selector (GA only) + freshness */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex-1 max-w-sm">
            {isGA ? (
              <div className="space-y-1.5">
                <Label htmlFor="suc-filter" className="text-xs text-muted-foreground">Sucursal</Label>
                <Select value={selectedSucursalId} onValueChange={setSelectedSucursalId}>
                  <SelectTrigger id="suc-filter">
                    <SelectValue placeholder="Todas las sucursales" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las sucursales</SelectItem>
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {sucursalLabel(s.name, s.codigoLocal)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Sucursal</p>
                <p className="text-sm font-medium">
                  {sucursales.length > 0
                    ? sucursalLabel(sucursales[0].name, sucursales[0].codigoLocal)
                    : '—'}
                </p>
              </div>
            )}
          </div>
          <FreshnessIndicator
            lastUpdated={lastUpdated}
            isFetching={isFetching}
            onRefresh={() => refetch()}
          />
        </div>

        {isLoading && <LoadingState rows={6} />}
        {isError && <ErrorState message={(error as Error)?.message || 'Error desconocido'} />}

        {/* Attendance table */}
        {!isLoading && !isError && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Asistencia de hoy</CardTitle>
                  <CardDescription>{records.length} registros · {absents.length} ausentes</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {records.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="Sin registros aún" subtitle="Los check-ins aparecerán aquí automáticamente." />
              ) : (
                <div className={`max-h-96 overflow-y-auto overflow-x-auto ${SCROLLBAR_CLASS}`}>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[220px] whitespace-nowrap">Empleado</TableHead>
                        {isGA && <TableHead className="w-[110px] whitespace-nowrap">Sucursal</TableHead>}
                        <TableHead className="w-[90px] whitespace-nowrap">Depto</TableHead>
                        <TableHead className="w-[80px] whitespace-nowrap">Entrada</TableHead>
                        <TableHead className="w-[180px] whitespace-nowrap">Descanso</TableHead>
                        <TableHead className="w-[80px] whitespace-nowrap">Salida</TableHead>
                        <TableHead className="w-[90px] whitespace-nowrap">Estado</TableHead>
                        <TableHead className="w-[65px] whitespace-nowrap">Método</TableHead>
                        <TableHead className="w-[130px] whitespace-nowrap">Ubicación</TableHead>
                        {canCorrect && <TableHead className="w-[90px] whitespace-nowrap text-right">Acciones</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {records.map((r: any) => {
                        const name = r.employee?.user?.name || r.employeeName || '—';
                        const empNumber = r.employee?.employeeNumber || r.employeeNumber || '';
                        const sucName = r.employee?.sucursal?.name || r.sucursalName || '—';
                        const sucCode = r.employee?.sucursal?.codigoLocal ?? null;
                        const dept = r.employee?.department || r.department || '—';
                        const mealStr = r.mealStart || r.restStart
                          ? `${formatTimeInMexico(r.mealStart || r.restStart)} - ${formatTimeInMexico(r.mealEnd || r.restEnd)}`
                          : '—';
                        const method = r.checkInMethod || r.checkOutMethod || '—';
                        const hasLocation = !!(r.checkInLat && r.checkInLong);
                        return (
                          <TableRow key={r.id} className="hover:bg-muted/40">
                            <TableCell className="whitespace-nowrap font-medium">
                              <div className="flex flex-col">
                                <span>{name}</span>
                                {empNumber && <span className="text-xs text-muted-foreground">#{empNumber}</span>}
                              </div>
                            </TableCell>
                            {isGA && (
                              <TableCell className="whitespace-nowrap">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="truncate block max-w-[110px]">{sucCode ? `Local ${sucCode}` : sucName}</span>
                                  </TooltipTrigger>
                                  <TooltipContent>{sucursalLabel(sucName, sucCode)}</TooltipContent>
                                </Tooltip>
                              </TableCell>
                            )}
                            <TableCell className="whitespace-nowrap text-muted-foreground">{dept}</TableCell>
                            <TableCell className="whitespace-nowrap">{formatTimeInMexico(r.checkInTime)}</TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              <div className="flex items-center gap-1">
                                {(r.mealStart || r.restStart) && <Coffee className="h-3 w-3 text-amber-500" />}
                                <span>{mealStr}</span>
                                {(r.mealExceeded || r.restExceeded) && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertTriangle className="h-3 w-3 text-rose-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>Excedió la tolerancia</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{formatTimeInMexico(r.checkOutTime)}</TableCell>
                            <TableCell className="whitespace-nowrap"><StatusBadge status={r.status} /></TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xs">{method === 'QR' ? 'QR' : method === 'MANUAL' ? 'Manual' : method === 'BIO' ? 'Bio' : method === 'WEB' ? 'Web' : '—'}</span>
                                </TooltipTrigger>
                                <TooltipContent>{method}</TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {hasLocation ? (
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                                  <MapPin className="h-3 w-3" />
                                  Validada
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Sin geo</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              {canCorrect ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 gap-1.5 text-xs"
                                  onClick={() => handleOpenCorrection(r)}
                                >
                                  <Pencil className="h-3 w-3" />
                                  Corregir
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Break summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard icon={CheckCircle2} label="Comidas completadas" value={breakSummary.completed.toString()} tone="emerald" />
          <KpiCard icon={Hourglass} label="En curso" value={breakSummary.inProgress.toString()} tone="amber" />
          <KpiCard icon={AlertTriangle} label="Excedidos" value={breakSummary.exceeded.toString()} tone="rose" />
          <KpiCard icon={Timer} label="Min. totales" value={formatMinutes(breakSummary.totalMinutes)} tone="zinc" />
        </div>

        {/* Absents list + comparative chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserX className="h-4 w-4 text-rose-500" />
                Ausentes hoy
              </CardTitle>
              <CardDescription>{absents.length} empleado(s) sin registro</CardDescription>
            </CardHeader>
            <CardContent>
              {absents.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="Sin ausentes" subtitle="Todos los empleados programados registraron asistencia." />
              ) : (
                <div className={`max-h-72 overflow-y-auto ${SCROLLBAR_CLASS} space-y-2`}>
                  {absents.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded-md border border-border bg-muted/30">
                      <div>
                        <p className="text-sm font-medium">{a.name}</p>
                        <p className="text-xs text-muted-foreground">#{a.employeeNumber} · {a.sucursalName}</p>
                      </div>
                      <Badge variant="destructive" className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200">Ausente</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileBarChart className="h-4 w-4 text-emerald-600" />
                Puntualidad por sucursal
              </CardTitle>
              <CardDescription>Comparativo de asistencia</CardDescription>
            </CardHeader>
            <CardContent>
              {comparativeData.length === 0 ? (
                <EmptyState icon={FileBarChart} title="Sin datos suficientes" />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparativeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" unit="%" />
                      <RTooltip
                        contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number) => [`${v}%`, 'Puntualidad']}
                      />
                      <Bar dataKey="puntualidad" name="Puntualidad" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Correction dialog */}
      {correctionRecord && (
        <CorrectionDialog
          record={correctionRecord}
          onClose={() => setCorrectionRecord(null)}
          onSave={handleSaveCorrection}
        />
      )}

      {/* unused prop suppression */}
      <span className="hidden">{preselectedEmployeeId}{String(setPreselectedEmployeeId)}</span>
      {loadingSucursales && null}
    </TooltipProvider>
  );
}

function KpiCard({ icon: Icon, label, value, sub, tone }: { icon: React.ElementType; label: string; value: string; sub?: string; tone: 'zinc' | 'emerald' | 'amber' | 'rose' }) {
  const toneCls = {
    zinc: 'bg-zinc-50 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  }[tone];
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
            <p className="text-2xl font-bold mt-1 leading-none">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1.5 truncate">{sub}</p>}
          </div>
          <div className={`rounded-lg p-2 shrink-0 ${toneCls}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CorrectionDialog({ record, onClose, onSave }: { record: any; onClose: () => void; onSave: (checkIn: string, checkOut: string, notes: string) => Promise<void> }) {
  const [checkInTime, setCheckInTime] = useState<string>(record?.checkInTime ? formatTimeInMexico(record.checkInTime) : '');
  const [checkOutTime, setCheckOutTime] = useState<string>(record?.checkOutTime ? formatTimeInMexico(record.checkOutTime) : '');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const name = record?.employee?.user?.name || '—';

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(checkInTime || '00:00', checkOutTime || '00:00', notes);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Corrección manual</DialogTitle>
          <DialogDescription>
            Empleado: <strong>{name}</strong> · Fecha: {formatDateInMexico(record?.date)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="check-in">Entrada (HH:mm)</Label>
              <Input id="check-in" placeholder="09:00" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="check-out">Salida (HH:mm)</Label>
              <Input id="check-out" placeholder="18:00" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" placeholder="Motivo de la corrección…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 flex items-start gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            La corrección se marcará como pendiente de justificación según NOM-037.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar corrección
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ============================================================
// EMPLOYEES VIEW
// ============================================================

interface EmployeesViewProps {
  role: Role;
  userSucursalId: string | null;
  preselectedEmployeeId: string | null;
  setPreselectedEmployeeId: (id: string | null) => void;
}

function EmployeesView({ role, userSucursalId, preselectedEmployeeId, setPreselectedEmployeeId }: EmployeesViewProps) {
  const isGA = role === 'GENERAL_ADMIN';
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [sucursalFilter, setSucursalFilter] = useState<string>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [sucursales, setSucursales] = useState<SucursalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeRow | null>(null);
  const [qrTarget, setQrTarget] = useState<EmployeeRow | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<EmployeeRow | null>(null);
  const [transferTarget, setTransferTarget] = useState<EmployeeRow | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<EmployeeRow | null>(null);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (isGA && sucursalFilter !== 'all') params.set('sucursalId', sucursalFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (departmentFilter !== 'all') params.set('department', departmentFilter);
      const qs = params.toString();
      const data = await apiGet<{ employees: EmployeeRow[] }>(`/api/employees${qs ? `?${qs}` : ''}`);
      setEmployees(data.employees);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isGA, sucursalFilter, debouncedSearch, departmentFilter]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (isGA) {
      apiGet<{ sucursales: SucursalRow[] }>('/api/sucursales')
        .then((d) => setSucursales(d.sucursales))
        .catch(() => {});
    }
  }, [isGA]);

  // unique departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => set.add(e.department || '—'));
    return Array.from(set).sort();
  }, [employees]);

  // Jump to employee from dashboard preselected
  useEffect(() => {
    if (preselectedEmployeeId) {
      const emp = employees.find((e) => e.id === preselectedEmployeeId);
      if (emp) {
        setEditTarget(emp);
        setPreselectedEmployeeId(null);
      }
    }
  }, [preselectedEmployeeId, employees, setPreselectedEmployeeId]);

  async function handleToggleActive(emp: EmployeeRow) {
    try {
      await apiSend(`/api/employees/${emp.id}`, 'PUT', {
        name: emp.user.name,
        email: emp.user.email,
        position: emp.position,
        department: emp.department,
        isActive: !emp.isActive,
      });
      toast.success(emp.isActive ? 'Empleado desactivado' : 'Empleado activado');
      setDeactivateTarget(null);
      loadEmployees();
    } catch (e) {
      toast.error('Error al cambiar estado', { description: (e as Error).message });
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="emp-search" className="text-xs text-muted-foreground">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="emp-search" placeholder="Nombre, email, número de empleado…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
              </div>
            </div>
            {isGA && (
              <div className="space-y-1.5 md:w-56">
                <Label className="text-xs text-muted-foreground">Sucursal</Label>
                <Select value={sucursalFilter} onValueChange={setSucursalFilter}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las sucursales</SelectItem>
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{sucursalLabel(s.name, s.codigoLocal)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5 md:w-48">
              <Label className="text-xs text-muted-foreground">Departamento</Label>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:ml-auto">
              <Button onClick={() => setCreateOpen(true)} className="gap-2">
                <UserPlus className="h-4 w-4" />
                Nuevo empleado
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employees table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{employees.length} empleado(s)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4"><LoadingState rows={5} /></div>
          ) : error ? (
            <ErrorState message={error} />
          ) : employees.length === 0 ? (
            <EmptyState icon={Users} title="Sin empleados" subtitle="Ajusta los filtros o crea un nuevo empleado." />
          ) : (
            <div className={`max-h-[60vh] overflow-y-auto overflow-x-auto ${SCROLLBAR_CLASS}`}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[240px] whitespace-nowrap">Empleado</TableHead>
                    {isGA && <TableHead className="w-[160px] whitespace-nowrap">Sucursal</TableHead>}
                    <TableHead className="w-[120px] whitespace-nowrap">Departamento</TableHead>
                    <TableHead className="w-[120px] whitespace-nowrap">Puesto</TableHead>
                    <TableHead className="w-[80px] whitespace-nowrap">Estado</TableHead>
                    <TableHead className="w-[220px] whitespace-nowrap text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id} className="hover:bg-muted/40">
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium">{emp.user.name}</span>
                          <span className="text-xs text-muted-foreground">{emp.user.email} · #{emp.employeeNumber}</span>
                        </div>
                      </TableCell>
                      {isGA && (
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {sucursalLabel(emp.sucursal.name, emp.sucursal.codigoLocal)}
                        </TableCell>
                      )}
                      <TableCell className="whitespace-nowrap text-muted-foreground">{emp.department}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{emp.position}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {emp.isActive && emp.user.isActive
                          ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Activo</Badge>
                          : <Badge variant="secondary" className="bg-zinc-100 text-zinc-700 hover:bg-zinc-100 border-zinc-200">Inactivo</Badge>
                        }
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditTarget(emp)} title="Editar">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setQrTarget(emp)} title="Ver QR">
                            <QrCode className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setScheduleTarget(emp)} title="Ver horario">
                            <Clock className="h-3.5 w-3.5" />
                          </Button>
                          {isGA && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setTransferTarget(emp)} title="Transferir">
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDeactivateTarget(emp)} title={emp.isActive ? 'Desactivar' : 'Activar'}>
                            {emp.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      {createOpen && (
        <EmployeeFormDialog
          mode="create"
          isGA={isGA}
          userSucursalId={userSucursalId}
          sucursales={sucursales}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); loadEmployees(); }}
        />
      )}

      {/* Edit dialog */}
      {editTarget && (
        <EmployeeFormDialog
          mode="edit"
          isGA={isGA}
          userSucursalId={userSucursalId}
          sucursales={sucursales}
          employee={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); loadEmployees(); }}
        />
      )}

      {/* QR dialog */}
      {qrTarget && (
        <QrDialog employee={qrTarget} onClose={() => setQrTarget(null)} />
      )}

      {/* Schedule dialog */}
      {scheduleTarget && (
        <ScheduleDialog employee={scheduleTarget} onClose={() => setScheduleTarget(null)} />
      )}

      {/* Transfer dialog */}
      {transferTarget && (
        <TransferDialog
          employee={transferTarget}
          sucursales={sucursales}
          onClose={() => setTransferTarget(null)}
          onTransferred={() => { setTransferTarget(null); loadEmployees(); }}
        />
      )}

      {/* Deactivate confirm */}
      {deactivateTarget && (
        <Dialog open onOpenChange={(o) => !o && setDeactivateTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{deactivateTarget.isActive ? 'Desactivar empleado' : 'Activar empleado'}</DialogTitle>
              <DialogDescription>
                {deactivateTarget.isActive
                  ? `¿Confirmas desactivar a ${deactivateTarget.user.name}? No podrá iniciar sesión.`
                  : `¿Confirmas reactivar a ${deactivateTarget.user.name}?`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeactivateTarget(null)}>Cancelar</Button>
              <Button
                variant={deactivateTarget.isActive ? 'destructive' : 'default'}
                onClick={() => handleToggleActive(deactivateTarget)}
              >
                {deactivateTarget.isActive ? 'Desactivar' : 'Activar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function EmployeeFormDialog({ mode, isGA, userSucursalId, sucursales, employee, onClose, onSaved }: {
  mode: 'create' | 'edit';
  isGA: boolean;
  userSucursalId: string | null;
  sucursales: SucursalRow[];
  employee?: EmployeeRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState(employee?.user.name || '');
  const [email, setEmail] = useState(employee?.user.email || '');
  const [password, setPassword] = useState('');
  const [employeeNumber, setEmployeeNumber] = useState(employee?.employeeNumber || '');
  const [position, setPosition] = useState(employee?.position || '');
  const [department, setDepartment] = useState(employee?.department || '');
  const [sucursalId, setSucursalId] = useState(employee?.sucursalId || userSucursalId || '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !position || !department) {
      toast.error('Completa todos los campos requeridos');
      return;
    }
    if (!isEdit && !password) {
      toast.error('La contraseña es requerida');
      return;
    }
    if (!isEdit && !employeeNumber) {
      toast.error('El número de empleado es requerido');
      return;
    }
    if (!sucursalId) {
      toast.error('Selecciona una sucursal');
      return;
    }
    setSaving(true);
    try {
      if (isEdit && employee) {
        const body: Record<string, unknown> = { name, email, position, department };
        if (isGA) body.sucursalId = sucursalId;
        await apiSend(`/api/employees/${employee.id}`, 'PUT', body);
        toast.success('Empleado actualizado');
      } else {
        await apiSend('/api/employees', 'POST', { name, email, password, employeeNumber, position, department, sucursalId });
        toast.success('Empleado creado');
      }
      onSaved();
    } catch (e) {
      toast.error('Error al guardar', { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Actualiza los datos del empleado.' : 'Crea un nuevo empleado con horario L-V 9-18 por defecto.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="f-name">Nombre *</Label>
            <Input id="f-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-email">Email *</Label>
            <Input id="f-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="f-num">Número de empleado *</Label>
              <Input id="f-num" value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="f-pos">Puesto *</Label>
            <Input id="f-pos" value={position} onChange={(e) => setPosition(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-dep">Departamento *</Label>
            <Input id="f-dep" value={department} onChange={(e) => setDepartment(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-suc">Sucursal *</Label>
            <Select value={sucursalId} onValueChange={setSucursalId} disabled={!isGA && !!userSucursalId}>
              <SelectTrigger id="f-suc"><SelectValue placeholder="Selecciona…" /></SelectTrigger>
              <SelectContent>
                {sucursales.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{sucursalLabel(s.name, s.codigoLocal)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isEdit && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="f-pass">Contraseña *</Label>
              <Input id="f-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
          )}
          <DialogFooter className="sm:col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear empleado'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QrDialog({ employee, onClose }: { employee: EmployeeRow; onClose: () => void }) {
  const [data, setData] = useState<{ qrDataUrl: string; qrToken: string; employeeNumber: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const d = await apiGet<{ qrDataUrl: string; qrToken: string; employeeNumber: string; name: string }>(`/api/employees/${employee.id}/qr`);
        if (mounted) { setData(d); setLoading(false); }
      } catch (e) {
        if (mounted) { setError((e as Error).message); setLoading(false); }
      }
    })();
    return () => { mounted = false; };
  }, [employee.id]);

  function handleDownload() {
    if (!data) return;
    const a = document.createElement('a');
    a.href = data.qrDataUrl;
    a.download = `qr-${employee.employeeNumber}.png`;
    a.click();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Código QR del empleado</DialogTitle>
          <DialogDescription>{employee.user.name} · #{employee.employeeNumber}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center py-4 gap-3">
          {loading ? (
            <div className="h-48 w-48 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : error ? (
            <ErrorState message={error} />
          ) : data ? (
            <>
              <img src={data.qrDataUrl} alt="QR" className="h-48 w-48 rounded-md border border-border" />
              <p className="text-xs text-muted-foreground text-center break-all">{data.qrToken}</p>
              <Button onClick={handleDownload} variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Descargar PNG
              </Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({ employee, onClose }: { employee: EmployeeRow; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Horario semanal</DialogTitle>
          <DialogDescription>{employee.user.name} · #{employee.employeeNumber}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {(employee.workSchedules || []).length === 0 ? (
            <EmptyState icon={Clock} title="Sin horario asignado" subtitle="Se usará el horario por defecto L-V 9-18." />
          ) : (
            (employee.workSchedules || []).sort((a, b) => a.dayOfWeek - b.dayOfWeek).map((s) => (
              <div key={s.id} className="flex items-center justify-between p-2 rounded-md border border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium">{WEEKDAYS[s.dayOfWeek]}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {s.startTime} - {s.endTime}
                  {s.isWeeklyRest && <Badge variant="outline" className="ml-2">Descanso</Badge>}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog({ employee, sucursales, onClose, onTransferred }: {
  employee: EmployeeRow;
  sucursales: SucursalRow[];
  onClose: () => void;
  onTransferred: () => void;
}) {
  const [targetSucursalId, setTargetSucursalId] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleTransfer() {
    if (!targetSucursalId) {
      toast.error('Selecciona una sucursal destino');
      return;
    }
    if (targetSucursalId === employee.sucursalId) {
      toast.error('El empleado ya está en esa sucursal');
      return;
    }
    setSaving(true);
    try {
      await apiSend(`/api/employees/${employee.id}/transfer`, 'POST', { newSucursalId: targetSucursalId });
      toast.success('Empleado transferido');
      onTransferred();
    } catch (e) {
      toast.error('Error al transferir', { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Transferir empleado</DialogTitle>
          <DialogDescription>
            Mover a <strong>{employee.user.name}</strong> de <strong>{sucursalLabel(employee.sucursal.name, employee.sucursal.codigoLocal)}</strong> a otra sucursal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Sucursal destino</Label>
            <Select value={targetSucursalId} onValueChange={setTargetSucursalId}>
              <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
              <SelectContent>
                {sucursales.filter((s) => s.id !== employee.sucursalId).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{sucursalLabel(s.name, s.codigoLocal)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleTransfer} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ============================================================
// SUCURSALES VIEW
// ============================================================

function SucursalesView({ role }: { role: Role }) {
  const isGA = role === 'GENERAL_ADMIN';
  const [sucursales, setSucursales] = useState<SucursalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SucursalRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SucursalRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await apiGet<{ sucursales: SucursalRow[] }>('/api/sucursales');
      setSucursales(d.sucursales);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiSend(`/api/sucursales/${deleteTarget.id}`, 'DELETE');
      toast.success('Sucursal eliminada');
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error('Error al eliminar', { description: (e as Error).message });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">{isGA ? 'Sucursales' : 'Mi Sucursal'}</h3>
          <p className="text-sm text-muted-foreground">{isGA ? 'Administra todas las sucursales' : 'Configuración de tu sucursal'}</p>
        </div>
        {isGA && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nueva sucursal
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingState rows={3} />
      ) : error ? (
        <ErrorState message={error} />
      ) : sucursales.length === 0 ? (
        <EmptyState icon={Building2} title="Sin sucursales" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sucursales.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-emerald-600" />
                      {sucursalLabel(s.name, s.codigoLocal)}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {s.address || 'Sin dirección'} · {s.employeeCount ?? 0} empleado(s)
                    </CardDescription>
                  </div>
                  {s.isActive
                    ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Activa</Badge>
                    : <Badge variant="secondary">Inactiva</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Geofence</span>
                    <p className="font-medium">{s.enforceGeofence ? `${s.geofenceRadiusMeters}m` : 'No'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tol. salida</span>
                    <p className="font-medium">{s.checkoutToleranceMinutes} min</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Comida</span>
                    <p className="font-medium">{s.mealDurationMinutes} min (±{s.mealToleranceMinutes})</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Descanso</span>
                    <p className="font-medium">{s.restDurationMinutes} min (±{s.restToleranceMinutes})</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => setEditTarget(s)} className="gap-1.5">
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Button>
                  {isGA && (
                    <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => setDeleteTarget(s)}>
                      <Trash2 className="h-3 w-3 mr-1.5" />
                      Eliminar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {createOpen && (
        <SucursalFormDialog mode="create" onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); load(); }} />
      )}
      {editTarget && (
        <SucursalFormDialog mode="edit" sucursal={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load(); }} />
      )}
      {deleteTarget && (
        <Dialog open onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Eliminar sucursal</DialogTitle>
              <DialogDescription>
                ¿Eliminar <strong>{sucursalLabel(deleteTarget.name, deleteTarget.codigoLocal)}</strong>? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function SucursalFormDialog({ mode, sucursal, onClose, onSaved }: {
  mode: 'create' | 'edit';
  sucursal?: SucursalRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = mode === 'edit';
  const [form, setForm] = useState({
    name: sucursal?.name || '',
    codigoLocal: sucursal?.codigoLocal || '',
    address: sucursal?.address || '',
    latitude: sucursal?.latitude?.toString() || '',
    longitude: sucursal?.longitude?.toString() || '',
    geofenceRadiusMeters: (sucursal?.geofenceRadiusMeters ?? 150).toString(),
    enforceGeofence: sucursal?.enforceGeofence ?? false,
    mealToleranceMinutes: (sucursal?.mealToleranceMinutes ?? 5).toString(),
    restToleranceMinutes: (sucursal?.restToleranceMinutes ?? 3).toString(),
    mealDurationMinutes: (sucursal?.mealDurationMinutes ?? 30).toString(),
    restDurationMinutes: (sucursal?.restDurationMinutes ?? 15).toString(),
    checkoutToleranceMinutes: (sucursal?.checkoutToleranceMinutes ?? 10).toString(),
    isActive: sucursal?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) {
      toast.error('El nombre es requerido');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        codigoLocal: form.codigoLocal || null,
        address: form.address,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        geofenceRadiusMeters: parseInt(form.geofenceRadiusMeters, 10),
        enforceGeofence: form.enforceGeofence,
        mealToleranceMinutes: parseInt(form.mealToleranceMinutes, 10),
        restToleranceMinutes: parseInt(form.restToleranceMinutes, 10),
        mealDurationMinutes: parseInt(form.mealDurationMinutes, 10),
        restDurationMinutes: parseInt(form.restDurationMinutes, 10),
        checkoutToleranceMinutes: parseInt(form.checkoutToleranceMinutes, 10),
        isActive: form.isActive,
      };
      if (isEdit && sucursal) {
        await apiSend(`/api/sucursales/${sucursal.id}`, 'PUT', body);
        toast.success('Sucursal actualizada');
      } else {
        await apiSend('/api/sucursales', 'POST', body);
        toast.success('Sucursal creada');
      }
      onSaved();
    } catch (e) {
      toast.error('Error al guardar', { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar sucursal' : 'Nueva sucursal'}</DialogTitle>
          <DialogDescription>Configura datos generales, geofence y tolerancias.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input value={form.name} onChange={(e) => update('name', e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Código de local</Label>
            <Input value={form.codigoLocal} onChange={(e) => update('codigoLocal', e.target.value)} placeholder="Ej. 261" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Dirección</Label>
            <Input value={form.address} onChange={(e) => update('address', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Latitud</Label>
            <Input value={form.latitude} onChange={(e) => update('latitude', e.target.value)} placeholder="19.4326" />
          </div>
          <div className="space-y-1.5">
            <Label>Longitud</Label>
            <Input value={form.longitude} onChange={(e) => update('longitude', e.target.value)} placeholder="-99.1332" />
          </div>
          <div className="space-y-1.5">
            <Label>Radio geofence (m)</Label>
            <Input type="number" value={form.geofenceRadiusMeters} onChange={(e) => update('geofenceRadiusMeters', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tol. salida (min)</Label>
            <Input type="number" value={form.checkoutToleranceMinutes} onChange={(e) => update('checkoutToleranceMinutes', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Duración comida (min)</Label>
            <Input type="number" value={form.mealDurationMinutes} onChange={(e) => update('mealDurationMinutes', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tol. comida (min)</Label>
            <Input type="number" value={form.mealToleranceMinutes} onChange={(e) => update('mealToleranceMinutes', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Duración descanso (min)</Label>
            <Input type="number" value={form.restDurationMinutes} onChange={(e) => update('restDurationMinutes', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Tol. descanso (min)</Label>
            <Input type="number" value={form.restToleranceMinutes} onChange={(e) => update('restToleranceMinutes', e.target.value)} />
          </div>
          <div className="space-y-1.5 flex items-center gap-3 sm:col-span-2">
            <Switch checked={form.enforceGeofence} onCheckedChange={(v) => update('enforceGeofence', v)} id="geo-switch" />
            <Label htmlFor="geo-switch" className="cursor-pointer">Aplicar geofence</Label>
            <Switch checked={form.isActive} onCheckedChange={(v) => update('isActive', v)} id="active-switch" className="ml-6" />
            <Label htmlFor="active-switch" className="cursor-pointer">Activa</Label>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? 'Guardar' : 'Crear sucursal'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


// ============================================================
// USERS VIEW (GA only)
// ============================================================

function UsersView() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [sucursales, setSucursales] = useState<SucursalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = roleFilter !== 'all' ? `?role=${roleFilter}` : '';
      const d = await apiGet<{ users: UserRow[] }>(`/api/users${qs}`);
      setUsers(d.users);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiGet<{ sucursales: SucursalRow[] }>('/api/sucursales').then((d) => setSucursales(d.sucursales)).catch(() => {});
  }, []);

  async function handleToggleActive(u: UserRow) {
    try {
      await apiSend(`/api/users/${u.id}`, 'PUT', { isActive: !u.isActive });
      toast.success(u.isActive ? 'Usuario desactivado' : 'Usuario activado');
      load();
    } catch (e) {
      toast.error('Error', { description: (e as Error).message });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Usuarios y roles</h3>
          <p className="text-sm text-muted-foreground">Administra cuentas y permisos</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Label className="text-xs text-muted-foreground">Filtrar por rol</Label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="GENERAL_ADMIN">Administradores Generales</SelectItem>
                <SelectItem value="SUCURSAL_ADMIN">Admins de Sucursal</SelectItem>
                <SelectItem value="EMPLOYEE">Empleados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? <div className="p-4"><LoadingState rows={5} /></div>
          : error ? <ErrorState message={error} />
          : users.length === 0 ? <EmptyState icon={ShieldCheck} title="Sin usuarios" />
          : (
            <div className={`max-h-[60vh] overflow-y-auto overflow-x-auto ${SCROLLBAR_CLASS}`}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[220px] whitespace-nowrap">Usuario</TableHead>
                    <TableHead className="w-[140px] whitespace-nowrap">Rol</TableHead>
                    <TableHead className="w-[160px] whitespace-nowrap">Sucursal</TableHead>
                    <TableHead className="w-[120px] whitespace-nowrap">Estado</TableHead>
                    <TableHead className="w-[140px] whitespace-nowrap">Último login</TableHead>
                    <TableHead className="w-[260px] whitespace-nowrap text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const isLocked = !!u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now();
                    return (
                      <TableRow key={u.id} className="hover:bg-muted/40">
                        <TableCell className="whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-medium">{u.name}</span>
                            <span className="text-xs text-muted-foreground">{u.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={u.role === 'GENERAL_ADMIN' ? 'default' : u.role === 'SUCURSAL_ADMIN' ? 'secondary' : 'outline'}>
                            {roleLabel(u.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {u.sucursal ? sucursalLabel(u.sucursal.name, u.sucursal.codigoLocal) : '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {isLocked ? (
                            <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200">Bloqueado</Badge>
                          ) : u.isActive ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Activo</Badge>
                          ) : (
                            <Badge variant="secondary">Inactivo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {u.lastLoginAt ? formatDateTimeInMexico(u.lastLoginAt) : '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          <div className="inline-flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditTarget(u)} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setResetTarget(u)} title="Resetear contraseña"><KeyRound className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setUnlockTarget(u)} title="Desbloquear" disabled={!isLocked}><Unlock className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleToggleActive(u)} title={u.isActive ? 'Desactivar' : 'Activar'}>
                              {u.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {createOpen && (
        <UserFormDialog mode="create" sucursales={sucursales} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); load(); }} />
      )}
      {editTarget && (
        <UserFormDialog mode="edit" sucursales={sucursales} user={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load(); }} />
      )}
      {resetTarget && (
        <ResetPasswordDialog user={resetTarget} onClose={() => setResetTarget(null)} />
      )}
      {unlockTarget && (
        <UnlockDialog user={unlockTarget} onClose={() => setUnlockTarget(null)} />
      )}
    </div>
  );
}

function UserFormDialog({ mode, sucursales, user, onClose, onSaved }: {
  mode: 'create' | 'edit';
  sucursales: SucursalRow[];
  user?: UserRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(user?.role || 'SUCURSAL_ADMIN');
  const [sucursalId, setSucursalId] = useState(user?.sucursalId || '');
  const [employeeNumber, setEmployeeNumber] = useState(user?.employee?.employeeNumber || '');
  const [position, setPosition] = useState(user?.employee?.position || '');
  const [department, setDepartment] = useState(user?.employee?.department || '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !role) { toast.error('Completa los campos requeridos'); return; }
    if (!isEdit && !password) { toast.error('La contraseña es requerida'); return; }
    if (role === 'SUCURSAL_ADMIN' && !sucursalId) { toast.error('Selecciona una sucursal'); return; }
    if (role === 'EMPLOYEE' && !employeeNumber) { toast.error('El número de empleado es requerido'); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { name, email, role };
      if (!isEdit) body.password = password;
      if (role === 'SUCURSAL_ADMIN' || role === 'EMPLOYEE') body.sucursalId = sucursalId;
      if (role === 'EMPLOYEE') { body.employeeNumber = employeeNumber; body.position = position; body.department = department; }
      if (isEdit && user) {
        await apiSend(`/api/users/${user.id}`, 'PUT', body);
        toast.success('Usuario actualizado');
      } else {
        await apiSend('/api/users', 'POST', body);
        toast.success('Usuario creado');
      }
      onSaved();
    } catch (e) {
      toast.error('Error al guardar', { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Actualiza los datos del usuario.' : 'Crea un usuario con un rol específico.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Rol *</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={isEdit && user?.role === 'GENERAL_ADMIN'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GENERAL_ADMIN">Administrador General</SelectItem>
                <SelectItem value="SUCURSAL_ADMIN">Admin de Sucursal</SelectItem>
                <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                <SelectItem value="EMPLOYEE">Empleado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(role === 'SUCURSAL_ADMIN' || role === 'SUPERVISOR' || role === 'EMPLOYEE') && (
            <div className="space-y-1.5">
              <Label>Sucursal *</Label>
              <Select value={sucursalId} onValueChange={setSucursalId}>
                <SelectTrigger><SelectValue placeholder="Selecciona…" /></SelectTrigger>
                <SelectContent>
                  {sucursales.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{sucursalLabel(s.name, s.codigoLocal)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {role === 'EMPLOYEE' && (
            <>
              <div className="space-y-1.5">
                <Label>Número de empleado *</Label>
                <Input value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Puesto</Label>
                <Input value={position} onChange={(e) => setPosition(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Departamento</Label>
                <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
              </div>
            </>
          )}
          {!isEdit && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Contraseña *</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
          )}
          <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isEdit ? 'Guardar' : 'Crear usuario'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);

  async function handleReset() {
    setSaving(true);
    try {
      const body = password ? { newPassword: password } : {};
      const res = await apiSend<{ password?: string; generated?: boolean }>(`/api/users/${user.id}/reset-password`, 'POST', body);
      if (res.generated && res.password) {
        setGenerated(res.password);
        toast.success('Contraseña generada automáticamente');
      } else {
        toast.success('Contraseña restablecida');
        onClose();
      }
    } catch (e) {
      toast.error('Error', { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  function copyToClipboard() {
    if (!generated) return;
    navigator.clipboard.writeText(generated);
    toast.success('Contraseña copiada');
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Resetear contraseña</DialogTitle>
          <DialogDescription>{user.name} · {user.email}</DialogDescription>
        </DialogHeader>
        {generated ? (
          <div className="space-y-3 py-2">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700 mb-1">Nueva contraseña generada (cópiala ahora, no se mostrará de nuevo):</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono flex-1 break-all">{generated}</code>
                <Button size="sm" variant="outline" onClick={copyToClipboard} className="shrink-0">Copiar</Button>
              </div>
            </div>
            <Button onClick={onClose} className="w-full">Cerrar</Button>
          </div>
        ) : (
          <>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Nueva contraseña (opcional)</Label>
                <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Dejar vacío para generar" />
                <p className="text-xs text-muted-foreground">Mínimo 6 caracteres. Si la dejas vacía se generará una automáticamente y se desbloqueará la cuenta.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button onClick={handleReset} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Resetear
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UnlockDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  async function handleUnlock() {
    setSaving(true);
    try {
      await apiSend(`/api/users/${user.id}/unlock`, 'POST');
      toast.success('Cuenta desbloqueada');
      onClose();
    } catch (e) {
      toast.error('Error', { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Desbloquear cuenta</DialogTitle>
          <DialogDescription>
            ¿Desbloquear a <strong>{user.name}</strong>? Se reiniciarán los intentos fallidos.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleUnlock} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Desbloquear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ============================================================
// VACATIONS VIEW
// ============================================================

function VacationsView() {
  const [tab, setTab] = useState<'pending' | 'history' | 'balances'>('pending');
  const [vacations, setVacations] = useState<VacationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [rejectTarget, setRejectTarget] = useState<VacationRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (tab === 'pending') params.set('status', 'PENDING');
      if (tab === 'history') {
        if (filterStatus !== 'all') params.set('status', filterStatus);
        if (filterType !== 'all') params.set('type', filterType);
        if (filterStart) params.set('startDate', filterStart);
        if (filterEnd) params.set('endDate', filterEnd);
      }
      const d = await apiGet<{ vacations: VacationRow[] }>(`/api/vacations?${params.toString()}`);
      const filtered = filterEmployee
        ? d.vacations.filter((v) => v.employee.user.name.toLowerCase().includes(filterEmployee.toLowerCase()))
        : d.vacations;
      setVacations(filtered);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab, filterStatus, filterType, filterEmployee, filterStart, filterEnd]);

  useEffect(() => { load(); }, [load]);

  async function handleApprove(v: VacationRow) {
    try {
      await apiSend(`/api/vacations/${v.id}`, 'PUT', { status: 'APPROVED' });
      toast.success('Solicitud aprobada');
      load();
    } catch (e) {
      toast.error('Error al aprobar', { description: (e as Error).message });
    }
  }

  async function handleReject(reason: string) {
    if (!rejectTarget) return;
    try {
      await apiSend(`/api/vacations/${rejectTarget.id}`, 'PUT', { status: 'REJECTED', rejectionReason: reason });
      toast.success('Solicitud rechazada');
      setRejectTarget(null);
      load();
    } catch (e) {
      toast.error('Error al rechazar', { description: (e as Error).message });
    }
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Pendientes
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <HistoryIcon className="h-3.5 w-3.5" />
            Historial
          </TabsTrigger>
          <TabsTrigger value="balances" className="gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Saldos
          </TabsTrigger>
        </TabsList>

        {/* Pending tab */}
        <TabsContent value="pending" className="space-y-4">
          {loading ? <LoadingState rows={3} />
          : error ? <ErrorState message={error} />
          : vacations.length === 0 ? (
            <Card><CardContent className="py-8"><EmptyState icon={CheckCircle2} title="Sin solicitudes pendientes" /></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {vacations.map((v) => (
                <Card key={v.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{v.employee.user.name}</p>
                        <p className="text-xs text-muted-foreground">#{v.employee.employeeNumber} · {sucursalLabel(v.employee.sucursal.name, v.employee.sucursal.codigoLocal)}</p>
                      </div>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">{VACATION_TYPE_LABEL[v.type] || v.type}</Badge>
                    </div>
                    <div className="text-sm">
                      <p><span className="text-muted-foreground">Periodo:</span> {formatDateInMexico(v.startDate)} → {formatDateInMexico(v.endDate)}</p>
                      <p><span className="text-muted-foreground">Días:</span> {v.days}</p>
                      {v.reason && <p className="text-muted-foreground italic mt-1">"{v.reason}"</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(v)}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Aprobar
                      </Button>
                      <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => setRejectTarget(v)}>
                        <XCircle className="h-3.5 w-3.5" />
                        Rechazar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* History tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Empleado</Label>
                  <Input placeholder="Buscar…" value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} className="w-44" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tipo</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {Object.entries(VACATION_TYPE_LABEL).map(([k, lbl]) => (
                        <SelectItem key={k} value={k}>{lbl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Estado</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {Object.entries(VACATION_STATUS_LABEL).map(([k, lbl]) => (
                        <SelectItem key={k} value={k}>{lbl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Desde</Label>
                  <Input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} className="w-40" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Hasta</Label>
                  <Input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} className="w-40" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {loading ? <div className="p-4"><LoadingState rows={5} /></div>
              : vacations.length === 0 ? <EmptyState icon={CalendarCheck} title="Sin solicitudes" />
              : (
                <div className={`max-h-[60vh] overflow-y-auto overflow-x-auto ${SCROLLBAR_CLASS}`}>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[200px] whitespace-nowrap">Empleado</TableHead>
                        <TableHead className="w-[100px] whitespace-nowrap">Tipo</TableHead>
                        <TableHead className="w-[180px] whitespace-nowrap">Periodo</TableHead>
                        <TableHead className="w-[60px] whitespace-nowrap">Días</TableHead>
                        <TableHead className="w-[110px] whitespace-nowrap">Estado</TableHead>
                        <TableHead className="w-[140px] whitespace-nowrap">Solicitado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vacations.map((v) => (
                        <TableRow key={v.id} className="hover:bg-muted/40">
                          <TableCell className="whitespace-nowrap font-medium">{v.employee.user.name}</TableCell>
                          <TableCell className="whitespace-nowrap">{VACATION_TYPE_LABEL[v.type] || v.type}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateInMexico(v.startDate)} → {formatDateInMexico(v.endDate)}</TableCell>
                          <TableCell className="whitespace-nowrap">{v.days}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge variant={VACATION_STATUS_VARIANT[v.status] || 'outline'}>{VACATION_STATUS_LABEL[v.status] || v.status}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTimeInMexico(v.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balances tab */}
        <TabsContent value="balances">
          <VacationBalancesTab />
        </TabsContent>
      </Tabs>

      {rejectTarget && (
        <RejectDialog
          vacation={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onReject={handleReject}
        />
      )}
    </div>
  );
}

function VacationBalancesTab() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [balances, setBalances] = useState<Record<string, { totalDays: number; usedDays: number; remainingDays: number; pendingDays: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await apiGet<{ employees: EmployeeRow[] }>('/api/employees');
        setEmployees(d.employees);
        // Fetch balances in parallel
        const entries = await Promise.all(
          d.employees.map(async (e) => {
            try {
              const b = await apiGet<{ totalDays: number; usedDays: number; remainingDays: number; pendingDays: number }>(`/api/vacations/balance/${e.id}`);
              return [e.id, b] as const;
            } catch {
              return [e.id, { totalDays: e.vacationBalanceDays ?? 0, usedDays: 0, remainingDays: e.vacationBalanceDays ?? 0, pendingDays: 0 }] as const;
            }
          })
        );
        setBalances(Object.fromEntries(entries));
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingState rows={5} />;

  return (
    <Card>
      <CardContent className="p-0">
        {employees.length === 0 ? <EmptyState icon={CalendarDays} title="Sin empleados" /> : (
          <div className={`max-h-[60vh] overflow-y-auto overflow-x-auto ${SCROLLBAR_CLASS}`}>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[260px] whitespace-nowrap">Empleado</TableHead>
                  <TableHead className="w-[100px] whitespace-nowrap">Total</TableHead>
                  <TableHead className="w-[100px] whitespace-nowrap">Usados</TableHead>
                  <TableHead className="w-[100px] whitespace-nowrap">Pendientes</TableHead>
                  <TableHead className="w-[120px] whitespace-nowrap">Disponibles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => {
                  const b = balances[e.id] || { totalDays: 0, usedDays: 0, remainingDays: 0, pendingDays: 0 };
                  const pct = b.totalDays > 0 ? Math.round((b.usedDays / b.totalDays) * 100) : 0;
                  return (
                    <TableRow key={e.id} className="hover:bg-muted/40">
                      <TableCell className="whitespace-nowrap font-medium">{e.user.name}</TableCell>
                      <TableCell className="whitespace-nowrap">{b.totalDays} d</TableCell>
                      <TableCell className="whitespace-nowrap">{b.usedDays} d</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {b.pendingDays > 0 ? <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">{b.pendingDays} d</Badge> : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className={b.remainingDays > 0 ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}>
                          {b.remainingDays} d ({pct}%)
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RejectDialog({ vacation, onClose, onReject }: { vacation: VacationRow; onClose: () => void; onReject: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  async function handleSubmit() {
    if (!reason) { toast.error('Indica el motivo de rechazo'); return; }
    setSaving(true);
    try { await onReject(reason); } finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rechazar solicitud</DialogTitle>
          <DialogDescription>{vacation.employee.user.name} · {VACATION_TYPE_LABEL[vacation.type]}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Motivo *</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Justificación del rechazo…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Rechazar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


// ============================================================
// HISTORY VIEW
// ============================================================

function HistoryView({ role }: { role: Role }) {
  const isGA = role === 'GENERAL_ADMIN';
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [date, setDate] = useState(getMexicoTodayISO());
  const [sucursalId, setSucursalId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const debouncedSearch = useDebounced(employeeSearch);
  const [sucursales, setSucursales] = useState<SucursalRow[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employeeHistory, setEmployeeHistory] = useState<{ employee: EmployeeRow | null; records: any[]; loading: boolean }>({ employee: null, records: [], loading: false });
  const [searchResults, setSearchResults] = useState<EmployeeRow[]>([]);

  useEffect(() => {
    if (isGA) {
      apiGet<{ sucursales: SucursalRow[] }>('/api/sucursales').then((d) => setSucursales(d.sucursales)).catch(() => {});
    }
  }, [isGA]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      params.set('period', period);
      params.set('date', date);
      if (isGA && sucursalId !== 'all') params.set('sucursalId', sucursalId);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const d = await apiGet<{ records: any[] }>(`/api/attendance/history?${params.toString()}`);
      setRecords(d.records || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [period, date, isGA, sucursalId, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Filter by employee search
  const filteredRecords = useMemo(() => {
    if (!debouncedSearch) return records;
    const q = debouncedSearch.toLowerCase();
    return records.filter((r) => r.employee?.user?.name?.toLowerCase().includes(q) || r.employee?.employeeNumber?.includes(q));
  }, [records, debouncedSearch]);

  // Employee history search
  useEffect(() => {
    if (!debouncedSearch) { setSearchResults([]); return; }
    apiGet<{ employees: EmployeeRow[] }>(`/api/employees?search=${encodeURIComponent(debouncedSearch)}`)
      .then((d) => setSearchResults(d.employees.slice(0, 5)))
      .catch(() => setSearchResults([]));
  }, [debouncedSearch]);

  function handleSelectEmployee(emp: EmployeeRow) {
    setEmployeeHistory({ employee: emp, records: [], loading: true });
    const params = new URLSearchParams();
    params.set('period', 'month');
    params.set('date', getMexicoTodayISO());
    params.set('employeeId', emp.id);
    apiGet<{ records: any[] }>(`/api/attendance/history?${params.toString()}`)
      .then((d) => setEmployeeHistory({ employee: emp, records: d.records || [], loading: false }))
      .catch(() => setEmployeeHistory({ employee: emp, records: [], loading: false }));
  }

  function exportCsv() {
    if (filteredRecords.length === 0) { toast.error('Sin datos para exportar'); return; }
    const rows = [
      ['Empleado', 'Número', 'Sucursal', 'Fecha', 'Entrada', 'Salida', 'Comida', 'Descanso', 'Estado', 'Min. trabajados', 'Min. extra'],
      ...filteredRecords.map((r) => [
        r.employee?.user?.name || '',
        r.employee?.employeeNumber || '',
        r.employee?.sucursal?.name || '',
        formatDateInMexico(r.date),
        formatTimeInMexico(r.checkInTime),
        formatTimeInMexico(r.checkOutTime),
        r.mealStart ? `${formatTimeInMexico(r.mealStart)}-${formatTimeInMexico(r.mealEnd)}` : '',
        r.restStart ? `${formatTimeInMexico(r.restStart)}-${formatTimeInMexico(r.restEnd)}` : '',
        STATUS_LABEL[r.status] || r.status,
        r.workedMinutes?.toString() || '0',
        r.overtimeMinutes?.toString() || '0',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `historial_${period}_${date}.csv`;
    a.click();
    toast.success('CSV exportado');
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Periodo</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Día</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
            </div>
            {isGA && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Sucursal</Label>
                <Select value={sucursalId} onValueChange={setSucursalId}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{sucursalLabel(s.name, s.codigoLocal)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PRESENT">Presente</SelectItem>
                  <SelectItem value="LATE">Retardo</SelectItem>
                  <SelectItem value="EARLY_LEAVE">Salida anticipada</SelectItem>
                  <SelectItem value="ABSENT">Ausente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground">Buscar empleado</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Nombre o número…" value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} className="pl-8" />
              </div>
            </div>
            <Button variant="outline" onClick={exportCsv} className="gap-1.5">
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search results dropdown */}
      {searchResults.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-2">Empleados encontrados — clic para ver historial completo:</p>
            <div className="flex flex-wrap gap-2">
              {searchResults.map((e) => (
                <Button key={e.id} size="sm" variant="outline" onClick={() => handleSelectEmployee(e)}>
                  {e.user.name} · #{e.employeeNumber}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee history */}
      {employeeHistory.employee && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <HistoryIcon className="h-4 w-4 text-emerald-600" />
                  Historial de {employeeHistory.employee.user.name}
                </CardTitle>
                <CardDescription>Últimos 30 días · {employeeHistory.records.length} registro(s)</CardDescription>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEmployeeHistory({ employee: null, records: [], loading: false })}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {employeeHistory.loading ? <div className="p-4"><LoadingState rows={4} /></div>
            : employeeHistory.records.length === 0 ? <EmptyState icon={HistoryIcon} title="Sin registros" />
            : (
              <div className={`max-h-72 overflow-y-auto overflow-x-auto ${SCROLLBAR_CLASS}`}>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[120px] whitespace-nowrap">Fecha</TableHead>
                      <TableHead className="w-[80px] whitespace-nowrap">Entrada</TableHead>
                      <TableHead className="w-[80px] whitespace-nowrap">Salida</TableHead>
                      <TableHead className="w-[100px] whitespace-nowrap">Estado</TableHead>
                      <TableHead className="w-[100px] whitespace-nowrap">Trabajado</TableHead>
                      <TableHead className="w-[100px] whitespace-nowrap">Extra</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeHistory.records.map((r) => (
                      <TableRow key={r.id} className="hover:bg-muted/40">
                        <TableCell className="whitespace-nowrap">{formatDateInMexico(r.date)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatTimeInMexico(r.checkInTime)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatTimeInMexico(r.checkOutTime)}</TableCell>
                        <TableCell className="whitespace-nowrap"><StatusBadge status={r.status} /></TableCell>
                        <TableCell className="whitespace-nowrap">{formatMinutes(r.workedMinutes)}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.overtimeMinutes ? formatMinutes(r.overtimeMinutes) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main history table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{filteredRecords.length} registro(s)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-4"><LoadingState rows={5} /></div>
          : error ? <ErrorState message={error} />
          : filteredRecords.length === 0 ? <EmptyState icon={HistoryIcon} title="Sin registros en el periodo" />
          : (
            <div className={`max-h-[60vh] overflow-y-auto overflow-x-auto ${SCROLLBAR_CLASS}`}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[120px] whitespace-nowrap">Fecha</TableHead>
                    <TableHead className="w-[200px] whitespace-nowrap">Empleado</TableHead>
                    {isGA && <TableHead className="w-[140px] whitespace-nowrap">Sucursal</TableHead>}
                    <TableHead className="w-[80px] whitespace-nowrap">Entrada</TableHead>
                    <TableHead className="w-[80px] whitespace-nowrap">Salida</TableHead>
                    <TableHead className="w-[100px] whitespace-nowrap">Estado</TableHead>
                    <TableHead className="w-[100px] whitespace-nowrap">Trabajado</TableHead>
                    <TableHead className="w-[100px] whitespace-nowrap">Extra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/40">
                      <TableCell className="whitespace-nowrap">{formatDateInMexico(r.date)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium">{r.employee?.user?.name || '—'}</span>
                          <span className="text-xs text-muted-foreground">#{r.employee?.employeeNumber || ''}</span>
                        </div>
                      </TableCell>
                      {isGA && <TableCell className="whitespace-nowrap text-muted-foreground">{r.employee?.sucursal ? sucursalLabel(r.employee.sucursal.name, r.employee.sucursal.codigoLocal) : '—'}</TableCell>}
                      <TableCell className="whitespace-nowrap">{formatTimeInMexico(r.checkInTime)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatTimeInMexico(r.checkOutTime)}</TableCell>
                      <TableCell className="whitespace-nowrap"><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="whitespace-nowrap">{formatMinutes(r.workedMinutes)}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.overtimeMinutes ? formatMinutes(r.overtimeMinutes) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


// ============================================================
// REPORTS VIEW
// ============================================================

type ReportSubType = 'daily' | 'overtime' | 'absences' | 'incidences' | 'comparative';

function ReportsView({ role }: { role: Role }) {
  const isGA = role === 'GENERAL_ADMIN';
  const [subType, setSubType] = useState<ReportSubType>('daily');
  const [startDate, setStartDate] = useState(getMexicoTodayISO());
  const [endDate, setEndDate] = useState(getMexicoTodayISO());
  const [sucursalId, setSucursalId] = useState('all');
  const [employeeId, setEmployeeId] = useState('all');
  const [sucursales, setSucursales] = useState<SucursalRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyRow | null>(null);

  const subTypes: { id: ReportSubType; label: string }[] = isGA
    ? [
        { id: 'daily', label: 'Diario' },
        { id: 'overtime', label: 'Horas Extra' },
        { id: 'absences', label: 'Ausencias' },
        { id: 'incidences', label: 'Incidencias' },
        { id: 'comparative', label: 'Comparativa' },
      ]
    : [
        { id: 'daily', label: 'Diario' },
        { id: 'overtime', label: 'Horas Extra' },
        { id: 'absences', label: 'Ausencias' },
        { id: 'incidences', label: 'Incidencias' },
      ];

  useEffect(() => {
    if (isGA) {
      apiGet<{ sucursales: SucursalRow[] }>('/api/sucursales').then((d) => setSucursales(d.sucursales)).catch(() => {});
      apiGet<{ employees: EmployeeRow[] }>('/api/employees').then((d) => setEmployees(d.employees)).catch(() => {});
    }
    apiGet<{ company: CompanyRow | null }>('/api/company').then((d) => setCompany(d.company)).catch(() => {});
  }, [isGA]);

  const canRun = !!startDate && !!endDate && startDate <= endDate;

  async function runReport() {
    if (!canRun) { toast.error('Revisa el rango de fechas'); return; }
    setLoading(true); setError(null); setData(null);
    try {
      const params = new URLSearchParams();
      // Daily uses ?date= ; others use ?startDate&endDate
      if (subType === 'daily') {
        params.set('date', startDate);
      } else {
        params.set('startDate', startDate);
        params.set('endDate', endDate);
      }
      if (isGA && sucursalId !== 'all') params.set('sucursalId', sucursalId);
      if (subType === 'overtime' && employeeId !== 'all') params.set('employeeId', employeeId);
      const d = await apiGet<any>(`/api/reports/${subType}?${params.toString()}`);
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function exportReport(format: 'csv' | 'xlsx') {
    const params = new URLSearchParams();
    params.set('type', subType);
    params.set('startDate', startDate);
    params.set('endDate', endDate);
    params.set('format', format);
    if (isGA && sucursalId !== 'all') params.set('sucursalId', sucursalId);
    if (subType === 'overtime' && employeeId !== 'all') params.set('employeeId', employeeId);
    const url = `/api/reports/export?${params.toString()}`;
    // Open in new tab to trigger download
    window.open(url, '_blank');
    toast.success(`Exportando ${format.toUpperCase()}…`);
  }

  return (
    <div className="space-y-4">
      {/* Sub-report selector */}
      <div className="flex flex-wrap gap-2">
        {subTypes.map((st) => (
          <Button
            key={st.id}
            variant={subType === st.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setSubType(st.id); setData(null); }}
            className={subType === st.id ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            {st.label}
          </Button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            {subType === 'daily' ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fecha</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Desde</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Hasta</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
                </div>
              </>
            )}
            {isGA && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Sucursal</Label>
                <Select value={sucursalId} onValueChange={setSucursalId}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{sucursalLabel(s.name, s.codigoLocal)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {subType === 'overtime' && isGA && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Empleado</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.user.name} · #{e.employeeNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={runReport} disabled={loading || !canRun} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Generar
            </Button>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportReport('csv')} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportReport('xlsx')} className="gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                XLSX
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Print header with company data (visible on print) */}
      {company && (
        <div className="hidden print:block mb-4">
          <h2 className="text-lg font-bold">{company.razonSocial}</h2>
          <p className="text-sm">RFC: {company.rfc}</p>
          {company.domicilioFiscal && <p className="text-sm">{company.domicilioFiscal}</p>}
          {company.representanteLegal && <p className="text-sm">Representante: {company.representanteLegal}</p>}
        </div>
      )}

      {/* Report body */}
      {loading ? <LoadingState rows={6} />
      : error ? <ErrorState message={error} />
      : data ? <ReportBody subType={subType} data={data} isGA={isGA} />
      : <EmptyState icon={FileBarChart} title="Genera un reporte" subtitle="Configura los filtros y presiona Generar." />}
    </div>
  );
}

function ReportBody({ subType, data, isGA }: { subType: ReportSubType; data: any; isGA: boolean }) {
  if (subType === 'daily') return <DailyReportBody data={data} isGA={isGA} />;
  if (subType === 'overtime') return <OvertimeReportBody data={data} isGA={isGA} />;
  if (subType === 'absences') return <AbsencesReportBody data={data} isGA={isGA} />;
  if (subType === 'incidences') return <IncidencesReportBody data={data} isGA={isGA} />;
  if (subType === 'comparative') return <ComparativeReportBody data={data} />;
  return null;
}

function DailyReportBody({ data, isGA }: { data: any; isGA: boolean }) {
  const records: any[] = data.records || [];
  const bySucursal: any[] = data.bySucursal || [];
  const summary = data.summary || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="Total" value={(summary.total ?? 0).toString()} tone="zinc" />
        <KpiCard icon={CheckCircle2} label="Presentes" value={(summary.present ?? 0).toString()} tone="emerald" />
        <KpiCard icon={AlertTriangle} label="Retardos" value={(summary.late ?? 0).toString()} tone="amber" />
        <KpiCard icon={UserX} label="Ausentes" value={(summary.absent ?? 0).toString()} tone="rose" />
      </div>
      {isGA && bySucursal.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Resumen por sucursal</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className={`max-h-72 overflow-y-auto overflow-x-auto ${SCROLLBAR_CLASS}`}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="whitespace-nowrap">Sucursal</TableHead>
                    <TableHead className="whitespace-nowrap">Total</TableHead>
                    <TableHead className="whitespace-nowrap">Presentes</TableHead>
                    <TableHead className="whitespace-nowrap">Retardos</TableHead>
                    <TableHead className="whitespace-nowrap">Ausentes</TableHead>
                    <TableHead className="whitespace-nowrap">HE</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bySucursal.map((s) => (
                    <TableRow key={s.sucursalId}>
                      <TableCell className="whitespace-nowrap font-medium">{sucursalLabel(s.name, s.codigoLocal)}</TableCell>
                      <TableCell className="whitespace-nowrap">{s.total}</TableCell>
                      <TableCell className="whitespace-nowrap">{s.present}</TableCell>
                      <TableCell className="whitespace-nowrap">{s.late}</TableCell>
                      <TableCell className="whitespace-nowrap">{s.absent}</TableCell>
                      <TableCell className="whitespace-nowrap">{s.totalOvertimeHours} h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">Detalle del día</CardTitle></CardHeader>
        <CardContent className="p-0">
          {records.length === 0 ? <EmptyState icon={FileBarChart} title="Sin registros" /> : (
            <div className={`max-h-[60vh] overflow-y-auto overflow-x-auto ${SCROLLBAR_CLASS}`}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[200px] whitespace-nowrap">Empleado</TableHead>
                    {isGA && <TableHead className="w-[140px] whitespace-nowrap">Sucursal</TableHead>}
                    <TableHead className="w-[80px] whitespace-nowrap">Entrada</TableHead>
                    <TableHead className="w-[80px] whitespace-nowrap">Salida</TableHead>
                    <TableHead className="w-[100px] whitespace-nowrap">Estado</TableHead>
                    <TableHead className="w-[100px] whitespace-nowrap">Trabajado</TableHead>
                    <TableHead className="w-[100px] whitespace-nowrap">Extra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap font-medium">{r.name} <span className="text-xs text-muted-foreground">#{r.employeeNumber}</span></TableCell>
                      {isGA && <TableCell className="whitespace-nowrap text-muted-foreground">{sucursalLabel(r.sucursalName, r.sucursalCodigoLocal)}</TableCell>}
                      <TableCell className="whitespace-nowrap">{formatTimeInMexico(r.checkInTime)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatTimeInMexico(r.checkOutTime)}</TableCell>
                      <TableCell className="whitespace-nowrap"><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="whitespace-nowrap">{formatMinutes(r.workedMinutes)}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.overtimeMinutes ? formatMinutes(r.overtimeMinutes) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OvertimeReportBody({ data, isGA }: { data: any; isGA: boolean }) {
  const byEmployee: any[] = data.byEmployee || [];
  const summary = data.summary || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Users} label="Empleados" value={(summary.totalEmployees ?? 0).toString()} tone="zinc" />
        <KpiCard icon={Clock} label="Horas extra" value={`${summary.totalOvertimeHours ?? 0} h`} tone="amber" />
        <KpiCard icon={Timer} label="Promedio" value={`${summary.avgPerEmployee ?? 0} h`} tone="zinc" />
        <KpiCard icon={FileBarChart} label="Registros" value={(summary.totalRecords ?? 0).toString()} tone="emerald" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Horas extra por empleado</CardTitle></CardHeader>
        <CardContent className="p-0">
          {byEmployee.length === 0 ? <EmptyState icon={Clock} title="Sin horas extra en el periodo" /> : (
            <div className={`max-h-[60vh] overflow-y-auto overflow-x-auto ${SCROLLBAR_CLASS}`}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="whitespace-nowrap">Empleado</TableHead>
                    {isGA && <TableHead className="whitespace-nowrap">Sucursal</TableHead>}
                    <TableHead className="whitespace-nowrap">Días</TableHead>
                    <TableHead className="whitespace-nowrap">Horas trabajadas</TableHead>
                    <TableHead className="whitespace-nowrap">Horas extra</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byEmployee.map((e: any) => (
                    <TableRow key={e.employeeId}>
                      <TableCell className="whitespace-nowrap font-medium">{e.name} <span className="text-xs text-muted-foreground">#{e.employeeNumber}</span></TableCell>
                      {isGA && <TableCell className="whitespace-nowrap text-muted-foreground">{sucursalLabel(e.sucursalName, e.sucursalCodigoLocal)}</TableCell>}
                      <TableCell className="whitespace-nowrap">{e.days}</TableCell>
                      <TableCell className="whitespace-nowrap">{e.totalWorkedHours} h</TableCell>
                      <TableCell className="whitespace-nowrap font-medium text-amber-700">{e.totalOvertimeHours} h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AbsencesReportBody({ data, isGA }: { data: any; isGA: boolean }) {
  const byEmployee: any[] = data.byEmployee || [];
  const summary = data.summary || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard icon={UserX} label="Empleados con faltas" value={(summary.totalEmployeesWithAbsences ?? 0).toString()} tone="rose" />
        <KpiCard icon={CalendarDays} label="Total faltas" value={(summary.totalAbsents ?? 0).toString()} tone="amber" />
        <KpiCard icon={CalendarCheck} label="Días evaluados" value={(data.totalWorkDays ?? 0).toString()} tone="zinc" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Faltas por empleado</CardTitle></CardHeader>
        <CardContent className="p-0">
          {byEmployee.length === 0 ? <EmptyState icon={CheckCircle2} title="Sin faltas" subtitle="Ningún empleado registró faltas en el periodo." /> : (
            <div className={`max-h-[60vh] overflow-y-auto overflow-x-auto ${SCROLLBAR_CLASS}`}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="whitespace-nowrap">Empleado</TableHead>
                    {isGA && <TableHead className="whitespace-nowrap">Sucursal</TableHead>}
                    <TableHead className="whitespace-nowrap">Faltas</TableHead>
                    <TableHead className="whitespace-nowrap">Fechas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byEmployee.map((e: any) => (
                    <TableRow key={e.employeeId}>
                      <TableCell className="whitespace-nowrap font-medium">{e.name} <span className="text-xs text-muted-foreground">#{e.employeeNumber}</span></TableCell>
                      {isGA && <TableCell className="whitespace-nowrap text-muted-foreground">{e.sucursalName}</TableCell>}
                      <TableCell className="whitespace-nowrap"><Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200">{e.absentDays}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{e.absentDates?.slice(0, 5).map((d: string) => formatDateInMexico(d)).join(', ')}{e.absentDates?.length > 5 ? '…' : ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function IncidencesReportBody({ data, isGA }: { data: any; isGA: boolean }) {
  const byEmployee: any[] = data.byEmployee || [];
  const totals = data.totals || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={CheckCircle2} label="Días laborados" value={(totals.diasLaborados ?? 0).toString()} tone="emerald" />
        <KpiCard icon={AlertTriangle} label="Retardos" value={(totals.retardos ?? 0).toString()} tone="amber" />
        <KpiCard icon={UserX} label="Faltas" value={(totals.faltas ?? 0).toString()} tone="rose" />
        <KpiCard icon={Clock} label="Horas extra" value={`${totals.horasExtraHoras ?? 0} h`} tone="zinc" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Incidencias por empleado</CardTitle></CardHeader>
        <CardContent className="p-0">
          {byEmployee.length === 0 ? <EmptyState icon={FileBarChart} title="Sin incidencias" /> : (
            <div className={`max-h-[60vh] overflow-y-auto overflow-x-auto ${SCROLLBAR_CLASS}`}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="whitespace-nowrap">Empleado</TableHead>
                    {isGA && <TableHead className="whitespace-nowrap">Sucursal</TableHead>}
                    <TableHead className="whitespace-nowrap">Lab.</TableHead>
                    <TableHead className="whitespace-nowrap">Faltas</TableHead>
                    <TableHead className="whitespace-nowrap">Ret.</TableHead>
                    <TableHead className="whitespace-nowrap">S.A.</TableHead>
                    <TableHead className="whitespace-nowrap">HE h</TableHead>
                    <TableHead className="whitespace-nowrap">Vac.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byEmployee.map((e: any) => (
                    <TableRow key={e.employeeId}>
                      <TableCell className="whitespace-nowrap font-medium">{e.name}</TableCell>
                      {isGA && <TableCell className="whitespace-nowrap text-muted-foreground">{e.sucursalName}</TableCell>}
                      <TableCell className="whitespace-nowrap">{e.diasLaborados}</TableCell>
                      <TableCell className="whitespace-nowrap">{e.faltas}</TableCell>
                      <TableCell className="whitespace-nowrap">{e.retardos}</TableCell>
                      <TableCell className="whitespace-nowrap">{e.salidasAnticipadas}</TableCell>
                      <TableCell className="whitespace-nowrap">{e.horasExtraHoras}</TableCell>
                      <TableCell className="whitespace-nowrap">{e.diasVacaciones}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ComparativeReportBody({ data }: { data: any }) {
  const sucursales: any[] = data.sucursales || [];
  const summary = data.summary || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={Building2} label="Sucursales" value={(summary.totalSucursales ?? 0).toString()} tone="zinc" />
        <KpiCard icon={Users} label="Empleados" value={(summary.totalEmployees ?? 0).toString()} tone="emerald" />
        <KpiCard icon={CheckCircle2} label="% asist. prom." value={`${summary.avgAttendanceRate ?? 0}%`} tone="emerald" />
        <KpiCard icon={Clock} label="HE total" value={`${summary.totalOvertimeHours ?? 0} h`} tone="amber" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Comparativo por sucursal</CardTitle></CardHeader>
        <CardContent>
          {sucursales.length === 0 ? <EmptyState icon={Building2} title="Sin datos" /> : (
            <>
              <div className="h-72 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sucursales} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" unit="%" />
                    <RTooltip contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="attendanceRate" name="% Asistencia" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="absentDays" name="Días ausente" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className={`max-h-72 overflow-y-auto overflow-x-auto ${SCROLLBAR_CLASS}`}>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="whitespace-nowrap">Sucursal</TableHead>
                      <TableHead className="whitespace-nowrap">Empleados</TableHead>
                      <TableHead className="whitespace-nowrap">Presentes</TableHead>
                      <TableHead className="whitespace-nowrap">Ausentes</TableHead>
                      <TableHead className="whitespace-nowrap">% Asist.</TableHead>
                      <TableHead className="whitespace-nowrap">HE h</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sucursales.map((s) => (
                      <TableRow key={s.sucursalId}>
                        <TableCell className="whitespace-nowrap font-medium">{sucursalLabel(s.name, s.codigoLocal)}</TableCell>
                        <TableCell className="whitespace-nowrap">{s.totalEmployees}</TableCell>
                        <TableCell className="whitespace-nowrap">{s.presentDays}</TableCell>
                        <TableCell className="whitespace-nowrap">{s.absentDays}</TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-emerald-700">{s.attendanceRate}%</TableCell>
                        <TableCell className="whitespace-nowrap">{s.overtimeHours}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


// ============================================================
// AUDIT VIEW
// ============================================================

function AuditView({ role }: { role: Role }) {
  const isGA = role === 'GENERAL_ADMIN';
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [sucursalId, setSucursalId] = useState('all');
  const [sucursales, setSucursales] = useState<SucursalRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (isGA) {
      apiGet<{ sucursales: SucursalRow[] }>('/api/sucursales').then((d) => setSucursales(d.sucursales)).catch(() => {});
    }
  }, [isGA]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '50');
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (userFilter) params.set('userId', userFilter);
      if (start) params.set('startDate', start);
      if (end) params.set('endDate', end);
      if (isGA && sucursalId !== 'all') params.set('sucursalId', sucursalId);
      const d = await apiGet<{ logs: AuditLogRow[]; pagination: { totalPages: number; total: number } }>(`/api/audit?${params.toString()}`);
      setLogs(d.logs);
      setTotalPages(d.pagination.totalPages);
      setTotal(d.pagination.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, userFilter, start, end, isGA, sucursalId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Acción</Label>
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
                <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.keys(ACTION_LABELS).sort().map((a) => (
                    <SelectItem key={a} value={a}>{ACTION_LABELS[a]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Usuario (ID)</Label>
              <Input placeholder="UUID…" value={userFilter} onChange={(e) => { setUserFilter(e.target.value); setPage(1); }} className="w-56" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Desde</Label>
              <Input type="date" value={start} onChange={(e) => { setStart(e.target.value); setPage(1); }} className="w-40" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Hasta</Label>
              <Input type="date" value={end} onChange={(e) => { setEnd(e.target.value); setPage(1); }} className="w-40" />
            </div>
            {isGA && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Sucursal</Label>
                <Select value={sucursalId} onValueChange={(v) => { setSucursalId(v); setPage(1); }}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{sucursalLabel(s.name, s.codigoLocal)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{total} evento(s)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="p-4"><LoadingState rows={6} /></div>
          : error ? <ErrorState message={error} />
          : logs.length === 0 ? <EmptyState icon={ScrollText} title="Sin eventos" />
          : (
            <div className={`max-h-[60vh] overflow-y-auto overflow-x-auto ${SCROLLBAR_CLASS}`}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[140px] whitespace-nowrap">Fecha/Hora</TableHead>
                    <TableHead className="w-[180px] whitespace-nowrap">Acción</TableHead>
                    <TableHead className="w-[180px] whitespace-nowrap">Usuario</TableHead>
                    <TableHead className="w-[120px] whitespace-nowrap">IP</TableHead>
                    <TableHead className="w-[60px] whitespace-nowrap"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => {
                    const isExpanded = expandedId === l.id;
                    return (
                      <>
                        <TableRow key={l.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : l.id)}>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTimeInMexico(l.createdAt)}</TableCell>
                          <TableCell className="whitespace-nowrap font-medium">{actionLabel(l.action)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex flex-col">
                              <span>{l.user?.name || '—'}</span>
                              <span className="text-xs text-muted-foreground">{l.user?.email || ''}</span>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground font-mono">{l.ipAddress || '—'}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${l.id}-detail`} className="bg-muted/20">
                            <TableCell colSpan={5} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                <div>
                                  <p className="text-muted-foreground">Tipo entidad</p>
                                  <p className="font-medium">{l.entityType || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">ID entidad</p>
                                  <p className="font-mono break-all">{l.entityId || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">User Agent</p>
                                  <p className="font-mono break-all">{l.userAgent || '—'}</p>
                                </div>
                              </div>
                              {l.details && (
                                <div className="mt-3">
                                  <p className="text-xs text-muted-foreground mb-1">Detalles</p>
                                  <pre className={`text-xs bg-background border border-border rounded-md p-3 overflow-x-auto max-h-48 ${SCROLLBAR_CLASS}`}>
                                    {JSON.stringify(l.details, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Página {page} de {totalPages}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="h-3.5 w-3.5" /> Anterior
          </Button>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Siguiente <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}


// ============================================================
// QR TERMINAL VIEW
// ============================================================

function QRTerminalView() {
  const { data, isLoading, refetch, isFetching } = useDynamicQR();
  const [secondsLeft, setSecondsLeft] = useState(300);
  // QR generado localmente con la lib `qrcode` (sin enviar el token a terceros).
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [kioskMode, setKioskMode] = useState(false);

  useEffect(() => {
    if (data?.expiresAt) {
      const expiry = new Date(data.expiresAt).getTime();
      const interval = setInterval(() => {
        const left = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
        setSecondsLeft(left);
        if (left <= 0) {
          refetch();
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [data, refetch]);

  // ------------------------------------------------------------
  // Generación local del QR como data URL (NO filtra el token a
  // servicios de terceros como api.qrserver.com).
  // Se regenera cada vez que cambia `data.code`.
  // ------------------------------------------------------------
  useEffect(() => {
    if (!data?.code) {
      setQrDataUrl(null);
      setQrError(null);
      return;
    }
    let cancelled = false;
    setQrError(null);
    import('qrcode')
      .then((QRCode) => {
        QRCode.toDataURL(
          data.code,
          {
            width: 300,
            margin: 2,
            color: { dark: '#0F172A', light: '#FFFFFF' },
          },
          (err: Error | null | undefined, url: string) => {
            if (cancelled) return;
            if (err) {
              setQrError(err.message || 'No se pudo generar el QR');
              setQrDataUrl(null);
              return;
            }
            setQrDataUrl(url);
          },
        );
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'No se pudo cargar la librería qrcode';
        setQrError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [data?.code]);

  const downloadPng = () => {
    if (!data?.code) return;
    import('qrcode').then((QRCode) => {
      const canvas = document.createElement('canvas');
      QRCode.toCanvas(canvas, data.code, { width: 400, margin: 2 }, (err: any) => {
        if (err) return;
        const link = document.createElement('a');
        link.download = `qr-dinamico-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
      });
    });
  };

  // ------------------------------------------------------------
  // Modo kiosco: pantalla completa + QR gigante.
  // ------------------------------------------------------------
  const enterKioskMode = async () => {
    try {
      if (typeof document !== 'undefined' && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Algunos navegadores bloquean fullscreen — aún así mostramos UI kiosco.
    }
    setKioskMode(true);
  };

  const exitKioskMode = async () => {
    setKioskMode(false);
    try {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  };

  // Sincronizar kioskMode si el usuario sale de fullscreen con Esc.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handler = () => {
      if (!document.fullscreenElement && kioskMode) {
        setKioskMode(false);
      }
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [kioskMode]);

  // ------------------------------------------------------------
  // Render kiosco (pantalla completa)
  // ------------------------------------------------------------
  if (kioskMode) {
    return (
      <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={exitKioskMode}
          className="absolute top-4 right-4 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Minimize2 className="w-4 h-4" /> Salir del modo kiosco
        </Button>

        <div className="flex flex-col items-center gap-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Terminal QR NOM-037</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Escanea este código con la app de empleado para registrar asistencia.
            </p>
          </div>

          <div className="relative">
            {isLoading ? (
              <Loader2 className="h-12 w-12 animate-spin text-zinc-400" />
            ) : qrDataUrl ? (
              <div className="rounded-2xl border-4 border-zinc-900 p-6 bg-white shadow-2xl">
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  width={400}
                  height={400}
                  className="w-[400px] h-[400px]"
                />
              </div>
            ) : qrError ? (
              <div className="w-[400px] h-[400px] flex items-center justify-center bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm p-4 text-center">
                {qrError}
              </div>
            ) : (
              <div className="w-[400px] h-[400px] flex items-center justify-center bg-muted rounded-xl">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-3xl font-mono font-bold tabular-nums">
            <Clock className="w-7 h-7 text-emerald-600" />
            {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, '0')}
            <span className="text-base font-normal text-muted-foreground">restantes</span>
          </div>

          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            Generar nuevo código
          </Button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // Render normal (vista de administración)
  // ------------------------------------------------------------
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" /> Terminal QR Dinámico
              </CardTitle>
              <CardDescription>
                Código para login kiosco. Expira en {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, '0')}
              </CardDescription>
            </div>
            <Button onClick={enterKioskMode} variant="outline" className="gap-2 shrink-0">
              <Maximize2 className="h-4 w-4" /> Modo kiosco
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {isLoading ? (
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          ) : data?.code ? (
            <>
              <div className="rounded-xl border-2 border-zinc-200 p-4 bg-white">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" width={300} height={300} />
                ) : qrError ? (
                  <div className="w-[300px] h-[300px] flex items-center justify-center text-rose-700 text-sm p-4 text-center">
                    {qrError}
                  </div>
                ) : (
                  <div className="w-[300px] h-[300px] flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                  </div>
                )}
              </div>
              <p className="text-xs text-zinc-500 font-mono break-all max-w-md text-center">
                {data.code.substring(0, 60)}...
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button onClick={() => refetch()} variant="outline" className="gap-2">
                  <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
                  Generar nuevo
                </Button>
                <Button onClick={downloadPng} variant="outline" className="gap-2">
                  <Download className="h-4 w-4" /> Descargar PNG
                </Button>
              </div>
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 max-w-md text-center flex items-center gap-1.5 justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                El QR se genera localmente en tu navegador. El token nunca se envía a servicios externos.
              </p>
            </>
          ) : (
            <p className="text-zinc-500">No hay código generado</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// COMPANY VIEW
// ============================================================

function CompanyView() {
  const [company, setCompany] = useState<any>(null);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    razonSocial: '',
    rfc: '',
    registroPatronal: '',
    domicilioFiscal: '',
    telefono: '',
    email: '',
    representanteLegal: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, hRes] = await Promise.all([
        authFetch('/api/company'),
        authFetch('/api/holidays'),
      ]);
      const c = cRes.ok ? await cRes.json() : null;
      const h = hRes.ok ? await hRes.json() : { holidays: [] };
      setCompany(c);
      if (c) {
        setForm({
          razonSocial: c.razonSocial || '',
          rfc: c.rfc || '',
          registroPatronal: c.registroPatronal || '',
          domicilioFiscal: c.domicilioFiscal || '',
          telefono: c.telefono || '',
          email: c.email || '',
          representanteLegal: c.representanteLegal || '',
        });
      }
      setHolidays(h.holidays || []);
    } catch (e) {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authFetch('/api/company', {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Error al guardar');
        return;
      }
      toast.success('Datos de empresa guardados');
      load();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState rows={6} />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" /> Datos de la Empresa
          </CardTitle>
          <CardDescription>Información fiscal y legal — requerida para NOM-037</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Razón Social</Label>
              <Input value={form.razonSocial} onChange={(e) => setForm({...form, razonSocial: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>RFC</Label>
              <Input value={form.rfc} onChange={(e) => setForm({...form, rfc: e.target.value.toUpperCase()})} />
            </div>
            <div className="space-y-2">
              <Label>Registro Patronal</Label>
              <Input value={form.registroPatronal} onChange={(e) => setForm({...form, registroPatronal: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Representante Legal</Label>
              <Input value={form.representanteLegal} onChange={(e) => setForm({...form, representanteLegal: e.target.value})} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Domicilio Fiscal</Label>
              <Input value={form.domicilioFiscal} onChange={(e) => setForm({...form, domicilioFiscal: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={(e) => setForm({...form, telefono: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" /> Días Feriados Oficiales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Oficial</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="whitespace-nowrap">{formatDateInMexico(h.date)}</TableCell>
                    <TableCell className="font-medium">{h.name}</TableCell>
                    <TableCell className="text-zinc-500 text-sm">{h.description || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={h.isOfficial ? 'default' : 'secondary'}>
                        {h.isOfficial ? 'Oficial' : 'Opcional'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// SETTINGS VIEW — MFA TOTP management
// ============================================================

interface MfaSetupResponse {
  message?: string;
  qrDataUrl?: string;
  secret?: string;
  backupCodes?: string[];
  nextStep?: string;
}

function SettingsView() {
  // Estado de MFA (cargado desde /api/auth/me)
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [mfaEnrolledAt, setMfaEnrolledAt] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Dialog de activación (3 pasos)
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<1 | 2 | 3>(1);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupData, setSetupData] = useState<MfaSetupResponse | null>(null);
  const [verifyToken, setVerifyToken] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);

  // Dialog de desactivación
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableToken, setDisableToken] = useState('');
  const [disableUseBackup, setDisableUseBackup] = useState(false);
  const [disableBackupCode, setDisableBackupCode] = useState('');

  // Cargar estado de MFA al montar
  const refreshMfaStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const data = await apiGet<{ user: { mfaEnabled?: boolean; mfaEnrolledAt?: string | null } }>('/api/auth/me');
      setMfaEnabled(!!data.user?.mfaEnabled);
      setMfaEnrolledAt(data.user?.mfaEnrolledAt ?? null);
    } catch {
      // silencioso
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    refreshMfaStatus();
  }, [refreshMfaStatus]);

  // --- Activación: paso 1 → llama /setup ---
  const startSetup = async () => {
    setSetupOpen(true);
    setSetupStep(1);
    setSetupData(null);
    setVerifyToken('');
    setSecretCopied(false);
    setSetupLoading(true);
    try {
      const data = await apiSend<MfaSetupResponse>('/api/auth/mfa/setup', 'POST');
      setSetupData(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al iniciar configuración MFA');
      setSetupOpen(false);
    } finally {
      setSetupLoading(false);
    }
  };

  const copySecret = async () => {
    if (!setupData?.secret) return;
    try {
      await navigator.clipboard.writeText(setupData.secret);
      setSecretCopied(true);
      toast.success('Código secreto copiado');
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      toast.error('No se pudo copiar al portapapeles');
    }
  };

  // --- Activación: paso 2 → llama /verify ---
  const handleVerify = async () => {
    const token = verifyToken.trim();
    if (!/^\d{6}$/.test(token)) {
      toast.error('El código debe ser de 6 dígitos');
      return;
    }
    setSetupLoading(true);
    try {
      await apiSend('/api/auth/mfa/verify', 'POST', { token });
      toast.success('MFA activado correctamente');
      setVerifyToken('');
      setSetupStep(3);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Código inválido');
      setVerifyToken('');
    } finally {
      setSetupLoading(false);
    }
  };

  // --- Activación: paso 3 → descargar códigos de respaldo ---
  const downloadBackupCodes = () => {
    if (!setupData?.backupCodes?.length) return;
    const lines = [
      'Control de Asistencia NOM-037 — Códigos de respaldo MFA',
      `Generados: ${new Date().toLocaleString('es-MX')}`,
      '',
      'Instrucciones:',
      '- Guarda este archivo en un lugar seguro (no en el correo).',
      '- Cada código solo se puede usar UNA vez.',
      '- Si pierdes tu dispositivo autenticador, usa uno de estos códigos',
      '  para iniciar sesión o desactivar MFA.',
      '',
      'Códigos:',
      ...setupData.backupCodes.map((c, i) => `${(i + 1).toString().padStart(2, '0')}. ${c}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codigos-respaldo-mfa.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Códigos descargados');
  };

  const finishSetup = () => {
    setSetupOpen(false);
    setSetupStep(1);
    setSetupData(null);
    setVerifyToken('');
    refreshMfaStatus();
    toast.success('Configuración MFA completada');
  };

  // --- Desactivación ---
  const handleDisable = async () => {
    const token = disableToken.trim();
    const backup = disableBackupCode.trim();
    if (!disableUseBackup && !/^\d{6}$/.test(token)) {
      toast.error('El código debe ser de 6 dígitos');
      return;
    }
    if (disableUseBackup && backup.length < 8) {
      toast.error('Ingresa un código de respaldo válido');
      return;
    }
    setDisableLoading(true);
    try {
      const payload: Record<string, string> = {};
      if (disableUseBackup) {
        payload.backupCode = backup;
      } else {
        payload.token = token;
      }
      await apiSend('/api/auth/mfa/disable', 'POST', payload);
      toast.success('MFA desactivado');
      setDisableOpen(false);
      setDisableToken('');
      setDisableBackupCode('');
      setDisableUseBackup(false);
      refreshMfaStatus();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo desactivar MFA');
      setDisableToken('');
      setDisableBackupCode('');
    } finally {
      setDisableLoading(false);
    }
  };

  const enrolledDateFormatted = mfaEnrolledAt
    ? new Intl.DateTimeFormat('es-MX', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(mfaEnrolledAt))
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" /> Configuración del Sistema
          </CardTitle>
          <CardDescription>
            Gestiona la seguridad de tu cuenta y preferencias de acceso.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* MFA Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-teal-600" />
                Autenticación de dos factores (MFA)
                {loadingStatus ? (
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                ) : mfaEnabled ? (
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> MFA activo
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-zinc-500">
                    <ShieldAlert className="h-3 w-3 mr-1" /> No activo
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="max-w-2xl">
                Añade una capa extra de seguridad. Necesitarás un código de tu app
                autenticadora (Google Authenticator, Authy, 1Password) cada vez que
                inicies sesión.
              </CardDescription>
            </div>
            <div className="flex-shrink-0">
              {!loadingStatus && !mfaEnabled && (
                <Button onClick={startSetup} disabled={setupLoading}>
                  <Shield className="h-4 w-4 mr-1" /> Activar MFA
                </Button>
              )}
              {!loadingStatus && mfaEnabled && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setDisableOpen(true);
                    setDisableToken('');
                    setDisableBackupCode('');
                    setDisableUseBackup(false);
                  }}
                >
                  <ShieldAlert className="h-4 w-4 mr-1" /> Desactivar MFA
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingStatus ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : mfaEnabled ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-emerald-900">
                    Tu cuenta está protegida con autenticación de dos factores.
                  </p>
                  {enrolledDateFormatted && (
                    <p className="text-xs text-emerald-700">
                      Activo desde {enrolledDateFormatted}.
                    </p>
                  )}
                  <p className="text-xs text-emerald-700 mt-2">
                    Al iniciar sesión se te pedirá un código de 6 dígitos de tu app
                    autenticadora. Si pierdes tu dispositivo, puedes usar uno de los
                    códigos de respaldo que generaste al activar MFA.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-200 p-6 text-center">
              <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
              <p className="font-medium text-zinc-700">MFA no está activado</p>
              <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
                Activa la autenticación de dos factores para proteger tu cuenta contra
                accesos no autorizados, incluso si alguien obtiene tu contraseña.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* DIALOG: Activación MFA (3 pasos) */}
      {/* ============================================================ */}
      <Dialog
        open={setupOpen}
        onOpenChange={(open) => {
          // Permitir cerrar solo si no estamos en medio de una carga
          if (!setupLoading) {
            setSetupOpen(open);
            if (!open) {
              setSetupStep(1);
              setSetupData(null);
              setVerifyToken('');
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-600" />
              Activar autenticación de dos factores
            </DialogTitle>
            <DialogDescription>
              Paso {setupStep} de 3 · Sigue las instrucciones para proteger tu cuenta.
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 py-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  setupStep >= s ? 'bg-teal-500' : 'bg-zinc-200'
                )}
              />
            ))}
          </div>

          {setupStep === 1 && (
            <div className="space-y-4">
              {setupLoading ? (
                <div className="flex flex-col items-center py-8 gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                  <p className="text-sm text-zinc-500">Generando secreto y código QR...</p>
                </div>
              ) : setupData ? (
                <>
                  <div>
                    <p className="text-sm font-medium text-zinc-900 mb-2">Escanea el QR</p>
                    <div className="flex justify-center bg-white border border-zinc-200 rounded-lg p-3">
                      <img
                        src={setupData.qrDataUrl}
                        alt="Código QR para configurar MFA"
                        width={240}
                        height={240}
                        className="h-auto w-[240px]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-600">
                      Si no puedes escanear el QR, ingresa este código manualmente en tu
                      app autenticadora:
                    </p>
                    <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
                      <code className="flex-1 font-mono text-xs break-all text-zinc-800">
                        {setupData.secret}
                      </code>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={copySecret}
                        className="flex-shrink-0 h-8 px-2"
                      >
                        {secretCopied ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      onClick={() => setSetupStep(2)}
                      className="w-full"
                    >
                      Ya lo escaneé, continuar <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <p className="text-sm text-zinc-500 text-center py-6">
                  No se pudo generar la configuración. Cierra e intenta de nuevo.
                </p>
              )}
            </div>
          )}

          {setupStep === 2 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-zinc-900 mb-1">
                  Verifica el código
                </p>
                <p className="text-xs text-zinc-600 mb-3">
                  Ingresa el código de 6 dígitos que muestra tu app autenticadora.
                </p>
                <div className="flex justify-center py-2">
                  <InputOTP
                    maxLength={6}
                    value={verifyToken}
                    onChange={(v) => setVerifyToken(v)}
                    disabled={setupLoading}
                    autoFocus
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
              <DialogFooter className="flex-row gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSetupStep(1)}
                  disabled={setupLoading}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" /> Volver
                </Button>
                <Button
                  type="button"
                  onClick={handleVerify}
                  disabled={setupLoading || verifyToken.length !== 6}
                >
                  {setupLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Verificando...
                    </>
                  ) : (
                    'Verificar y activar'
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}

          {setupStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
                <p className="text-sm font-medium">¡MFA activado correctamente!</p>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-900 mb-1">
                  Guarda tus códigos de respaldo
                </p>
                <p className="text-xs text-zinc-600 mb-3">
                  Guarda estos códigos en un lugar seguro. Si pierdes tu dispositivo,
                  los necesitarás para recuperar acceso. Cada código solo se puede usar
                  una vez.
                </p>
                {setupData?.backupCodes && (
                  <div className="grid grid-cols-2 gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                    {setupData.backupCodes.map((code, i) => (
                      <div
                        key={i}
                        className="font-mono text-xs text-zinc-800 px-2 py-1 rounded bg-white border border-zinc-100 text-center"
                      >
                        {code}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  Guarda estos códigos en un lugar seguro. Si pierdes tu dispositivo,
                  los necesitarás para recuperar acceso. Cada código solo se puede usar
                  una vez.
                </p>
              </div>
              <DialogFooter className="flex-row gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadBackupCodes}
                >
                  <Download className="h-4 w-4 mr-1" /> Descargar códigos
                </Button>
                <Button type="button" onClick={finishSetup}>
                  <Check className="h-4 w-4 mr-1" /> He guardado los códigos, finalizar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: Desactivar MFA */}
      {/* ============================================================ */}
      <Dialog
        open={disableOpen}
        onOpenChange={(open) => {
          if (!disableLoading) {
            setDisableOpen(open);
            if (!open) {
              setDisableToken('');
              setDisableBackupCode('');
              setDisableUseBackup(false);
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Desactivar autenticación de dos factores
            </DialogTitle>
            <DialogDescription>
              Para confirmar, ingresa un código de tu app autenticadora o un código de
              respaldo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                Al desactivar MFA, tu cuenta quedará protegida únicamente por tu
                contraseña. Esto reduce significativamente la seguridad.
              </p>
            </div>

            {!disableUseBackup ? (
              <div className="space-y-2">
                <Label htmlFor="disable-otp">Código de 6 dígitos</Label>
                <div className="flex justify-center py-1">
                  <InputOTP
                    maxLength={6}
                    value={disableToken}
                    onChange={setDisableToken}
                    disabled={disableLoading}
                    autoFocus
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="disable-backup">Código de respaldo</Label>
                <Input
                  id="disable-backup"
                  type="text"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  value={disableBackupCode}
                  onChange={(e) => setDisableBackupCode(e.target.value)}
                  disabled={disableLoading}
                  autoFocus
                  className="font-mono uppercase tracking-wider text-center"
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setDisableUseBackup(!disableUseBackup);
                setDisableToken('');
                setDisableBackupCode('');
              }}
              disabled={disableLoading}
              className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
            >
              {disableUseBackup
                ? 'Usar código de la app autenticadora'
                : 'Usar código de respaldo en su lugar'}
            </button>
          </div>

          <DialogFooter className="flex-row gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDisableOpen(false)}
              disabled={disableLoading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDisable}
              disabled={
                disableLoading ||
                (!disableUseBackup
                  ? disableToken.length !== 6
                  : disableBackupCode.trim().length < 8)
              }
            >
              {disableLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Desactivando...
                </>
              ) : (
                'Desactivar MFA'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// ADMIN LAYOUT — Main wrapper exported
// ============================================================

export function AdminLayout() {
  const { user, logout } = useAuthStore();
  const { adminView, setAdminView, sidebarCollapsed, toggleSidebar } = useAppStore();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const role = user?.role as Role;
  const isGA = role === 'GENERAL_ADMIN';

  // Tiempo real: escucha eventos de Socket.io para updates instantáneos
  useRealtime();

  const navItems = navItemsForRole(role);

  const handleLogout = async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    logout();
  };

  const renderView = () => {
    // Defense-in-depth: even if a SUPERVISOR manually toggles the active
    // view (e.g. via devtools), restrict them to the read-only subset
    // (dashboard, history, reports, audit). Everything else renders a
    // ForbiddenView so no mutation UI is exposed.
    const supervisorAllowedViews: AdminView[] = ['dashboard', 'history', 'reports', 'audit'];
    if (role === 'SUPERVISOR' && !supervisorAllowedViews.includes(adminView)) {
      return <ForbiddenView />;
    }
    switch (adminView) {
      case 'dashboard':
        return <DashboardView role={role} userSucursalId={user?.sucursalId || null} userSucursalName={user?.sucursalName || null} userSucursalCodigoLocal={user?.sucursalCodigoLocal || null} />;
      case 'employees':
        return <EmployeesView role={role} userSucursalId={user?.sucursalId || null} preselectedEmployeeId={null} setPreselectedEmployeeId={() => {}} />;
      case 'sucursales':
        return <SucursalesView role={role} />;
      case 'users':
        return isGA ? <UsersView /> : <ForbiddenView />;
      case 'vacations':
        return <VacationsView />;
      case 'history':
        return <HistoryView role={role} />;
      case 'reports':
        return <ReportsView role={role} />;
      case 'audit':
        return <AuditView role={role} />;
      case 'qr-terminal':
        return <QRTerminalView />;
      case 'company':
        return isGA ? <CompanyView /> : <ForbiddenView />;
      case 'settings':
        return (role === 'GENERAL_ADMIN' || role === 'SUCURSAL_ADMIN')
          ? <SettingsView />
          : <ForbiddenView />;
      default:
        return <DashboardView role={role} userSucursalId={user?.sucursalId || null} userSucursalName={user?.sucursalName || null} userSucursalCodigoLocal={user?.sucursalCodigoLocal || null} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white">
        <div className="flex h-16 items-center gap-3 px-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-zinc-900 truncate">
              {VIEW_TITLES[adminView]}
            </h1>
            <p className="text-xs text-zinc-500 truncate">
              {roleLabel(role)}
              {user?.sucursalName && !isGA && ` · ${sucursalLabel(user.sucursalName, user.sucursalCodigoLocal)}`}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline text-sm font-medium">{user?.name}</span>
                <ChevronDown className="h-4 w-4 text-zinc-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user?.name}</span>
                  <span className="text-xs text-zinc-500">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600 gap-2">
                <LogOut className="h-4 w-4" /> Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar desktop */}
        <aside className={cn(
          'hidden lg:flex flex-col border-r border-zinc-200 bg-white transition-all',
          sidebarCollapsed ? 'w-16' : 'w-60'
        )}>
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = adminView === item.id;
              const label = role === 'SUCURSAL_ADMIN' && item.labelSucursal ? item.labelSucursal : item.label;
              return (
                <button
                  key={item.id}
                  onClick={() => setAdminView(item.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                    active
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                    sidebarCollapsed && 'justify-center px-2'
                  )}
                  title={label}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <span className="truncate">{label}</span>}
                </button>
              );
            })}
          </nav>
          <div className="p-2 border-t border-zinc-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="w-full justify-center"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> Contraer</>}
            </Button>
          </div>
        </aside>

        {/* Mobile sidebar */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navegación</SheetTitle>
            <div className="flex h-full flex-col">
              <div className="border-b border-zinc-200 p-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
                    <LogIn className="h-4 w-4" />
                  </div>
                  <span className="font-semibold">Control de Asistencia</span>
                </div>
              </div>
              <nav className="flex-1 overflow-y-auto p-2 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = adminView === item.id;
                  const label = role === 'SUCURSAL_ADMIN' && item.labelSucursal ? item.labelSucursal : item.label;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setAdminView(item.id); setMobileSidebarOpen(false); }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                        active
                          ? 'bg-zinc-900 text-white'
                          : 'text-zinc-600 hover:bg-zinc-100'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={adminView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Control de Asistencia NOM-037 v2.2</span>
          <span>{new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}

function ForbiddenView() {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-zinc-300" />
        <p className="font-medium text-zinc-700">Acceso restringido</p>
        <p className="text-sm text-zinc-500 mt-1">No tienes permisos para ver esta sección.</p>
      </CardContent>
    </Card>
  );
}
