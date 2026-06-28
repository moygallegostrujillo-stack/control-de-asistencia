'use client';

import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/fetch-helper';

export function useMyAttendance() {
  return useQuery({
    queryKey: ['attendance', 'mine'],
    queryFn: async () => {
      const res = await authFetch('/api/attendance/today');
      if (!res.ok) throw new Error('Error');
      return res.json();
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
}
