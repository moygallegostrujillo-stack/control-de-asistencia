// ============================================================
// Realtime emitter — DESACTIVADO en producción
// ------------------------------------------------------------
// El servicio de Socket.io NO está desplegado en Vercel.
// Todas las funciones son no-ops (no hacen nada) para evitar
// fetch a localhost:3003 que causaba timeout en serverless
// y "Load failed" en iOS Safari.
//
// Para reactivar: descomentar el código de emitRealtime y
// desplegar el mini-service en mini-services/realtime-service/.
// ============================================================

interface EmitParams {
  event: string;
  payload: any;
  room?: string;
}

/**
 * NO-OP: no emite nada. El servicio realtime no está desplegado.
 */
export async function emitRealtime(_params: EmitParams): Promise<void> {
  return;
}

export async function emitCheckIn(_data: {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  sucursalId: string;
  time: string;
  method: string;
  status?: string;
}): Promise<void> {
  return;
}

export async function emitCheckOut(_data: {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  sucursalId: string;
  time: string;
  method: string;
  workedMinutes?: number;
}): Promise<void> {
  return;
}

export async function emitBreakStart(_data: {
  employeeId: string;
  employeeName: string;
  sucursalId: string;
  time: string;
}): Promise<void> {
  return;
}

export async function emitBreakEnd(_data: {
  employeeId: string;
  employeeName: string;
  sucursalId: string;
  time: string;
  durationMinutes: number;
  exceeded: boolean;
}): Promise<void> {
  return;
}

export async function emitVacationRequested(_data: {
  vacationId: string;
  employeeId: string;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  sucursalId?: string;
}): Promise<void> {
  return;
}

export async function emitVacationStatus(_data: {
  vacationId: string;
  employeeId: string;
  status: string;
  approvedBy: string;
  sucursalId?: string;
}): Promise<void> {
  return;
}
