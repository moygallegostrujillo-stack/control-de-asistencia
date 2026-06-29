// ============================================================
// useRealtime — Hook para escuchar eventos Socket.io en el cliente
// ============================================================
//
// Conecta al mini-service de Socket.io (puerto 3003 vía gateway).
// Escucha eventos de asistencia y vacaciones, e invalida queries
// de TanStack Query para que el dashboard se actualice al instante.
//
// Uso en AdminLayout:
//   useRealtime({ onCheckIn, onCheckOut, onVacationRequested });
//
// El gateway Caddy redirige /socket.io/ al puerto 3003 via XTransformPort.
// ============================================================

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { toast } from 'sonner';

interface RealtimeEvent {
  employeeId?: string;
  employeeName?: string;
  employeeNumber?: string;
  sucursalId?: string;
  time?: string;
  method?: string;
  status?: string;
  workedMinutes?: number;
  durationMinutes?: number;
  exceeded?: boolean;
  vacationId?: string;
  type?: string;
  days?: number;
  startDate?: string;
  endDate?: string;
}

interface UseRealtimeOptions {
  enabled?: boolean;
  onCheckIn?: (data: RealtimeEvent) => void;
  onCheckOut?: (data: RealtimeEvent) => void;
  onBreakStart?: (data: RealtimeEvent) => void;
  onBreakEnd?: (data: RealtimeEvent) => void;
  onVacationRequested?: (data: RealtimeEvent) => void;
  onVacationStatus?: (data: RealtimeEvent) => void;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const {
    enabled = true,
    onCheckIn,
    onCheckOut,
    onBreakStart,
    onBreakEnd,
    onVacationRequested,
    onVacationStatus,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // Stable callbacks
  const handleCheckIn = useCallback(
    (data: RealtimeEvent) => {
      // Invalidar queries del dashboard para refrescar datos
      queryClient.invalidateQueries({ queryKey: ['attendance', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['my-attendance'] });

      if (onCheckIn) {
        onCheckIn(data);
      } else {
        toast.success(`✅ ${data.employeeName} checó entrada`, {
          description: data.method === 'GPS' ? 'Ubicación GPS' : 'Código QR',
        });
      }
    },
    [queryClient, onCheckIn]
  );

  const handleCheckOut = useCallback(
    (data: RealtimeEvent) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      if (onCheckOut) {
        onCheckOut(data);
      } else {
        toast.info(`🏁 ${data.employeeName} finalizó jornada`, {
          description: data.workedMinutes
            ? `${Math.floor(data.workedMinutes / 60)}h ${data.workedMinutes % 60}m trabajadas`
            : undefined,
        });
      }
    },
    [queryClient, onCheckOut]
  );

  const handleBreakStart = useCallback(
    (data: RealtimeEvent) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      if (onBreakStart) {
        onBreakStart(data);
      }
    },
    [queryClient, onBreakStart]
  );

  const handleBreakEnd = useCallback(
    (data: RealtimeEvent) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      if (onBreakEnd) {
        onBreakEnd(data);
      } else if (data.exceeded) {
        toast.warning(`⚠️ ${data.employeeName} excedió el descanso`, {
          description: `${data.durationMinutes} min (límite 30)`,
        });
      }
    },
    [queryClient, onBreakEnd]
  );

  const handleVacationRequested = useCallback(
    (data: RealtimeEvent) => {
      queryClient.invalidateQueries({ queryKey: ['vacations'] });

      if (onVacationRequested) {
        onVacationRequested(data);
      } else {
        toast.info(`🏖️ Nueva solicitud de vacaciones`, {
          description: `${data.employeeName}: ${data.days} días`,
        });
      }
    },
    [queryClient, onVacationRequested]
  );

  const handleVacationStatus = useCallback(
    (data: RealtimeEvent) => {
      queryClient.invalidateQueries({ queryKey: ['vacations'] });
      queryClient.invalidateQueries({ queryKey: ['vacation-balance'] });

      if (onVacationStatus) {
        onVacationStatus(data);
      }
    },
    [queryClient, onVacationStatus]
  );

  useEffect(() => {
    if (!enabled || !user) return;

    // Construir URL del socket via gateway (XTransformPort=3003)
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      auth: {
        token: typeof window !== 'undefined'
          ? localStorage.getItem('auth-payload')
          : null,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[realtime] Conectado:', socket.id);
      setConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('[realtime] Desconectado:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn('[realtime] Error de conexión:', err.message);
    });

    // Registrar listeners de eventos
    socket.on('attendance:check-in', handleCheckIn);
    socket.on('attendance:check-out', handleCheckOut);
    socket.on('attendance:break-start', handleBreakStart);
    socket.on('attendance:break-end', handleBreakEnd);
    socket.on('vacation:requested', handleVacationRequested);
    socket.on('vacation:status', handleVacationStatus);

    return () => {
      socket.off('attendance:check-in', handleCheckIn);
      socket.off('attendance:check-out', handleCheckOut);
      socket.off('attendance:break-start', handleBreakStart);
      socket.off('attendance:break-end', handleBreakEnd);
      socket.off('vacation:requested', handleVacationRequested);
      socket.off('vacation:status', handleVacationStatus);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [
    enabled,
    user,
    handleCheckIn,
    handleCheckOut,
    handleBreakStart,
    handleBreakEnd,
    handleVacationRequested,
    handleVacationStatus,
  ]);

  return { connected };
}
