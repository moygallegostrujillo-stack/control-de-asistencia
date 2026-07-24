// ============================================================
// OVERTIME CALCULATOR — fix #2 + Reforma LFT 2027 (art. 66/68) + Prima art. 73
// Aplica checkoutToleranceMinutes antes de contar horas extra.
// Distingue horas extra DOBLES (art. 66) de TRIPLES (art. 68).
// Tope semanal gradual: 9h (2026-27) → 10h (2028) → 11h (2029) → 12h (2030).
// Tope diario: 4h extra (art. 66).
// Prima por descanso trabajado (art. 73 LFT): jornada completa con prima del 100%.
// ============================================================

import type { AttendanceRecord, Sucursal, WorkSchedule } from '@prisma/client';
import { getDayOfWeek, minutesBetween, toISODate } from './timezone';
import { classifyShift, getLegalMaxMinutes, type ShiftType } from './shift-classifier';

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
  // --- Prima por descanso trabajado (art. 73 LFT) ---
  isRestDayWorked: boolean; // true si la fecha es día de descanso semanal del empleado
  restDayWorkedMinutes: number; // minutos trabajados en descanso (jornada completa, no overtime)
  restDayPremiumMinutes: number; // prima del 100% adicional = restDayWorkedMinutes
  isSunday: boolean; // true si la fecha cae en domingo (art. 71 LFT, prima dominical opcional)
  // --- Jornada nocturna / mixta (art. 60 y 61 LFT) ---
  shiftType: ShiftType; // 'DIURNA' | 'NOCTURNA' | 'MIXTA' (art. 60 LFT)
  nightMinutes: number; // minutos trabajados en horario nocturno (20:00-06:00)
  legalMaxMinutes: number; // jornada máxima legal según shiftType (art. 61 LFT): 480/420/450
  legalOvertimeMinutes: number; // excedente sobre la jornada máxima legal (para nómina/prima nocturna)
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
 * Si la fecha del registro es día de descanso semanal del empleado, NO se calcula
 * overtime (art. 66/68); en su lugar, la jornada completa se paga con prima del 100%
 * (art. 73 LFT). El descanso trabajado NO es tiempo extra, es jornada ordinaria
 * con recargo del 100%.
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
      status: (record.status as 'PRESENT' | 'ABSENT' | 'LATE' | 'EARLY_LEAVE'),
      isRestDayWorked: false,
      restDayWorkedMinutes: 0,
      restDayPremiumMinutes: 0,
      isSunday: getDayOfWeek(record.date) === 0,
      // Jornada nocturna/mixta (art. 60/61) — sin check-out no se puede clasificar.
      shiftType: 'DIURNA',
      nightMinutes: 0,
      legalMaxMinutes: getLegalMaxMinutes('DIURNA'),
      legalOvertimeMinutes: 0,
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

  // Detectar si la fecha es día de descanso semanal del empleado.
  // Si schedule es null porque hoy es descanso (isWeeklyRest=true), es descanso trabajado.
  const dow = getDayOfWeek(record.date);
  const isSunday = dow === 0;
  // Si el schedule pasado es el de descanso (isWeeklyRest=true), marcamos isRestDayWorked=true.
  // Si schedule es null, asumimos descanso solo si existe un WorkSchedule con isWeeklyRest para este dow.
  const isRestDayWorked = schedule === null || (schedule?.isWeeklyRest === true);

  // Caso especial: día de descanso trabajado (art. 73 LFT).
  // La jornada completa se paga con prima del 100% (NO es overtime art. 66/68).
  if (isRestDayWorked) {
    // Clasificar jornada también en descanso trabajado (para prima nocturna si aplica).
    const { shiftType, nightMinutes } = classifyShift(record.checkInTime, record.checkOutTime);
    return {
      workedMinutes: netWorkedMinutes,
      overtimeMinutes: 0,
      overtimeHours: 0,
      overtimeDoubleMinutes: 0,
      overtimeTripleMinutes: 0,
      overtimeWeeklyAccumulated: weeklyAccumulatedMinutes,
      overtimeWeeklyTotal: weeklyAccumulatedMinutes, // el descanso no suma al tope semanal de overtime
      isLate: false,
      isEarlyLeave: false,
      status: 'PRESENT',
      isRestDayWorked: true,
      restDayWorkedMinutes: netWorkedMinutes,
      restDayPremiumMinutes: netWorkedMinutes, // prima del 100% = misma cantidad de minutos adicionales
      isSunday,
      // Jornada nocturna/mixta (art. 60/61) — se registra para prima nocturna.
      shiftType,
      nightMinutes,
      legalMaxMinutes: getLegalMaxMinutes(shiftType),
      // En descanso trabajado, el excedente sobre la jornada legal se reporta
      // pero no se paga como overtime art. 66/68 (se paga con prima del 100% art. 73).
      legalOvertimeMinutes: Math.max(0, netWorkedMinutes - getLegalMaxMinutes(shiftType)),
    };
  }

  // Calcular minutos programados según el horario
  let scheduledMinutes = 0;
  let isLate = false;
  let isEarlyLeave = false;

  if (schedule && !schedule.isWeeklyRest) {
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

  // --- Jornada nocturna / mixta (art. 60 y 61 LFT) ---
  // Clasificar la jornada según los minutos en horario nocturno (20:00-06:00).
  // El límite legal cambia según el tipo: DIURNA=8h, NOCTURNA=7h, MIXTA=7.5h.
  const { shiftType, nightMinutes } = classifyShift(record.checkInTime, record.checkOutTime);
  const legalMaxMinutes = getLegalMaxMinutes(shiftType);
  // Excedente sobre la jornada máxima legal. Esto NO reemplaza al overtime
  // basado en scheduledMinutes (que sigue siendo el umbral contractual), sino
  // que es una referencia adicional para nómina y para prima nocturna.
  const legalOvertimeMinutes = Math.max(0, netWorkedMinutes - legalMaxMinutes);

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
    isRestDayWorked: false,
    restDayWorkedMinutes: 0,
    restDayPremiumMinutes: 0,
    isSunday,
    // Jornada nocturna/mixta (art. 60/61 LFT)
    shiftType,
    nightMinutes,
    legalMaxMinutes,
    legalOvertimeMinutes,
  };
}

/**
 * Encuentra el schedule correspondiente al día de la semana del record (día laboral).
 * Excluye días marcados como descanso semanal (isWeeklyRest=true).
 */
export function findScheduleForDate(
  schedules: WorkSchedule[],
  date: Date
): WorkSchedule | null {
  const dow = getDayOfWeek(date);
  return schedules.find((s) => s.dayOfWeek === dow && !s.isWeeklyRest) || null;
}

/**
 * Encuentra el schedule de descanso semanal correspondiente al día de la semana.
 * Retorna el WorkSchedule con isWeeklyRest=true si existe para ese dow, o null.
 */
export function findRestScheduleForDate(
  schedules: WorkSchedule[],
  date: Date
): WorkSchedule | null {
  const dow = getDayOfWeek(date);
  return schedules.find((s) => s.dayOfWeek === dow && s.isWeeklyRest) || null;
}

/**
 * Indica si una fecha es día de descanso semanal del empleado.
 * Útil para check-in y reportes.
 */
export function isRestDay(schedules: WorkSchedule[], date: Date): boolean {
  return findRestScheduleForDate(schedules, date) !== null;
}

/**
 * Calcula el acumulado semanal de minutos extra previos al día del record.
 * Semana = lunes a domingo (Convención ISO, México).
 *
 * Nota: los minutos trabajados en día de descanso NO se acumulan como overtime
 * (art. 73 LFT es prima independiente del art. 66/68).
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

// toISODate re-exportado para compatibilidad con código existente
export { toISODate };

