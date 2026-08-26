'use client';

import { useQuery } from '@tanstack/react-query';
import { authFetch } from '@/lib/fetch-helper';

export function useMyAttendance() {
  return useQuery({
    queryKey: ['attendance', 'mine'],
    queryFn: async () => {
      const res = await authFetch('/api/attendance/today');
      if (!res.ok) {
        // Surface el mensaje real del servidor para facilitar el diagnóstico.
        // Si la respuesta no es JSON, usa el status code.
        let msg = `Error ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
          if (body?.code === 'PRIVACY_CONSENT_REQUIRED') {
            msg = 'Debe aceptar el Aviso de Privacidad para continuar.';
          }
        } catch {
          // body no es JSON — mantener el msg por defecto
        }
        throw new Error(msg);
      }
      return res.json();
    },
    // 26-ago-2026: subido de 30s a 120s — reduce tráfico innecesario para
    // empleados que dejan la app abierta. El dato cambia pocas veces al día.
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });
}
