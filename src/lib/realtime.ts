// ============================================================
// Realtime emitter — Helper para emitir eventos desde API routes
// al mini-service de Socket.io (puerto 3003)
// ============================================================

interface EmitParams {
  event: string;
  payload: any;
  room?: string; // 'admin:global' | 'admin:sucursal:<id>' | etc
}

const REALTIME_URL = process.env.REALTIME_SERVICE_URL || 'http://localhost:3003';

/**
 * Emite un evento al servicio de tiempo real (Socket.io).
 * No lanza errores — si el servicio está caído, simplemente no emite
 * (la app sigue funcionando con polling como fallback).
 */
export async function emitRealtime({ event, payload, room }: EmitParams): Promise<void> {
  try {
    await fetch(`${REALTIME_URL}/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, payload, room }),
    });
  } catch (err) {
    // Silencioso: el servicio de tiempo real es opcional
    if (process.env.NODE_ENV === 'development') {
      console.warn('[realtime] No se pudo emitir evento:', (err as Error).message);
    }
  }
}

/**
 * Emite evento de check-in a todos los admins.
 */
export async function emitCheckIn(data: {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  sucursalId: string;
  time: string;
  method: string;
  status?: string;
}): Promise<void> {
  await emitRealtime({
    event: 'attendance:check-in',
    payload: data,
    room: 'admin:global', // Se emite a todos los admins globalmente
  });
  // También a los admins de la sucursal específica
  await emitRealtime({
    event: 'attendance:check-in',
    payload: data,
    room: `admin:sucursal:${data.sucursalId}`,
  });
}

/**
 * Emite evento de check-out (fin de jornada).
 */
export async function emitCheckOut(data: {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  sucursalId: string;
  time: string;
  method: string;
  workedMinutes?: number;
}): Promise<void> {
  await emitRealtime({
    event: 'attendance:check-out',
    payload: data,
    room: `admin:sucursal:${data.sucursalId}`,
  });
}

/**
 * Emite evento de inicio de descanso.
 */
export async function emitBreakStart(data: {
  employeeId: string;
  employeeName: string;
  sucursalId: string;
  time: string;
}): Promise<void> {
  await emitRealtime({
    event: 'attendance:break-start',
    payload: data,
    room: `admin:sucursal:${data.sucursalId}`,
  });
}

/**
 * Emite evento de fin de descanso.
 */
export async function emitBreakEnd(data: {
  employeeId: string;
  employeeName: string;
  sucursalId: string;
  time: string;
  durationMinutes: number;
  exceeded: boolean;
}): Promise<void> {
  await emitRealtime({
    event: 'attendance:break-end',
    payload: data,
    room: `admin:sucursal:${data.sucursalId}`,
  });
}

/**
 * Emite evento de solicitud de vacaciones.
 */
export async function emitVacationRequested(data: {
  vacationId: string;
  employeeId: string;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  sucursalId?: string;
}): Promise<void> {
  await emitRealtime({
    event: 'vacation:requested',
    payload: data,
    room: data.sucursalId ? `admin:sucursal:${data.sucursalId}` : 'admin:global',
  });
}

/**
 * Emite evento de cambio de status de vacaciones (aprobada/rechazada).
 */
export async function emitVacationStatus(data: {
  vacationId: string;
  employeeId: string;
  status: string;
  approvedBy: string;
  sucursalId?: string;
}): Promise<void> {
  await emitRealtime({
    event: 'vacation:status',
    payload: data,
    room: data.sucursalId ? `admin:sucursal:${data.sucursalId}` : 'admin:global',
  });
}
