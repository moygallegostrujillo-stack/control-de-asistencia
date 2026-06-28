'use client';

import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/fetch-helper';

export function useDynamicQR() {
  return useQuery<{ code: string; expiresAt: string }>({
    queryKey: ['qr', 'dynamic'],
    queryFn: async () => {
      const res = await authFetch('/api/qr/dynamic');
      if (!res.ok) throw new Error('Error');
      return res.json();
    },
    refetchInterval: 60_000, // 60s (QR caduca 5 min)
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}
