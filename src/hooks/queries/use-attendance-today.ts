'use client';

import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/fetch-helper';

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
    onBreak: number;
    breakExceeded: number;
    breakTotalMinutes: number;
    overtimeHours: number;
  };
  sucursalFilter?: string | null;
}

export function useAttendanceToday(sucursalId?: string | null) {
  return useQuery<TodayResponse>({
    queryKey: ['attendance', 'today', sucursalId ?? 'all'],
    queryFn: async () => {
      const url = sucursalId
        ? `/api/attendance/today?sucursalId=${encodeURIComponent(sucursalId)}`
        : '/api/attendance/today';
      const res = await authFetch(url);
      if (!res.ok) throw new Error('Error al cargar asistencia');
      return res.json();
    },
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
}
