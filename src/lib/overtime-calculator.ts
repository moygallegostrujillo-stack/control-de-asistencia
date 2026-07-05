// ============================================================
// OVERTIME CALCULATOR — fix #2 + Reforma LFT 2027 (art. 66/68)
// Aplica checkoutToleranceMinutes antes de contar horas extra.
// Distingue horas extra DOBLES (art. 66) de TRIPLES (art. 68).
// Tope semanal gradual: 9h (2026-27) → 10h (2028) → 11h (2029) → 12h (2030).
// Tope diario: 4h extra (art. 66).
// ============================================================

import type { AttendanceRecord, Sucursal, WorkSchedule } from '@prisma/client';
import { getDayOfWeek, minutesBetween, toISODate } from './timezone';

export interface OvertimeInput {
  record: AttendanceRecord;
  schedule: WorkSchedule | null;
  sucursal: Pick<Sucursal, 'checkoutToleranceMinutes'>;
  /** Minutos extra ya acumulados en la semana (excluyendo el día actual). */
  weeklyAccumulatedMinutes?: number;
}

export interface OvertimeResult {
  workedMinutes: number | null;
  overtimeMinutes: number;
  overtimeHours: number;
  // --- Reforma LFT 2027 ---
  overtimeDoubleMinutes: number; // art. 66 — primeras horas del tope semanal, pagan al doble
  overtimeTripleMinutes: number; // art. 68 — excedente del tope semanal, pagan al triple
  overtimeWeeklyAccumulated: number; // acumulado semanal previo (sin contar este registro)
  overtimeWeeklyTotal: number; // acumulado + este registro
  isLate: boolean;
  isEarlyLeave: boolean;
  status: 'PRESENT' | 'LATE' | 'EARLY_LEAVE' | 'ABSENT';
}

/**
 * Devuelve el tope semanal de horas extra (en minutos) según el año.
 * Transitorio Cuarto, DOF 1-may-2026.
 *   2026-2027: 9h
 *   2028: 10h
 *   2029: 11h
 *   2030+: 12h
 */
export function getWeeklyOvertimeCapMinutes(year: number = new Date().getFullYear()): number {
  if (year <= 2027) return 9 * 60;
  if (year === 2028) return 10 * 60;
  if (year === 2029) return 11 * 60;
  return 12 * 60;
}

/** Tope diario de horas extra (art. 66 LFT) — 4 horas = 240 minutos. */
export const DAILY_OVERTIME_CAP_MINUTES = 4 * 60;

/**
 * Calcula horas trabajadas, horas extra (con tolerancia aplicada — fix #2),
 * distinción dobles/triples (reforma LFT 2027), y estado (PRESENT/LATE/EARLY_LEAVE).
 *
 * Fórmula overtime con tolerancia (fix #2):
 *   overtimeMinutes = max(0, workedMinutes - scheduledMinutes - checkoutToleranceMinutes)
 *
 * Distribución dobles/triples (reforma LFT 2027):
 *   - Tope diario: 4h (DAILY_OVERTIME_CAP_MINUTES)
 *   - Tope semanal (gradual): 9h en 2027 → 12h en 2030
 *   - overtimeDaily = min(overtimeMinutes, 240)
 *   - weeklyBefore = weeklyAccumulatedMinutes (días previos de la misma semana)
 *   - cabeEnDoble = max(0, capSemanal - weeklyBefore)
 *   - overtimeDoubleMinutes = min(overtimeDaily, cabeEnDoble)
 *   - overtimeTripleMinutes = overtimeDaily - overtimeDoubleMinutes
 *   - El excedente sobre el tope diario no se paga como extra ese día
 *     (es jornada no autorizada, se reporta pero no se acumula).
 */
export function calculateOvertime(input: OvertimeInput): OvertimeResult {
  const { record, schedule, sucursal, weeklyAccumulatedMinutes = 0 } = input;

  // Si no hay check-in ni check-out, no se puede calcular
  if (!record.checkInTime || !record.checkOutTime) {
    return {
      workedMinutes: null,
      overtimeMinutes: 0,
      overtimeHours: 0,
      overtimeDoubleMinutes: 0,
      overtimeTripleMinutes: 0,
      overtimeWeeklyAccumulated: weeklyAccumulatedMinutes,
      overtimeWeeklyTotal: weeklyAccumulatedMinutes,
      isLate: false,
      isEarlyLeave: false,
      status: record.status,
    };
  }

  const workedMinutes = minutesBetween(record.checkInTime, record.checkOutTime);

  // Descontar tiempo de descanso
  let netWorkedMinutes = workedMinutes;
  if (record.mealStart && record.mealEnd) {
    netWorkedMinutes -= minutesBetween(record.mealStart, record.mealEnd);
  }
  if (record.restStart && record.restEnd) {
    netWorkedMinutes -= minutesBetween(record.restStart, record.restEnd);
  }
  netWorkedMinutes = Math.max(0, netWorkedMinutes);

  // Calcular minutos programados según el horario
  let scheduledMinutes = 0;
  let isLate = false;
  let isEarlyLeave = false;

  if (schedule && !schedule.isWeeklyRest) {
    const dow = getDayOfWeek(record.date);
    if (schedule.dayOfWeek === dow) {
      const [sh, sm] = schedule.startTime.split(':').map(Number);
      const [eh, em] = schedule.endTime.split(':').map(Number);
      scheduledMinutes = (eh * 60 + em) - (sh * 60 + sm);
      if (scheduledMinutes < 0) scheduledMinutes += 24 * 60; // turno nocturno

      // Late check (check-in)
      const tolMs = schedule.toleranceMinutes * 60_000;
      const expectedCheckIn = new Date(record.date);
      expectedCheckIn.setHours(sh, sm, 0, 0);
      if (record.checkInTime.getTime() > expectedCheckIn.getTime() + tolMs) {
        isLate = true;
      }

      // Early leave check (check-out)
      const expectedCheckOut = new Date(record.date);
      expectedCheckOut.setHours(eh, em, 0, 0);
      if (record.checkOutTime.getTime() < expectedCheckOut.getTime() - tolMs) {
        isEarlyLeave = true;
      }
    }
  }

  // fix #2 — Overtime con tolerancia de salida
  const checkoutTol = sucursal.checkoutToleranceMinutes || 0;
  const overtimeMinutes = Math.max(0, netWorkedMinutes - scheduledMinutes - checkoutTol);

  // --- Reforma LFT 2027 — Doble vs Triple ---
  // Tope diario: 4h (art. 66). El excedente diario no cuenta como extra autorizada.
  const overtimeDaily = Math.min(overtimeMinutes, DAILY_OVERTIME_CAP_MINUTES);

  // Tope semanal gradual (Transitorio Cuarto)
  const weeklyCap = getWeeklyOvertimeCapMinutes(new Date(record.date).getFullYear());
  const cabeEnDoble = Math.max(0, weeklyCap - weeklyAccumulatedMinutes);
  const overtimeDoubleMinutes = Math.min(overtimeDaily, cabeEnDoble);
  const overtimeTripleMinutes = Math.max(0, overtimeDaily - overtimeDoubleMinutes);
  const overtimeWeeklyTotal = weeklyAccumulatedMinutes + overtimeDaily;

  // Estado final
  let status: 'PRESENT' | 'LATE' | 'EARLY_LEAVE' | 'ABSENT' = 'PRESENT';
  if (isLate && isEarlyLeave) {
    status = 'LATE'; // prioridad al retardo
  } else if (isLate) {
    status = 'LATE';
  } else if (isEarlyLeave) {
    status = 'EARLY_LEAVE';
  }

  return {
    workedMinutes: netWorkedMinutes,
    overtimeMinutes,
    overtimeHours: +(overtimeMinutes / 60).toFixed(2),
    overtimeDoubleMinutes,
    overtimeTripleMinutes,
    overtimeWeeklyAccumulated: weeklyAccumulatedMinutes,
    overtimeWeeklyTotal,
    isLate,
    isEarlyLeave,
    status,
  };
}

/**
 * Encuentra el schedule correspondiente al día de la semana del record.
 */
export function findScheduleForDate(
  schedules: WorkSchedule[],
  date: Date
): WorkSchedule | null {
  const dow = getDayOfWeek(date);
  return schedules.find((s) => s.dayOfWeek === dow && !s.isWeeklyRest) || null;
}

/**
 * Calcula el acumulado semanal de minutos extra previos al día del record.
 * Semana = lunes a domingo (Convención ISO, México).
 *
 * @param employeeId - ID del empleado
 * @param recordDate - fecha del registro actual
 * @param fetchRecords - función que retorna los AttendanceRecords en un rango
 */
export async function computeWeeklyAccumulatedOvertime(
  employeeId: string,
  recordDate: Date,
  fetchRecords: (employeeId: string, from: Date, to: Date) => Promise<AttendanceRecord[]>
): Promise<number> {
  const dow = getDayOfWeek(recordDate); // 0=domingo..6=sábado
  // Lunes de esa semana
  const monday = new Date(recordDate);
  monday.setHours(0, 0, 0, 0);
  // Si hoy es lunes (dow=1), monday = hoy. Si es martes (dow=2), restamos 1 día. etc.
  const daysFromMonday = (dow + 6) % 7; // lun=0, mar=1, mié=2, jue=3, vie=4, sáb=5, dom=6
  monday.setDate(monday.getDate() - daysFromMonday);

  // Fin del día anterior al recordDate (no incluimos el día actual)
  const endYesterday = new Date(recordDate);
  endYesterday.setHours(0, 0, 0, 0);
  endYesterday.setMilliseconds(-1);

  const prevRecords = await fetchRecords(employeeId, monday, endYesterday);
  return prevRecords.reduce((sum, r) => sum + (r.overtimeDoubleMinutes || 0) + (r.overtimeTripleMinutes || 0), 0);
}
