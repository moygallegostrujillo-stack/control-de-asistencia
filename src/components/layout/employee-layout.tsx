'use client';

// ============================================================
// EmployeeLayout — v2.2
// Mobile-first 4-view shell: Asistencia / Historial / Vacaciones / QR
// Built on Next.js 16 + shadcn/ui (New York) + Tailwind 4 +
// Lucide + Framer Motion + TanStack Query + Zustand.
// Palette: zinc/emerald/amber/rose (no indigo).
// ============================================================

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore, type EmployeeView } from '@/store/app-store';
import { authFetch } from '@/lib/fetch-helper';
import { useMyAttendance } from '@/hooks/queries/use-my-attendance';
import {
  formatTimeInMexico,
  formatDateInMexico,
  formatMinutes,
  getMexicoTodayISO,
  minutesToHours,
  toISODate,
} from '@/lib/timezone';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { QrScanner } from '@/components/qr/qr-scanner';
import { QrScannerIOS } from '@/components/qr/qr-scanner-ios';
import { DateRangePicker } from '@/components/reports/date-range-picker';
import {
  Clock,
  History as HistoryIcon,
  CalendarCheck,
  QrCode,
  LogIn,
  LogOut,
  MapPin,
  Building2,
  Coffee,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Timer,
  RefreshCw,
  Navigation,
  Download,
  FileSpreadsheet,
  Plus,
  X,
  ChevronDown,
  User,
  Loader2,
  ExternalLink,
  Ban,
  BadgeCheck,
  CalendarDays,
  Hourglass,
  FileText,
  Camera,
  Keyboard,
  CalendarOff,
  XCircle,
  ShieldCheck,
  Lock,
} from 'lucide-react';

// ============================================================
// Types — subsets of API payloads used by each view
// ============================================================

interface TodayRecord {
  id: string;
  date: string;
  checkInTime: string | null;
  checkInLat: number | null;
  checkInLong: number | null;
  checkInMethod: string | null;
  checkOutTime: string | null;
  checkOutLat: number | null;
  checkOutLong: number | null;
  checkOutMethod: string | null;
  mealStart: string | null;
  mealEnd: string | null;
  mealDurationMinutes: number | null;
  mealExceeded: boolean;
  restStart: string | null;
  restEnd: string | null;
  restDurationMinutes: number | null;
  restExceeded: boolean;
  status: string;
  workedMinutes: number | null;
  overtimeMinutes: number | null;
  // Reforma LFT 2027 — dobles / triples / prima por descanso trabajado
  overtimeDoubleMinutes?: number | null;
  overtimeTripleMinutes?: number | null;
  isRestDayWorked?: boolean | null;
  restDayWorkedMinutes?: number | null;
  restDayPremiumMinutes?: number | null;
  isSunday?: boolean | null;
  notes: string | null;
  employee?: {
    id: string;
    user: { name: string; email: string };
    sucursal: { id: string; name: string; codigoLocal: string | null } | null;
  } | null;
}

interface TodayResponse {
  record: TodayRecord | null;
  stats: {
    checkedIn: boolean;
    checkedOut: boolean;
    onBreak: boolean;
    status: string | null;
  } | null;
}

interface HistoryRecord {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  mealStart: string | null;
  mealEnd: string | null;
  mealDurationMinutes: number | null;
  mealExceeded: boolean;
  restStart: string | null;
  restEnd: string | null;
  restDurationMinutes: number | null;
  restExceeded: boolean;
  status: string;
  workedMinutes: number | null;
  overtimeMinutes: number | null;
  // Reforma LFT 2027 — dobles / triples / prima por descanso trabajado
  overtimeDoubleMinutes?: number | null;
  overtimeTripleMinutes?: number | null;
  isRestDayWorked?: boolean | null;
  restDayPremiumMinutes?: number | null;
  isSunday?: boolean | null;
  notes: string | null;
  checkInMethod: string | null;
  checkInLat: number | null;
  checkInLong: number | null;
  // NOM-037-STPS-2023 art. 27 — firma del trabajador (prueba plena)
  employeeSignedAt?: string | null;
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
  createdAt: string;
  approvedAt: string | null;
  employeeId: string;
  employee?: {
    id: string;
    user: { name: string; email: string };
    sucursal: { id: string; name: string; codigoLocal: string | null } | null;
  } | null;
  requestedBy?: { id: string; name: string; email: string } | null;
  approvedBy?: { id: string; name: string; email: string } | null;
}

interface BalanceData {
  employeeId: string;
  employeeName: string;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  pendingDays: number;
}

interface QrData {
  qrDataUrl: string;
  qrToken: string;
  employeeNumber: string;
  name: string;
}

// ============================================================
// Constants
// ============================================================

const SCROLLBAR_CLASS =
  '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700';

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Presente',
  LATE: 'Retardo',
  ABSENT: 'Ausente',
  EARLY_LEAVE: 'Salida anticipada',
};

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod/.test(ua) || (/MacIntel/.test(navigator.platform || '') && navigator.maxTouchPoints > 1);
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'PRESENT':
      return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200';
    case 'LATE':
      return 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200';
    case 'ABSENT':
      return 'bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200';
    case 'EARLY_LEAVE':
      return 'bg-zinc-100 text-zinc-700 hover:bg-zinc-100 border-zinc-200';
    default:
      return '';
  }
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

function vacationStatusBadgeClass(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200';
    case 'APPROVED':
      return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200';
    case 'REJECTED':
      return 'bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200';
    case 'CANCELLED':
      return 'bg-zinc-100 text-zinc-700 hover:bg-zinc-100 border-zinc-200';
    default:
      return '';
  }
}

const MEAL_TOTAL_SECONDS = 30 * 60; // 30 min
const MEAL_WARN_SECONDS = 25 * 60; // a partir de 25 min → amber
const MEAL_EXCEEDED_SECONDS = 30 * 60; // a partir de 30 min → red

// ============================================================
// Helpers
// ============================================================

async function apiGet<T>(url: string): Promise<T> {
  const res = await authFetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Error ${res.status}`);
  }
  return data as T;
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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// ============================================================
// Reusable components
// ============================================================

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) {
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
    <div className="flex flex-col items-center justify-center py-10 text-center">
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

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={statusBadgeClass(status)}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function VacationStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={vacationStatusBadgeClass(status)}>
      {VACATION_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function CurrentTime() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <h2 className="text-4xl font-mono font-bold tabular-nums">
      {formatTimeInMexico(time)}
    </h2>
  );
}

/**
 * BreakCountdown — countdown timer for the meal break (30 min).
 * Color changes:
 *   - 0–25 min (≥5 min remaining): emerald
 *   - 25–30 min (<5 min remaining): amber (warning)
 *   - >30 min (exceeded): rose
 */
function BreakCountdown({ startTime }: { startTime: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const startMs = new Date(startTime).getTime();
  const elapsedSec = Math.max(0, Math.floor((now - startMs) / 1000));
  const remainingSec = Math.max(0, MEAL_TOTAL_SECONDS - elapsedSec);

  const mm = Math.floor(remainingSec / 60);
  const ss = remainingSec % 60;
  const display = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

  const exceeded = elapsedSec >= MEAL_EXCEEDED_SECONDS;
  const warn = !exceeded && elapsedSec >= MEAL_WARN_SECONDS;

  const color = exceeded
    ? 'text-rose-600'
    : warn
      ? 'text-amber-600'
      : 'text-emerald-600';
  const barColor = exceeded
    ? 'bg-rose-500'
    : warn
      ? 'bg-amber-500'
      : 'bg-emerald-500';
  const bgColor = exceeded ? 'bg-rose-100' : warn ? 'bg-amber-100' : 'bg-emerald-100';

  const pct = Math.min(100, (elapsedSec / MEAL_TOTAL_SECONDS) * 100);

  return (
    <div className="text-center space-y-2">
      <div className="flex items-center justify-center gap-2">
        <Timer className={`w-5 h-5 ${color}`} />
        <div className={`text-3xl font-mono font-bold tabular-nums ${color}`}>{display}</div>
      </div>
      <p className="text-xs text-muted-foreground">
        {exceeded
          ? `Tiempo excedido por ${Math.floor((elapsedSec - MEAL_TOTAL_SECONDS) / 60)} min. Termine su descanso.`
          : warn
            ? `Quedan ${mm} min ${ss} seg. Acerca el límite de 30 min.`
            : `Quedan ${mm} min ${ss} seg de los 30 min permitidos.`}
      </p>
      <div className={`w-full ${bgColor} rounded-full h-2 mt-1`}>
        <div
          className={`${barColor} h-2 rounded-full transition-all duration-1000`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================
// AttendanceView — Mi Asistencia
// ============================================================

function AttendanceView() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useMyAttendance();

  const [checkMode, setCheckMode] = useState<'GPS' | 'QR'>('GPS');
  const [qrCode, setQrCode] = useState('');
  const [submitting, setSubmitting] = useState<
    null | 'check-in' | 'check-out' | 'meal-start' | 'meal-end'
  >(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // QR sub-mode (dentro de checkMode='QR'): escanear con cámara o ingresar manualmente.
  const [qrInputMode, setQrInputMode] = useState<'scan' | 'manual'>('scan');
  // Acción que se dispara cuando el empleado escanea un QR del terminal.
  const [pendingAction, setPendingAction] = useState<
    'check-in' | 'check-out' | 'meal-start' | 'meal-end'
  >('check-in');

  const employeeId = user?.employeeId ?? null;
  const todayResponse = data as TodayResponse | undefined;
  const record = todayResponse?.record ?? null;

  // ---------- geolocation ----------
  const getLocation = useCallback((): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        reject(new Error('La geolocalización no está disponible en este dispositivo'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => {
          const messages: Record<number, string> = {
            1: 'Permiso denegado. Habilite el acceso a la ubicación en el navegador.',
            2: 'Posición no disponible. Intente de nuevo o verifique su señal GPS.',
            3: 'Tiempo de espera agotado intentando obtener la ubicación.',
          };
          reject(new Error(messages[err.code] || `Error de geolocalización: ${err.message}`));
        },
        { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
      );
    });
  }, []);

  const ensureLocation = useCallback(async (): Promise<{ lat: number; lng: number } | null> => {
    if (location) return location;
    setLocating(true);
    setLocationError(null);
    try {
      const loc = await getLocation();
      setLocation(loc);
      return loc;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de geolocalización';
      setLocationError(msg);
      toast.error('Geolocalización requerida', { description: msg });
      return null;
    } finally {
      setLocating(false);
    }
  }, [location, getLocation]);

  // Best-effort location preload on mount (only when GPS mode)
  useEffect(() => {
    if (checkMode === 'GPS' && !location && !locationError) {
      ensureLocation();
    }
  }, [checkMode, location, locationError, ensureLocation]);

  // ---------- actions ----------
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['attendance', 'mine'] });
  }, [queryClient]);

  const handleCheckIn = async (codeOverride?: string) => {
    if (!employeeId) {
      toast.error('Su cuenta no tiene un perfil de empleado asociado.');
      return;
    }
    const effectiveCode = codeOverride ?? qrCode;
    if (checkMode === 'QR' && !effectiveCode.trim()) {
      toast.error('Ingrese o escanee un código QR.');
      return;
    }
    let lat: number | undefined;
    let long: number | undefined;
    if (checkMode === 'GPS') {
      const loc = await ensureLocation();
      if (!loc) return;
      lat = loc.lat;
      long = loc.lng;
    }
    setSubmitting('check-in');
    try {
      const res = await apiSend<{ record: TodayRecord; message?: string }>(
        '/api/attendance/check-in',
        'POST',
        { lat, long, method: checkMode, qrCode: checkMode === 'QR' ? effectiveCode.trim() : undefined },
      );
      toast.success('Entrada registrada', {
        description: `Registrada a las ${formatTimeInMexico(res.record.checkInTime)}`,
      });
      setQrCode('');
      invalidate();
    } catch (e) {
      toast.error('No se pudo registrar la entrada', {
        description: (e as Error).message,
      });
    } finally {
      setSubmitting(null);
    }
  };

  const handleCheckOut = async (codeOverride?: string) => {
    const effectiveCode = codeOverride ?? qrCode;
    if (checkMode === 'QR' && !effectiveCode.trim()) {
      toast.error('Ingrese o escanee un código QR.');
      return;
    }
    let lat: number | undefined;
    let long: number | undefined;
    if (checkMode === 'GPS') {
      const loc = await ensureLocation();
      if (!loc) return;
      lat = loc.lat;
      long = loc.lng;
    }
    setSubmitting('check-out');
    try {
      const res = await apiSend<{
        record: TodayRecord;
        workedMinutes: number;
        overtimeMinutes: number;
        status: string;
      }>('/api/attendance/check-out', 'POST', {
        lat,
        long,
        method: checkMode,
        qrCode: checkMode === 'QR' ? effectiveCode.trim() : undefined,
      });
      toast.success('Fin de jornada registrado', {
        description: `Salida: ${formatTimeInMexico(res.record.checkOutTime)} · Trabajadas: ${formatMinutes(res.workedMinutes)}`,
      });
      setQrCode('');
      invalidate();
    } catch (e) {
      toast.error('No se pudo registrar la salida', {
        description: (e as Error).message,
      });
    } finally {
      setSubmitting(null);
    }
  };

  const handleMealToggle = async () => {
    if (!record) return;
    if (!record.mealStart) {
      setSubmitting('meal-start');
      try {
        const res = await apiSend<{ record: TodayRecord; message?: string }>(
          '/api/attendance/meal-start',
          'POST',
          {},
        );
        toast.success('Descanso iniciado', {
          description: res.message || 'Recuerde terminar antes de 30 minutos.',
        });
        invalidate();
      } catch (e) {
        toast.error('No se pudo iniciar el descanso', {
          description: (e as Error).message,
        });
      } finally {
        setSubmitting(null);
      }
    } else if (!record.mealEnd) {
      setSubmitting('meal-end');
      try {
        const res = await apiSend<{
          record: TodayRecord;
          mealDurationMinutes: number;
          mealExceeded: boolean;
          message?: string;
        }>('/api/attendance/meal-end', 'POST', {});
        if (res.mealExceeded) {
          toast.warning('Descanso terminado con exceso', {
            description: res.message || `Duración: ${res.mealDurationMinutes} min`,
          });
        } else {
          toast.success('Descanso terminado', {
            description: res.message || `Duración: ${res.mealDurationMinutes} min`,
          });
        }
        invalidate();
      } catch (e) {
        toast.error('No se pudo terminar el descanso', {
          description: (e as Error).message,
        });
      } finally {
        setSubmitting(null);
      }
    }
  };

  // ---------- derived state ----------
  const isCheckedIn = !!record?.checkInTime;
  const isCheckedOut = !!record?.checkOutTime;
  const isOnBreak = !!record?.mealStart && !record?.mealEnd;
  const mealCompleted = !!record?.mealStart && !!record?.mealEnd;

  // Acciones disponibles según el estado del registro de hoy.
  // Se usa para poblar el selector de acción al escanear QR.
  const availableActions = useMemo<
    { value: 'check-in' | 'check-out' | 'meal-start' | 'meal-end'; label: string }[]
  >(() => {
    const actions: {
      value: 'check-in' | 'check-out' | 'meal-start' | 'meal-end';
      label: string;
    }[] = [];
    if (!isCheckedIn) {
      actions.push({ value: 'check-in', label: 'Registrar Entrada' });
    } else if (!isCheckedOut) {
      if (!record?.mealStart) {
        actions.push({ value: 'meal-start', label: 'Iniciar Descanso' });
      } else if (!record?.mealEnd) {
        actions.push({ value: 'meal-end', label: 'Terminar Descanso' });
      }
      actions.push({ value: 'check-out', label: 'Registrar Salida' });
    }
    return actions;
  }, [isCheckedIn, isCheckedOut, record?.mealStart, record?.mealEnd]);

  // Mantener pendingAction sincronizado con las acciones disponibles.
  useEffect(() => {
    if (availableActions.length === 0) return;
    const stillValid = availableActions.some((a) => a.value === pendingAction);
    if (!stillValid) {
      setPendingAction(availableActions[0].value);
    }
  }, [availableActions, pendingAction]);

  // ---------- QR scan handler ----------
  // Valida el formato del código escaneado y dispara la acción seleccionada.
  // - NOM037:<hex>:<epoch>:<hmac>  → QR dinámico del terminal (válido).
  // - EMP:<numero>:<hmac>          → QR personal del empleado (NO aceptado).
  // - Otro formato                 → error.
  //
  // No se memoiza con useCallback: QrScanner guarda onScan en un ref vivo
  // (onScanRef) que se actualiza en cada render, por lo que siempre invoca
  // la versión más fresca. Esto evita problemas de stale-closure con
  // handleCheckIn / handleCheckOut / handleMealToggle (que tampoco están
  // memoizados y se recrean en cada render).
  const handleScan = async (code: string) => {
    if (submitting !== null) return; // ya hay una acción en curso
    if (!code) return;

    // Validación de formato en cliente (defense-in-depth; la API valida HMAC de nuevo).
    if (code.startsWith('EMP:')) {
      toast.error(
        'No puedes usar tu propio QR personal para registrar asistencia. Escanea el QR del terminal.',
      );
      return;
    }
    if (!code.startsWith('NOM037:')) {
      toast.error('Formato de QR no reconocido', {
        description: 'Se esperaba un código del terminal NOM-037.',
      });
      return;
    }

    // Feedback inmediato al usuario.
    const preview = code.substring(0, 12);
    toast.success(`Código escaneado: ${preview}…`);
    setQrCode(code);

    // Disparar la acción seleccionada.
    switch (pendingAction) {
      case 'check-in':
        if (!isCheckedIn) await handleCheckIn(code);
        else toast.info('Ya registraste tu entrada hoy.');
        break;
      case 'check-out':
        if (isCheckedIn && !isCheckedOut) await handleCheckOut(code);
        else toast.info('No puedes registrar salida en este momento.');
        break;
      case 'meal-start':
        if (isCheckedIn && !isCheckedOut && !record?.mealStart) await handleMealToggle();
        else toast.info('No puedes iniciar descanso en este momento.');
        break;
      case 'meal-end':
        if (isCheckedIn && !isCheckedOut && record?.mealStart && !record?.mealEnd) {
          await handleMealToggle();
        } else {
          toast.info('No puedes terminar descanso en este momento.');
        }
        break;
    }
  };

  const statusConfig: {
    title: string;
    subtitle: string;
    cardClass: string;
    iconBg: string;
    iconColor: string;
    icon: React.ElementType;
  } = !isCheckedIn
    ? {
        title: 'No has checado entrada',
        subtitle: 'Selecciona un método y registra tu entrada para comenzar la jornada.',
        cardClass: 'border-zinc-200 bg-zinc-50/50',
        iconBg: 'bg-zinc-100',
        iconColor: 'text-zinc-600',
        icon: LogIn,
      }
    : isOnBreak
      ? {
          title: 'En descanso',
          subtitle: 'Disfruta tu comida. Te avisaremos antes del límite de 30 minutos.',
          cardClass: 'border-amber-200 bg-amber-50/50',
          iconBg: 'bg-amber-100',
          iconColor: 'text-amber-700',
          icon: Coffee,
        }
      : isCheckedOut
        ? {
            title: 'Jornada finalizada',
            subtitle: 'Tu jornada de hoy ha sido registrada. ¡Hasta pronto!',
            cardClass: 'border-emerald-200 bg-emerald-50/50',
            iconBg: 'bg-emerald-100',
            iconColor: 'text-emerald-700',
            icon: CheckCircle2,
          }
        : {
            title: 'En jornada',
            subtitle: 'Estás trabajando. Recuerda registrar tu salida al final del día.',
            cardClass: 'border-emerald-200 bg-emerald-50/50',
            iconBg: 'bg-emerald-100',
            iconColor: 'text-emerald-700',
            icon: Clock,
          };

  const StatusIcon = statusConfig.icon;

  const mapsLink = record?.checkInLat && record?.checkInLong
    ? `https://www.google.com/maps?q=${record.checkInLat},${record.checkInLong}`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4 max-w-2xl mx-auto"
    >
      {/* Greeting + current time */}
      <div className="text-center space-y-1">
        <CurrentTime />
        <p className="text-muted-foreground text-sm capitalize">
          {formatDateInMexico(new Date())}
        </p>
      </div>

      {/* Missing employee profile warning */}
      {!employeeId && (
        <Card className="border-rose-200 bg-rose-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-rose-700 text-sm">Sin perfil de empleado</p>
                <p className="text-xs text-rose-600/80 mt-1">
                  Tu cuenta no tiene un perfil de empleado asociado. Contacta al administrador
                  para registrar tu perfil. Las funciones de asistencia no estarán disponibles.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sucursal indicator */}
      {user?.sucursalName && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span className="text-muted-foreground">Sucursal:</span>
              <span className="font-medium">{user.sucursalName}</span>
              {user.sucursalCodigoLocal && (
                <Badge variant="outline" className="ml-auto text-xs">
                  Local {user.sucursalCodigoLocal}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main status card */}
      <Card className={statusConfig.cardClass}>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <ErrorState message={(error as Error)?.message || 'Error al cargar el registro'} />
          ) : (
            <div className="space-y-5">
              {/* Status header */}
              <div className="text-center space-y-2">
                <div
                  className={`w-16 h-16 rounded-full ${statusConfig.iconBg} flex items-center justify-center mx-auto`}
                >
                  <StatusIcon className={`w-8 h-8 ${statusConfig.iconColor}`} />
                </div>
                <h2 className="text-xl font-bold">{statusConfig.title}</h2>
                <p className="text-sm text-muted-foreground">{statusConfig.subtitle}</p>
                {record?.status && isCheckedIn && (
                  <div className="flex justify-center pt-1">
                    <StatusBadge status={record.status} />
                  </div>
                )}
              </div>

              {/* Break countdown when on break */}
              {isOnBreak && record?.mealStart && (
                <div className="bg-card border rounded-xl p-4">
                  <BreakCountdown startTime={record.mealStart} />
                </div>
              )}

              {/* GPS / QR mode toggle */}
              {!isCheckedOut && (
                <div className="space-y-3">
                  <Tabs
                    value={checkMode}
                    onValueChange={(v) => setCheckMode(v as 'GPS' | 'QR')}
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="GPS" className="gap-1.5">
                        <Navigation className="w-3.5 h-3.5" /> GPS
                      </TabsTrigger>
                      <TabsTrigger value="QR" className="gap-1.5">
                        <QrCode className="w-3.5 h-3.5" /> QR
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {checkMode === 'GPS' && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      {locating ? (
                        <p className="flex items-center gap-1.5">
                          <Loader2 className="w-3 h-3 animate-spin" /> Obteniendo ubicación…
                        </p>
                      ) : location ? (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-emerald-600" />
                          Ubicación lista: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                        </p>
                      ) : locationError ? (
                        <p className="flex items-center gap-1.5 text-rose-600">
                          <AlertTriangle className="w-3 h-3" /> {locationError}{' '}
                          <button
                            onClick={() => ensureLocation()}
                            className="underline hover:text-rose-700"
                          >
                            Reintentar
                          </button>
                        </p>
                      ) : (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3" /> Esperando ubicación…
                        </p>
                      )}
                    </div>
                  )}

                  {checkMode === 'QR' && (
                    <div className="space-y-3">
                      {/* Selector de acción — visible en ambos sub-modos (scan / manual) */}
                      {availableActions.length > 0 && (
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">
                            Acción a ejecutar al escanear
                          </Label>
                          <Select
                            value={pendingAction}
                            onValueChange={(v) =>
                              setPendingAction(
                                v as 'check-in' | 'check-out' | 'meal-start' | 'meal-end',
                              )
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecciona una acción" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableActions.map((a) => (
                                <SelectItem key={a.value} value={a.value}>
                                  {a.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Sub-tabs: Escanear QR / Ingresar manualmente */}
                      <Tabs
                        value={qrInputMode}
                        onValueChange={(v) => setQrInputMode(v as 'scan' | 'manual')}
                      >
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="scan" className="gap-1.5">
                            <Camera className="w-3.5 h-3.5" /> Escanear QR
                          </TabsTrigger>
                          <TabsTrigger value="manual" className="gap-1.5">
                            <Keyboard className="w-3.5 h-3.5" /> Manual
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>

                      {qrInputMode === 'scan' ? (
                        <div className="space-y-2">
                          {isIOS() ? (
                            <QrScannerIOS
                              onScan={(code) => { void handleScan(code); }}
                              onError={(err) => toast.error('Error de cámara', { description: err })}
                            />
                          ) : (
                            <QrScanner
                              onScan={(code) => { void handleScan(code); }}
                              onError={(err) => toast.error('Error de cámara', { description: err })}
                            />
                          )}
                          <p className="text-xs text-muted-foreground text-center">
                            Apunta la cámara al QR del terminal. La acción seleccionada se
                            ejecutará automáticamente.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor="qr" className="text-xs text-muted-foreground">
                            Código QR del terminal
                          </Label>
                          <Input
                            id="qr"
                            placeholder="Pega el código NOM037:…"
                            value={qrCode}
                            onChange={(e) => setQrCode(e.target.value)}
                            autoComplete="off"
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                          />
                          <p className="text-xs text-muted-foreground">
                            Pega el código del terminal y pulsa la acción correspondiente.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Action buttons */}
              <div className="space-y-3">
                {!isCheckedIn && (
                  <Button
                    className="w-full h-12 text-base"
                    onClick={() => handleCheckIn()}
                    disabled={!employeeId || submitting !== null || (checkMode === 'GPS' && locating)}
                  >
                    {submitting === 'check-in' ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <LogIn className="w-5 h-5 mr-2" />
                    )}
                    Registrar Entrada
                  </Button>
                )}

                {isCheckedIn && !isCheckedOut && (
                  <>
                    <Button
                      variant={isOnBreak ? 'default' : 'outline'}
                      className={`w-full h-12 text-base ${
                        isOnBreak
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'border-amber-300 text-amber-700 hover:bg-amber-50'
                      }`}
                      onClick={() => handleMealToggle()}
                      disabled={submitting !== null}
                    >
                      {submitting === 'meal-start' || submitting === 'meal-end' ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      ) : isOnBreak ? (
                        <Coffee className="w-5 h-5 mr-2" />
                      ) : (
                        <Coffee className="w-5 h-5 mr-2" />
                      )}
                      {isOnBreak ? 'Terminar Descanso' : 'Iniciar Descanso'}
                    </Button>

                    {mealCompleted && (
                      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Descanso completado · {record?.mealDurationMinutes ?? 0} min
                        {record?.mealExceeded && (
                          <span className="text-rose-600 ml-1">· Excedido</span>
                        )}
                      </p>
                    )}

                    <Button
                      variant="destructive"
                      className="w-full h-12 text-base bg-rose-600 hover:bg-rose-700"
                      onClick={() => handleCheckOut()}
                      disabled={submitting !== null}
                    >
                      {submitting === 'check-out' ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <LogOut className="w-5 h-5 mr-2" />
                      )}
                      Registrar Fin de Jornada
                    </Button>
                  </>
                )}

                {isCheckedOut && (
                  <p className="text-center text-sm text-emerald-700 font-medium">
                    Jornada cerrada correctamente.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mini map / location link */}
      {mapsLink && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Ubicación de registro</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {record!.checkInLat!.toFixed(5)}, {record!.checkInLong!.toFixed(5)}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <a href={mapsLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Ver mapa
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> Resumen de hoy
            {record?.isRestDayWorked && (
              <Badge
                className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 gap-1 ml-auto"
                title="Día de descanso trabajado — prima 100% (art. 73 LFT)"
              >
                <CalendarOff className="h-3 w-3" />
                {record.isSunday ? 'Domingo trabajado' : 'Descanso trabajado'}
                <span className="font-semibold">· prima 100%</span>
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 gap-px bg-border">
            <SummaryCell label="Entrada" value={formatTimeInMexico(record?.checkInTime ?? null)} />
            <SummaryCell label="Salida" value={formatTimeInMexico(record?.checkOutTime ?? null)} />
            <SummaryCell
              label="Descanso inicio"
              value={formatTimeInMexico(record?.mealStart ?? null)}
            />
            <SummaryCell
              label="Descanso fin"
              value={formatTimeInMexico(record?.mealEnd ?? null)}
            />
            <SummaryCell
              label="Horas trabajadas"
              value={record?.workedMinutes != null ? formatMinutes(record.workedMinutes) : '—'}
            />
            <SummaryCell
              label="Horas extra"
              value={
                record?.overtimeMinutes
                  ? `${formatMinutes(record.overtimeMinutes)} · Dobles ${formatMinutes(record.overtimeDoubleMinutes ?? 0)} / Triples ${formatMinutes(record.overtimeTripleMinutes ?? 0)}`
                  : '0min'
              }
              highlight={!!record?.overtimeMinutes}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>
    </motion.div>
  );
}

function SummaryCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-sm font-mono font-medium mt-0.5 ${
          highlight ? 'text-amber-700' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ============================================================
// HistoryView — Mi Historial
// ============================================================

function HistoryView() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'custom'>('week');
  const [date, setDate] = useState<string>(getMexicoTodayISO());
  const [customStart, setCustomStart] = useState<string>(getMexicoTodayISO());
  const [customEnd, setCustomEnd] = useState<string>(getMexicoTodayISO());
  const [downloading, setDownloading] = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);
  // RT-P0.6 (auditoría 14-ago-2026): estado para el diálogo de firma de registros.
  // El trabajador puede firmar (acknowledge) sus registros del periodo visible
  // con un PIN de 4+ dígitos. El backend genera un HMAC-SHA256 y persiste
  // employeeSignedAt + employeeSignatureHash + employeeSignedIp.
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [signaturePin, setSignaturePin] = useState('');
  const [signing, setSigning] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['attendance', 'history', period, date, customStart, customEnd],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('period', period);
      if (period === 'custom') {
        params.set('startDate', customStart);
        params.set('endDate', customEnd);
      } else {
        params.set('date', date);
      }
      return apiGet<{ records: HistoryRecord[]; from: string; to: string }>(
        `/api/attendance/history?${params.toString()}`,
      );
    },
    staleTime: 30_000,
  });

  const records = data?.records ?? [];

  // Resuelve el rango ISO a exportar según el modo seleccionado.
  // Para day/week/month usamos el `from`/`to` que ya calculó la API;
  // para custom usamos el rango libre del DateRangePicker.
  const resolveExportRange = (): { startDate: string; endDate: string } => {
    if (period === 'custom') {
      return { startDate: customStart, endDate: customEnd };
    }
    return { startDate: data?.from || date, endDate: data?.to || date };
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { startDate, endDate } = resolveExportRange();
      const params = new URLSearchParams({
        format: 'csv',
        startDate,
        endDate,
      });
      const res = await authFetch(`/api/reports/my-export?${params.toString()}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || 'No hay datos para exportar');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mi_historial_${startDate}_${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Reporte CSV descargado');
    } catch (e) {
      toast.error('Error al descargar el reporte', { description: (e as Error).message });
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadXlsx = async () => {
    setDownloadingXlsx(true);
    try {
      const { startDate, endDate } = resolveExportRange();
      const params = new URLSearchParams({
        format: 'xlsx',
        startDate,
        endDate,
      });
      const res = await authFetch(`/api/reports/my-export?${params.toString()}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || 'No hay datos para exportar');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mi_historial_${startDate}_${endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Reporte XLSX descargado');
    } catch (e) {
      toast.error('Error al descargar el reporte', { description: (e as Error).message });
    } finally {
      setDownloadingXlsx(false);
    }
  };

  // RT-P0.6 (auditoría 14-ago-2026): handler para firmar los registros del periodo.
  // Invoca POST /api/attendance/sign con el rango visible y el PIN del empleado.
  // El backend genera un HMAC-SHA256 sobre el contenido canónico de los registros
  // y persiste employeeSignedAt + employeeSignatureHash + employeeSignedIp como
  // evidencia probatoria (art. 132 XXXIV LFT — prueba plena si fue acordado).
  const handleSign = async () => {
    if (!signaturePin || signaturePin.length < 4) {
      toast.error('PIN inválido', { description: 'El PIN debe tener al menos 4 caracteres.' });
      return;
    }
    if (records.length === 0) {
      toast.error('No hay registros para firmar en el periodo seleccionado.');
      return;
    }
    setSigning(true);
    try {
      const { startDate, endDate } = resolveExportRange();
      const res = await authFetch('/api/attendance/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, signaturePin }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || 'Error al firmar los registros');
      }
      const data = await res.json() as {
        signed: number;
        signatureHash: string;
        signedAt: string;
        message?: string;
      };
      toast.success('Registros firmados', {
        description: data.message || `Se firmaron ${data.signed} registro(s). Hash: ${data.signatureHash.slice(0, 16)}…`,
      });
      setSignDialogOpen(false);
      setSignaturePin('');
      // Invalidar cache para que la UI muestre el checkmark de "firmado".
      void queryClient.invalidateQueries({ queryKey: ['attendance', 'history'] });
    } catch (e) {
      toast.error('Error al firmar los registros', { description: (e as Error).message });
    } finally {
      setSigning(false);
    }
  };

  // Cuenta cuántos registros del periodo visible aún no están firmados
  // (para mostrar el badge en el botón "Firmar mis registros").
  const unsignedCount = records.filter(
    (r) => r.checkOutTime && !r.employeeSignedAt,
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-bold">Mi Historial</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {/* RT-P0.6 (auditoría 14-ago-2026): botón para firmar los registros del periodo.
              El art. 132 XXXIV LFT (reforma DOF 27-dic-2024, vigente 1-ene-2027) establece
              que el registro electrónico "hará prueba plena si fue acordado entre la persona
              trabajadora y empleadora". La firma del trabajador es la evidencia de ese acuerdo. */}
          <Button
            variant="default"
            size="sm"
            onClick={() => setSignDialogOpen(true)}
            disabled={unsignedCount === 0}
            className="gap-1.5"
            title={unsignedCount === 0
              ? 'No hay registros sin firma en el periodo visible'
              : `Firmar ${unsignedCount} registro(s) del periodo (art. 132 XXXIV LFT)`}
          >
            <BadgeCheck className="w-4 h-4" />
            Firmar
            {unsignedCount > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                {unsignedCount}
              </Badge>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={downloading || records.length === 0}
            className="gap-1.5"
            title="Descargar CSV del rango visible"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadXlsx}
            disabled={downloadingXlsx || records.length === 0}
            className="gap-1.5"
            title="Descargar Excel del rango visible"
          >
            {downloadingXlsx ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            XLSX
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Periodo</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as 'day' | 'week' | 'month' | 'custom')}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Día</SelectItem>
                  <SelectItem value="week">Semana</SelectItem>
                  <SelectItem value="month">Mes</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {period === 'custom' ? (
              <div className="space-y-1.5 flex-1 min-w-[280px]">
                <Label className="text-xs text-muted-foreground">Rango de fechas</Label>
                <DateRangePicker
                  value={{ start: customStart, end: customEnd }}
                  onChange={(v) => {
                    setCustomStart(v.start);
                    setCustomEnd(v.end);
                  }}
                  className="w-full"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fecha</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value || getMexicoTodayISO())}
                  className="w-44"
                />
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Refrescar
            </Button>
          </div>
          {data && (
            <p className="text-xs text-muted-foreground mt-3">
              Periodo: {data.from} → {data.to} · {records.length} registro(s)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <LoadingState rows={6} />
            </div>
          ) : isError ? (
            <ErrorState message={(error as Error)?.message || 'Error al cargar historial'} />
          ) : records.length === 0 ? (
            <EmptyState
              icon={HistoryIcon}
              title="Sin registros"
              subtitle="No hay registros de asistencia en el periodo seleccionado."
            />
          ) : (
            <div className={`max-h-[60vh] overflow-auto ${SCROLLBAR_CLASS}`}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="whitespace-nowrap">Fecha</TableHead>
                    <TableHead className="whitespace-nowrap">Entrada</TableHead>
                    <TableHead className="whitespace-nowrap">Descanso Inicio</TableHead>
                    <TableHead className="whitespace-nowrap">Descanso Fin</TableHead>
                    <TableHead className="whitespace-nowrap">Salida</TableHead>
                    <TableHead className="whitespace-nowrap">Estado</TableHead>
                    <TableHead className="whitespace-nowrap">Hrs. Trabajadas</TableHead>
                    <TableHead className="whitespace-nowrap">Hrs. Extra</TableHead>
                    <TableHead className="whitespace-nowrap">Descanso</TableHead>
                    <TableHead className="whitespace-nowrap">Notas</TableHead>
                    <TableHead className="whitespace-nowrap">Firmado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs font-medium">
                        {formatDateInMexico(r.date)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {r.checkInTime ? formatTimeInMexico(r.checkInTime) : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {r.mealStart ? formatTimeInMexico(r.mealStart) : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {r.mealEnd ? formatTimeInMexico(r.mealEnd) : '—'}
                        {r.mealExceeded && (
                          <span className="text-rose-600 ml-1">⚠</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {r.checkOutTime ? formatTimeInMexico(r.checkOutTime) : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {r.workedMinutes != null ? formatMinutes(r.workedMinutes) : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {r.overtimeMinutes ? (
                          <span>
                            {formatMinutes(r.overtimeMinutes)}
                            {(r.overtimeDoubleMinutes ?? 0) > 0 || (r.overtimeTripleMinutes ?? 0) > 0 ? (
                              <span className="block text-[10px] text-muted-foreground">
                                <span className="text-amber-700">D: {formatMinutes(r.overtimeDoubleMinutes ?? 0)}</span>
                                {' · '}
                                <span className="text-rose-700">T: {formatMinutes(r.overtimeTripleMinutes ?? 0)}</span>
                              </span>
                            ) : null}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.isRestDayWorked ? (
                          <Badge
                            className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 gap-1"
                            title={`Día de descanso trabajado — prima 100% (art. 73 LFT)${r.isSunday ? ' · Domingo' : ''}`}
                          >
                            <CalendarOff className="h-3 w-3" />
                            {r.isSunday ? 'Dom.' : 'Sí'}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground max-w-[160px] truncate">
                        {r.notes || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.employeeSignedAt ? (
                          <Badge
                            className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 gap-1"
                            title="Firma del trabajador — NOM-037-STPS-2023 art. 27 (prueba plena)"
                          >
                            <BadgeCheck className="h-3 w-3" />
                            {toISODate(new Date(r.employeeSignedAt))}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-rose-700 border-rose-200 bg-rose-50 hover:bg-rose-50 gap-1"
                            title="Firma del trabajador — NOM-037-STPS-2023 art. 27 (prueba plena)"
                          >
                            <XCircle className="h-3 w-3" />
                            No firmado
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RT-P0.6 (auditoría 14-ago-2026): Dialog para capturar el PIN de firma.
          El PIN se usa como sal del HMAC-SHA256 en el backend (no se guarda).
          Mínimo 4 caracteres. */}
      <Dialog open={signDialogOpen} onOpenChange={(v) => {
        setSignDialogOpen(v);
        if (!v) setSignaturePin('');
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheck className="w-5 h-5 text-emerald-600" />
              Firmar mis registros del periodo
            </DialogTitle>
            <DialogDescription>
              Al firmar, usted reconoce que los registros de asistencia del periodo
              seleccionado son correctos y fueron acordados con el patrón (art. 132
              fracción XXXIV LFT, reforma DOF 27-dic-2024). La firma hace prueba plena.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="signature-pin">
                PIN de firma <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="signature-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={signaturePin}
                onChange={(e) => setSignaturePin(e.target.value)}
                placeholder="Mínimo 4 dígitos"
                maxLength={20}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !signing && signaturePin.length >= 4) {
                    void handleSign();
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                El PIN se combina con el secreto del servidor para generar un HMAC-SHA256
                que se persiste como evidencia. No se almacena el PIN en sí.
              </p>
            </div>
            <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
              <p className="font-semibold mb-1">Resumen de la firma:</p>
              <ul className="space-y-0.5 list-disc pl-4">
                <li>Registros por firmar: <strong>{unsignedCount}</strong></li>
                <li>Periodo: <strong>{resolveExportRange().startDate}</strong> a <strong>{resolveExportRange().endDate}</strong></li>
                <li>Algoritmo: <strong>HMAC-SHA256</strong></li>
                <li>Base legal: <strong>art. 132 XXXIV LFT</strong></li>
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setSignDialogOpen(false);
              setSignaturePin('');
            }} disabled={signing}>
              Cancelar
            </Button>
            <Button
              onClick={handleSign}
              disabled={signing || signaturePin.length < 4 || unsignedCount === 0}
              className="gap-1.5"
            >
              {signing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BadgeCheck className="w-4 h-4" />
              )}
              Firmar {unsignedCount} registro(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ============================================================
// VacationsView — Mis Vacaciones
// ============================================================

function VacationsView() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const employeeId = user?.employeeId ?? null;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<VacationRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // New request form state
  const [formType, setFormType] = useState<string>('VACACIONES');
  const [formStart, setFormStart] = useState<string>(getMexicoTodayISO());
  const [formEnd, setFormEnd] = useState<string>(getMexicoTodayISO());
  const [formReason, setFormReason] = useState<string>('');

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['vacations', 'balance', employeeId],
    queryFn: () =>
      apiGet<BalanceData>(`/api/vacations/balance/${employeeId}`),
    enabled: !!employeeId,
    staleTime: 60_000,
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vacations', 'list'],
    queryFn: () => apiGet<{ vacations: VacationRow[] }>(`/api/vacations`),
    enabled: !!employeeId,
    staleTime: 30_000,
  });

  const vacations = useMemo(
    () => (data?.vacations ?? []).slice().sort((a, b) => (a.startDate < b.startDate ? 1 : -1)),
    [data],
  );

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['vacations'] });
  }, [queryClient]);

  const resetForm = () => {
    setFormType('VACACIONES');
    setFormStart(getMexicoTodayISO());
    setFormEnd(getMexicoTodayISO());
    setFormReason('');
  };

  const handleSubmit = async () => {
    if (!employeeId) {
      toast.error('Su cuenta no tiene perfil de empleado.');
      return;
    }
    if (!formType || !formStart || !formEnd) {
      toast.error('Completa todos los campos obligatorios.');
      return;
    }
    if (formStart > formEnd) {
      toast.error('La fecha de inicio no puede ser posterior a la de fin.');
      return;
    }
    setSubmitting(true);
    try {
      await apiSend('/api/vacations', 'POST', {
        employeeId,
        type: formType,
        startDate: formStart,
        endDate: formEnd,
        reason: formReason.trim() || null,
      });
      toast.success('Solicitud enviada', {
        description: 'Tu solicitud está pendiente de aprobación.',
      });
      setDialogOpen(false);
      resetForm();
      invalidateAll();
    } catch (e) {
      toast.error('No se pudo enviar la solicitud', {
        description: (e as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await apiSend(`/api/vacations/${cancelTarget.id}`, 'DELETE');
      toast.success('Solicitud cancelada');
      setCancelTarget(null);
      invalidateAll();
    } catch (e) {
      toast.error('No se pudo cancelar', { description: (e as Error).message });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-bold">Mis Vacaciones y Permisos</h2>
        <Button onClick={() => setDialogOpen(true)} className="gap-1.5" disabled={!employeeId}>
          <Plus className="w-4 h-4" /> Nueva solicitud
        </Button>
      </div>

      {/* Balance card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Mi saldo
          </CardTitle>
          <CardDescription className="text-xs">
            Días de vacaciones disponibles al {formatDateInMexico(new Date())}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {balanceLoading ? (
            <LoadingState rows={1} />
          ) : balance ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <BalanceCard
                label="Días totales"
                value={balance.totalDays}
                icon={CalendarDays}
                tone="zinc"
              />
              <BalanceCard
                label="Días usados"
                value={balance.usedDays}
                icon={CheckCircle2}
                tone="emerald"
              />
              <BalanceCard
                label="Días pendientes"
                value={balance.pendingDays}
                icon={Hourglass}
                tone="amber"
              />
              <BalanceCard
                label="Días disponibles"
                value={balance.remainingDays}
                icon={CalendarCheck}
                tone="emerald"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No se pudo cargar el saldo.{' '}
              <button
                onClick={() => refetch()}
                className="underline hover:text-foreground"
              >
                Reintentar
              </button>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Requests table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mis solicitudes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <LoadingState rows={4} />
            </div>
          ) : isError ? (
            <ErrorState message={(error as Error)?.message || 'Error al cargar solicitudes'} />
          ) : vacations.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="Sin solicitudes"
              subtitle="Crea tu primera solicitud con el botón 'Nueva solicitud'."
            />
          ) : (
            <div className={`max-h-[55vh] overflow-auto ${SCROLLBAR_CLASS}`}>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="whitespace-nowrap">Fecha solicitud</TableHead>
                    <TableHead className="whitespace-nowrap">Tipo</TableHead>
                    <TableHead className="whitespace-nowrap">Inicio</TableHead>
                    <TableHead className="whitespace-nowrap">Fin</TableHead>
                    <TableHead className="whitespace-nowrap">Días</TableHead>
                    <TableHead className="whitespace-nowrap">Estado</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vacations.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateInMexico(v.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className="text-xs">
                          {VACATION_TYPE_LABEL[v.type] ?? v.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDateInMexico(v.startDate)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDateInMexico(v.endDate)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center font-mono text-xs">
                        {v.days}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <VacationStatusBadge status={v.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {v.status === 'PENDING' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1.5"
                            onClick={() => setCancelTarget(v)}
                          >
                            <Ban className="w-3.5 h-3.5" /> Cancelar
                          </Button>
                        ) : v.status === 'REJECTED' && v.rejectionReason ? (
                          <span
                            className="text-xs text-rose-600 italic max-w-[200px] block truncate"
                            title={v.rejectionReason}
                          >
                            {v.rejectionReason}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New request dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva solicitud</DialogTitle>
            <DialogDescription>
              Completa el formulario para solicitar vacaciones o un permiso.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(VACATION_TYPE_LABEL).map(([k, lbl]) => (
                    <SelectItem key={k} value={k}>
                      {lbl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fecha inicio</Label>
                <Input
                  type="date"
                  value={formStart}
                  onChange={(e) => setFormStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha fin</Label>
                <Input
                  type="date"
                  value={formEnd}
                  min={formStart}
                  onChange={(e) => setFormEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Motivo (opcional)</Label>
              <Textarea
                placeholder="Describe el motivo de tu solicitud…"
                value={formReason}
                onChange={(e) => setFormReason(e.target.value)}
                rows={3}
              />
            </div>
            {formStart && formEnd && formStart <= formEnd && (
              <p className="text-xs text-muted-foreground">
                Días naturales solicitados:{' '}
                <span className="font-medium text-foreground">
                  {Math.ceil(
                    (new Date(formEnd).getTime() - new Date(formStart).getTime()) / 86_400_000,
                  ) + 1}
                </span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-1.5">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Enviar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar solicitud</DialogTitle>
            <DialogDescription>
              ¿Seguro que deseas cancelar la solicitud{' '}
              <strong>{cancelTarget ? VACATION_TYPE_LABEL[cancelTarget.type] : ''}</strong> del{' '}
              {cancelTarget ? formatDateInMexico(cancelTarget.startDate) : ''} al{' '}
              {cancelTarget ? formatDateInMexico(cancelTarget.endDate) : ''}? Esta acción no se
              puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Cerrar
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
              className="gap-1.5"
            >
              {cancelling && <Loader2 className="w-4 h-4 animate-spin" />}
              Sí, cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function BalanceCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone: 'zinc' | 'emerald' | 'amber' | 'rose';
}) {
  const tones: Record<string, string> = {
    zinc: 'bg-zinc-50 border-zinc-200 text-zinc-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs">{label}</p>
        <Icon className="w-3.5 h-3.5 opacity-70" />
      </div>
      <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
    </div>
  );
}

// ============================================================
// QrView — Mi QR
// ============================================================

function QrView() {
  const { user } = useAuthStore();
  const employeeId = user?.employeeId ?? null;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['employees', 'qr', employeeId],
    queryFn: () => apiGet<QrData>(`/api/employees/${employeeId}/qr`),
    enabled: !!employeeId,
    staleTime: 5 * 60_000,
  });

  const handleDownload = () => {
    if (!data?.qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `qr_${(user?.name || 'empleado').replace(/\s+/g, '_').toLowerCase()}.png`;
    link.href = data.qrDataUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('QR descargado en PNG');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      <h2 className="text-xl font-bold">Mi Código QR</h2>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Presenta este código QR al administrador o terminal de asistencia para registrar tu
              entrada o salida.
            </p>

            {!employeeId ? (
              <div className="w-64 h-64 flex items-center justify-center bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
                <div>
                  <AlertOctagon className="w-10 h-10 text-rose-500 mx-auto mb-2" />
                  <p className="text-sm text-rose-700">
                    Tu cuenta no tiene un perfil de empleado asociado.
                  </p>
                </div>
              </div>
            ) : isLoading ? (
              <Skeleton className="w-64 h-64 rounded-xl" />
            ) : isError ? (
              <div className="w-64 h-64 flex items-center justify-center bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
                <div>
                  <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
                  <p className="text-sm text-rose-700 mb-3">
                    {(error as Error)?.message || 'No se pudo generar el QR'}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> Reintentar
                  </Button>
                </div>
              </div>
            ) : data?.qrDataUrl ? (
              <>
                <div className="p-3 bg-white rounded-xl border shadow-sm">
                  <img
                    src={data.qrDataUrl}
                    alt="Mi Código QR"
                    className="w-56 h-56"
                  />
                </div>
                <div className="text-center">
                  <p className="font-medium">{user?.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    #{data.employeeNumber}
                  </p>
                </div>
                <Button onClick={handleDownload} variant="outline" className="gap-1.5">
                  <Download className="w-4 h-4" /> Descargar PNG
                </Button>
              </>
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-xl">
                <p className="text-sm text-muted-foreground">No se pudo generar el QR</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Mostrar para check-in por admin</p>
              <p>
                Si el administrador necesita registrar tu entrada o salida desde el panel,
                muestra este código QR para que lo escanee.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================================
// Bottom navigation
// ============================================================

interface NavItem {
  id: EmployeeView;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'attendance', label: 'Asistencia', icon: Clock },
  { id: 'history', label: 'Historial', icon: HistoryIcon },
  { id: 'vacations', label: 'Vacaciones', icon: CalendarCheck },
  { id: 'qr', label: 'Mi QR', icon: QrCode },
];

function BottomNav({
  current,
  onChange,
}: {
  current: EmployeeView;
  onChange: (v: EmployeeView) => void;
}) {
  return (
    <nav
      aria-label="Navegación principal"
      className="sticky bottom-0 z-30 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
    >
      <div className="mx-auto max-w-2xl grid grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const active = current === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[60px] transition-colors ${
                active
                  ? 'text-emerald-700'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div
                className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-colors ${
                  active ? 'bg-emerald-100' : ''
                }`}
              >
                <Icon className="w-5 h-5" />
                {active && (
                  <motion.span
                    layoutId="nav-dot"
                    className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-emerald-600"
                  />
                )}
              </div>
              <span className="text-[11px] font-medium leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ============================================================
// Header
// ============================================================

function EmployeeHeader() {
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore — proceed with local logout
    }
    logout();
    if (typeof window !== 'undefined') {
      document.cookie = 'session_user=; path=/; max-age=0';
      window.location.href = '/';
    }
  };

  const initial = (user?.name || 'U').trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="mx-auto max-w-2xl px-4 h-14 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-emerald-50 flex items-center justify-center shrink-0">
            <img src="/logo.svg" alt="Logo" className="w-full h-full object-contain p-1" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground leading-none">
              {greeting()},
            </p>
            <p className="text-sm font-semibold truncate leading-tight">
              {user?.name || 'Empleado'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {user?.sucursalName && (
            <Badge variant="outline" className="hidden sm:inline-flex gap-1 text-xs">
              <Building2 className="w-3 h-3" />
              {user.sucursalName}
            </Badge>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 h-9 px-1.5 rounded-full hover:bg-accent transition-colors"
                aria-label="Menú de usuario"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-semibold">
                  {initial}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium truncate">{user?.name}</span>
                  <span className="text-xs text-muted-foreground font-normal truncate">
                    {user?.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {user?.sucursalName && (
                <div className="px-2 py-1.5 text-xs flex items-center gap-2 text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5" />
                  {user.sucursalName}
                  {user.sucursalCodigoLocal && ` · Local ${user.sucursalCodigoLocal}`}
                </div>
              )}
              <DropdownMenuItem className="text-xs text-muted-foreground" disabled>
                <User className="w-3.5 h-3.5 mr-2" />
                Rol: Empleado
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-rose-600 focus:text-rose-700 focus:bg-rose-50 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

// ============================================================
// ElectronicRecordAgreementGate — RT-P0.5 onboarding
// (art. 132 fracción XXXIV LFT, reformado DOF 27-dic-2024)
//
// Al montar el EmployeeLayout, verifica si el empleado autenticado
// tiene un ElectronicRecordAgreement activo con la versión vigente.
// Si NO lo tiene, muestra:
//   1) Un banner ámbar fijo en la parte superior del dashboard con
//      un botón "Leer y aceptar acuerdo".
//   2) Un modal NO cerrable (sin botón X, sin Escape, sin click fuera)
//      con el texto íntegro del acuerdo, una casilla de confirmación
//      y un botón "Aceptar" (deshabilitado hasta marcar la casilla).
//
// El empleado DEBE aceptar para poder usar el sistema — el endpoint
// /api/attendance/check-in bloquea con HTTP 403 RECORD_AGREEMENT_REQUIRED
// si no existe acuerdo activo (auto-check-in only; admin actions no
// se bloquean).
//
// El hash SHA-256 del texto aceptado se calcula en el navegador con
// la Web Crypto API y se envía al backend, que lo valida contra el
// texto vigente (con los datos actuales de la empresa) para evitar
// manipulaciones.
// ============================================================

interface AgreementStatusResponse {
  hasActiveAgreement: boolean;
  needsAcceptance: boolean;
  currentVersion?: string;
  agreedAt?: string | null;
  reason?: string;
}

interface AgreementDetailResponse {
  hasActiveAgreement: boolean;
  agreement: { agreedAt: string; agreementVersion: string; documentHash: string } | null;
  currentVersion: string;
  needsAcceptance: boolean;
  agreementText: string | null;
}

async function sha256Hex(text: string): Promise<string> {
  // Web Crypto API — disponible en navegadores modernos y en workers.
  // Equivalente a Node's crypto.createHash('sha256') usado en el backend.
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function ElectronicRecordAgreementGate() {
  const { user } = useAuthStore();
  // Solo aplica a empleados. Si el usuario no es EMPLOYEE, no renderiza nada.
  const isEmployee = user?.role === 'EMPLOYEE';

  const [needsAcceptance, setNeedsAcceptance] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [agreementText, setAgreementText] = useState<string | null>(null);
  const [agreementVersion, setAgreementVersion] = useState<string>('1.0');
  const [hasRead, setHasRead] = useState<boolean>(false);
  const [accepting, setAccepting] = useState<boolean>(false);
  const [loadingText, setLoadingText] = useState<boolean>(false);

  // ----- check on mount -----
  useEffect(() => {
    if (!isEmployee) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/api/employee/agreement/status', { method: 'GET' });
        if (!res.ok) return;
        const data = (await res.json()) as AgreementStatusResponse;
        if (cancelled) return;
        setNeedsAcceptance(!!data.needsAcceptance);
        if (data.currentVersion) setAgreementVersion(data.currentVersion);
      } catch {
        // no-op — no bloqueamos al usuario si la API falla; el check-in lo
        // bloqueará con HTTP 403 si realmente no tiene acuerdo.
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEmployee]);

  // ----- load full agreement text on demand (when modal opens) -----
  useEffect(() => {
    if (!modalOpen || agreementText) return;
    let cancelled = false;
    setLoadingText(true);
    (async () => {
      try {
        const res = await authFetch('/api/employee/agreement', { method: 'GET' });
        if (!res.ok) {
          toast.error('No se pudo cargar el acuerdo. Intenta nuevamente.');
          return;
        }
        const data = (await res.json()) as AgreementDetailResponse;
        if (cancelled) return;
        if (data.agreementText) {
          setAgreementText(data.agreementText);
          if (data.currentVersion) setAgreementVersion(data.currentVersion);
        } else if (!data.needsAcceptance) {
          // edge case: el usuario aceptó entre el status check y ahora.
          setNeedsAcceptance(false);
          setModalOpen(false);
        }
      } catch {
        if (!cancelled) toast.error('Error de red al cargar el acuerdo.');
      } finally {
        if (!cancelled) setLoadingText(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalOpen, agreementText]);

  // ----- accept handler -----
  const handleAccept = async () => {
    if (!agreementText || !hasRead || accepting) return;
    setAccepting(true);
    try {
      const hash = await sha256Hex(agreementText);
      const res = await authFetch('/api/employee/agreement', {
        method: 'POST',
        body: JSON.stringify({ agreementHash: hash }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        if (data.error === 'HASH_MISMATCH') {
          toast.error(
            'El acuerdo fue actualizado. Recargaremos la página para mostrar la versión vigente.'
          );
          // Limpiar cache del texto para forzar recarga
          setAgreementText(null);
          setTimeout(() => {
            if (typeof window !== 'undefined') window.location.reload();
          }, 1500);
          return;
        }
        toast.error(data.message || data.error || 'No se pudo registrar la aceptación.');
        return;
      }
      setNeedsAcceptance(false);
      setModalOpen(false);
      setHasRead(false);
      toast.success('Acuerdo aceptado. Ya puedes registrar tu asistencia.');
    } catch {
      toast.error('Error de red al aceptar el acuerdo.');
    } finally {
      setAccepting(false);
    }
  };

  if (checking || !isEmployee || !needsAcceptance) return null;

  return (
    <>
      {/* ----- banner fijo en la parte superior del dashboard ----- */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:p-4 dark:border-amber-900/40 dark:bg-amber-950/30"
        role="alert"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-amber-100 p-2 shrink-0 dark:bg-amber-900/50">
            <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Acción requerida
            </p>
            <p className="text-xs text-amber-800 mt-0.5 dark:text-amber-200/80">
              Debes aceptar el <strong>Acuerdo de Registro Electrónico de Jornada</strong>{' '}
              (LFT art. 132 XXXIV) para poder registrar tu asistencia.
            </p>
            <Button
              size="sm"
              className="mt-2 h-8 bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => setModalOpen(true)}
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              Leer y aceptar acuerdo
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ----- modal NO cerrable ----- */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          // Prevenir cierre por click fuera o Escape: solo el botón Aceptar
          // puede cerrar el modal.
          if (!open) return;
          setModalOpen(open);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-2xl max-h-[90vh] flex flex-col"
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          aria-describedby="agreement-description"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Acuerdo de Registro Electrónico de Jornada
            </DialogTitle>
            <DialogDescription id="agreement-description" className="text-xs">
              Fundamento: LFT art. 132 fracción XXXIV (reformado DOF 27-dic-2024). El
              registro electrónico hará prueba plena si fue acordado entre trabajador y
              empleador. Versión vigente: <strong>{agreementVersion}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0">
            {loadingText ? (
              <div className="flex flex-col items-center justify-center h-48">
                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                <p className="text-xs text-muted-foreground mt-2">
                  Cargando el texto del acuerdo…
                </p>
              </div>
            ) : agreementText ? (
              <ScrollArea className="h-[40vh] sm:h-[48vh] rounded-md border bg-muted/30 p-4">
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">
                  {agreementText}
                </pre>
              </ScrollArea>
            ) : (
              <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
                No se pudo cargar el texto.
              </div>
            )}
          </div>

          <div className="mt-2 space-y-3">
            <label
              htmlFor="agreement-read-check"
              className="flex items-start gap-2.5 cursor-pointer select-none rounded-md border bg-muted/30 p-3 hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                id="agreement-read-check"
                checked={hasRead}
                onCheckedChange={(v) => setHasRead(v === true)}
                className="mt-0.5"
                disabled={!agreementText || accepting}
              />
              <span className="text-xs sm:text-sm text-foreground leading-snug">
                He leído el acuerdo completo, entiendo que el registro electrónico hará
                prueba plena conforme al art. 132 XXXIV de la LFT, y estoy de acuerdo en
                utilizar el sistema de registro electrónico de jornada.
              </span>
            </label>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Lock className="w-3 h-3" />
              <span>
                Tu aceptación se registrará con la fecha, hora, dirección IP y
                User-Agent como evidencia probatoria.
              </span>
            </div>

            <DialogFooter>
              <Button
                onClick={handleAccept}
                disabled={!hasRead || !agreementText || accepting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {accepting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Procesando…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Aceptar acuerdo
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============================================================
// Main layout shell
// ============================================================

function EmployeeLayoutInner() {
  const { user } = useAuthStore();
  const { employeeView, setEmployeeView } = useAppStore();

  const renderView = () => {
    switch (employeeView) {
      case 'attendance':
        return <AttendanceView />;
      case 'history':
        return <HistoryView />;
      case 'vacations':
        return <VacationsView />;
      case 'qr':
        return <QrView />;
      default:
        return <AttendanceView />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <EmployeeHeader />
      <main className="flex-1 overflow-y-auto px-4 py-4 sm:py-6">
        <div className="mx-auto max-w-2xl">
          {/* RT-P0.5 — banner + modal de onboarding del acuerdo de registro
              electrónico (LFT art. 132 XXXIV). Renderiza null si el empleado
              ya tiene acuerdo activo o si el usuario no es EMPLOYEE. */}
          <ElectronicRecordAgreementGate />
          <AnimatePresence mode="wait">
            <motion.div
              key={employeeView}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {user?.employeeId ? (
                renderView()
              ) : employeeView === 'attendance' || employeeView === 'history' || employeeView === 'vacations' || employeeView === 'qr' ? (
                renderView()
              ) : (
                <AttendanceView />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <BottomNav current={employeeView} onChange={setEmployeeView} />
    </div>
  );
}

// Stable QueryClient provider — wraps the layout so the
// useMyAttendance / useQuery hooks work even without an app-level provider.
function useStableQueryClient() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: true,
            refetchIntervalInBackground: false,
            retry: 1,
          },
        },
      }),
  );
  return client;
}

export function EmployeeLayout() {
  const client = useStableQueryClient();
  return (
    <QueryClientProvider client={client}>
      <EmployeeLayoutInner />
    </QueryClientProvider>
  );
}
