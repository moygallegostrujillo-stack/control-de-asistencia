'use client';

import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/fetch-helper';
import { getMexicoTodayISO } from '@/lib/timezone';

export interface TodayRecord {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  department: string;
  position: string;
  sucursalId: string;
  sucursalName: string;
  sucursalCodigoLocal: string | null;
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
  checkInMethod: string | null;
  checkOutMethod: string | null;
  checkInLat: number | null;
  checkInLong: number | null;
}

export interface TodayResponse {
  records: TodayRecord[];
  absents: { id: string; name: string; employeeNumber: string; sucursalName: string }[];
  stats: {
    total: number;
    present: number;
    late: number;
    absent: number;
    earlyLeave?: number;
    onBreak: number;
    breakExceeded: number;
    breakTotalMinutes: number;
    overtimeHours: number;
  };
  sucursalFilter?: string | null;
  isHistorical?: boolean;
}

/**
 * Hook para obtener la asistencia de un día específico.
 *
 * @param sucursalId  Filtra por sucursal (solo relevante para GENERAL_ADMIN).
 *                    Pasar `null` o `undefined` para "todas las sucursales".
 * @param dateISO     Fecha en formato YYYY-MM-DD (zona horaria Mexico).
 *                    Si se omite o es vacío, usa hoy.
 *                    Cuando la fecha es distinta a hoy, se desactiva el
 *                    polling automático (los datos históricos no cambian).
 */
export function useAttendanceToday(sucursalId?: string | null, dateISO?: string) {
  const todayISO = getMexicoTodayISO();
  const effectiveDate = dateISO || todayISO;
  const isToday = effectiveDate === todayISO;

  const params = new URLSearchParams();
  if (sucursalId) params.set('sucursalId', sucursalId);
  if (effectiveDate && !isToday) params.set('date', effectiveDate);
  const qs = params.toString();
  const url = `/api/attendance/today${qs ? `?${qs}` : ''}`;

  return useQuery<TodayResponse>({
    queryKey: ['attendance', 'today', sucursalId ?? 'all', effectiveDate],
    queryFn: async () => {
      const res = await authFetch(url);
      if (!res.ok) throw new Error('Error al cargar asistencia');
      return res.json();
    },
    // Solo hacer polling cuando es hoy (datos en vivo).
    // Para fechas pasadas los datos son estáticos, no tiene sentido refrescar.
    refetchInterval: isToday ? 20_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: isToday,
    staleTime: isToday ? 10_000 : 5 * 60_000, // históricos: 5 min de cache
  });
}
