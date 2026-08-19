// ============================================================
// OVERTIME CALCULATOR — fix #3/#4 + Reforma LFT 2027 (art. 66/68) + Prima art. 73
// fix #3 (bug tolerancia): la tolerancia de salida NO se resta del overtime.
//   - checkoutToleranceMinutes solo determina isEarlyLeave (salida anticipada),
//     no reduce las horas extra devengadas. Ver bug report "Alicia".
// fix #4 (bug comida/jornada): la jornada de 8h INCLUYE el descanso de 30min
//   (LFT arts. 58/60/63, jurisprudencia SCJN). Por lo tanto:
//   - scheduledMinutes = rawScheduledMinutes (sin descontar comida). El schedule
//     representa la jornada TOTAL incluyendo el descanso.
//   - overtimeMinutes = max(0, workedMinutes - scheduledMinutes), donde
//     workedMinutes es el tiempo BRUTO en sitio (checkIn→checkOut, sin restar
//     comida). La comida ya está incluida en ambas variables.
//   - El fix #3 que descontaba mealDurationMinutes del schedule queda OBSOLETO
//     y fue removido. scheduledMinutes ahora es siempre rawScheduledMinutes.
// Distingue horas extra DOBLES (art. 66) de TRIPLES (art. 68).
// Tope semanal: 9h FIJO (art. 66 LFT, NO se ve afectado por la reducción
//   gradual de la jornada ordinaria del Transitorio Cuarto del DOF 27-dic-2024).
// Tope diario: 4h extra (art. 66).
// Prima por descanso trabajado (art. 73 LFT): jornada completa con prima del 100%.
//
// RT-P0.2 (14-ago-2026): Corregido `getWeeklyOvertimeCapMinutes` a retorno
//   fijo `9 * 60` para todos los años. La reforma DOF 27-dic-2024 reduce la
//   jornada ORDINARIA semanal (48→46→44→42→40h), NO el tope de horas extra
//   del art. 66 LFT, que permanece fijo en 9h semanales.
// fix #4 (20-ago-2026): jornada incluye comida. Overtime = tiempo bruto en
//   sitio - schedule. No se descuenta comida de ningún lado para overtime.
// ============================================================

import type { AttendanceRecord, Sucursal, WorkSchedule } from '@prisma/client';
import { DateTime } from 'luxon';
import {
  MEXICO_TZ,
  buildDateTimeInMexico,
  getDayOfWeek,
  minutesBetween,
  toISODate,
} from './timezone';
import { classifyShift, getLegalMaxMinutes, type ShiftType } from './shift-classifier';

export interface OvertimeInput {
  record: AttendanceRecord;
  schedule: WorkSchedule | null;
  sucursal: Pick<Sucursal, 'checkoutToleranceMinutes' | 'mealDurationMinutes'>;
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
 * Devuelve el tope semanal de horas extra (en minutos).
 *
 * RT-P0.2 (auditoría 14-ago-2026): CORREGIDO.
 *
 * El art. 66 LFT establece un tope semanal FIJO de 9 horas extra.
 * La reforma DOF 27-dic-2024 NO modifica el art. 66 — solo reduce la jornada
 * ORDINARIA semanal del art. 61 (48→46→44→42→40h entre 2026 y 2030).
 *
 * La versión anterior escalaba erróneamente el tope de overtime a 10/11/12h
 * en 2028/2029/2030, interpretando incorrectamente que la reducción de la
 * jornada ordinaria "liberaba" espacio para más overtime. Eso NO está en la
 * ley y hubiera causado sub-pago de triples a partir de 2028.
 *
 * @param _year - Año (ignorado; el tope es fijo para todos los años).
 * @returns 540 minutos (9 horas × 60) — art. 66 LFT.
 */
export function getWeeklyOvertimeCapMinutes(_year?: number): number {
  return 9 * 60; // art. 66 LFT — tope semanal fijo de 9 horas.
}

/** Tope diario de horas extra (art. 66 LFT) — 4 horas = 240 minutos. */
export const DAILY_OVERTIME_CAP_MINUTES = 4 * 60;

/**
 * Calcula horas trabajadas, horas extra, distinción dobles/triples (reforma
 * LFT 2027) y estado (PRESENT/LATE/EARLY_LEAVE).
 *
 * Si la fecha del registro es día de descanso semanal del empleado, NO se calcula
 * overtime (art. 66/68); en su lugar, la jornada completa se paga con prima del 100%
 * (art. 73 LFT). El descanso trabajado NO es tiempo extra, es jornada ordinaria
 * con recargo del 100%.
 *
 * Fórmula overtime (fix #3 + fix #4):
 *   overtimeMinutes = max(0, workedMinutes - scheduledMinutes)
 *   - workedMinutes = tiempo BRUTO en sitio (checkIn→checkOut, sin restar comida).
 *   - scheduledMinutes = rawScheduledMinutes (tiempo total del schedule).
 *
 *   La tolerancia de salida (checkoutToleranceMinutes) solo determina isEarlyLeave;
 *   NO se resta del overtime devengado (fix #3).
 *
 *   La comida/descanso NO se descuenta del overtime (fix #4) porque la jornada
 *   de 8h INCLUYE el descanso de 30min (LFT arts. 58/60/63, jurisprudencia SCJN).
 *   Antes (fix #3) se descontaba mealDurationMinutes del schedule cuando
 *   rawScheduledMinutes > 480, lo cual era incorrecto porque el schedule YA
 *   representa la jornada total incluyendo comida.
 *
 *   Nota: netWorkedMinutes (tiempo efectivo, después de descontar comida) sigue
 *   usándose para MOSTRAR las horas trabajadas netas en la UI, pero NO para
 *   el cálculo de pago de horas extra.
 *
 * Distribución dobles/triples (reforma LFT 2027):
 *   - Tope diario: 4h (DAILY_OVERTIME_CAP_MINUTES)
 *   - Tope semanal (FIJO per art. 66 LFT): 9h = 540 min (no escala con el año)
 *   - overtimeDaily = min(overtimeMinutes, 240)
 *   - weeklyBefore = weeklyAccumulatedMinutes (días previos de la misma semana)
 *   - cabeEnDoble = max(0, capSemanal - weeklyBefore)
 *   - overtimeDoubleMinutes = min(overtimeDaily, cabeEnDoble)
 *   - overtimeTripleMinutes = overtimeDaily - overtimeDoubleMinutes
 *   - El excedente sobre el tope diario no se paga como extra ese día
 *     (es jornada no autorizada, se reporta pero no se acumula).
 */

/**
 * Interfaz de entrada para calculateOvertime.
 *
 * RT-P0.3 (auditoría 14-ago-2026): añadido `isRestDayWorkedExplicit`.
 * El caller (check-out) debe determinar explícitamente si la fecha es día de
 * descanso semanal del empleado usando `findRestScheduleForDate`, y pasarlo
 * como input. Esto evita el bug donde `schedule === null` (día no programado,
 * no descanso) activaba incorrectamente la prima del 100% del art. 73 LFT.
 */
export interface OvertimeInput {
  record: AttendanceRecord;
  schedule: WorkSchedule | null;
  sucursal: Pick<Sucursal, 'checkoutToleranceMinutes' | 'mealDurationMinutes'>;
  /** Minutos extra ya acumulados en la semana (excluyendo el día actual). */
  weeklyAccumulatedMinutes?: number;
  /**
   * RT-P0.3: Indica explícitamente si la fecha del registro es día de descanso
   * semanal del empleado (WorkSchedule.isWeeklyRest=true para ese día).
   * Si es `true`, se aplica la prima del 100% del art. 73 LFT.
   * Si es `false` o `undefined`, se cae al comportamiento legacy (inferir de
   * `schedule === null`), que se mantiene por compatibilidad con callers
   * que no hayan sido actualizados aún.
   */
  isRestDayWorkedExplicit?: boolean;
}
export function calculateOvertime(input: OvertimeInput): OvertimeResult {
  const { record, schedule, sucursal, weeklyAccumulatedMinutes = 0, isRestDayWorkedExplicit } = input;

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
  //
  // RT-P0.3 (auditoría 14-ago-2026): CORREGIDO.
  // Antes se infería `isRestDayWorked = schedule === null || schedule?.isWeeklyRest`,
  // lo que activaba incorrectamente la prima del 100% del art. 73 LFT cuando
  // `schedule === null` porque el día no estaba configurado (no era descanso).
  //
  // Ahora se prefiere el input explícito `isRestDayWorkedExplicit` pasado por
  // el caller (que usa `findRestScheduleForDate`). Si no viene, se cae al
  // comportamiento legacy por compatibilidad con callers no actualizados
  // (recalc-overtime ya usa `findRestScheduleForDate` correctamente).
  const dow = getDayOfWeek(record.date);
  const isSunday = dow === 0;
  const isRestDayWorked =
    isRestDayWorkedExplicit !== undefined
      ? isRestDayWorkedExplicit
      : schedule === null || (schedule?.isWeeklyRest === true);

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
      const rawScheduledMinutes = (eh * 60 + em) - (sh * 60 + sm);
      // ----------------------------------------------------------
      // fix #4 (20-ago-2026): la jornada INCLUYE la comida (LFT art. 58/60/63).
      // El schedule representa el tiempo TOTAL que el empleado debe estar
      // a disposición del patrón. La comida/descanso ya está dentro.
      // Por lo tanto, scheduledMinutes = rawScheduledMinutes SIN descontar comida.
      //
      // El fix #3 anterior que descontaba mealDurationMinutes del schedule
      // fue REMOVIDO porque partía de la premisa incorrecta de que la jornada
      // de 8h NO incluía la comida.
      // ----------------------------------------------------------
      scheduledMinutes = rawScheduledMinutes;
      if (scheduledMinutes < 0) scheduledMinutes += 24 * 60; // turno nocturno

      // ----------------------------------------------------------
      // FIX CRÍTICO DE ZONA HORARIA (bug de retardos falsos)
      // ----------------------------------------------------------
      // Antes se usaba `new Date(record.date).setHours(sh, sm, 0, 0)`,
      // que interpreta la hora en la TZ DEL SERVIDOR. En Vercel el
      // servidor corre en UTC, por lo que "09:00" se interpretaba como
      // 09:00 UTC (= 03:00 Mexico City). Como el check-in real ocurre
      // a las 09:00 Mexico (= 15:00 UTC), la comparación
      //   checkInTime(15:00 UTC) > expected(09:00 UTC) + tol
      // SIEMPRE daba true → todos los registros con salida quedaban
      // marcados como LATE, ignorando la tolerancia configurada.
      //
      // Solución: construir las fechas con buildDateTimeInMexico, que
      // interpreta "HH:mm" en America/Mexico_City (UTC-6) y devuelve
      // el instante UTC correcto. Esto coincide con la lógica que ya
      // usaba correctamente la ruta /api/attendance/check-in.
      // ----------------------------------------------------------
      const dateISO = toISODate(record.date);
      const tolMs = schedule.toleranceMinutes * 60_000;

      // Late check (check-in) — hora esperada en Mexico City
      const expectedCheckIn = buildDateTimeInMexico(dateISO, schedule.startTime);
      if (record.checkInTime.getTime() > expectedCheckIn.getTime() + tolMs) {
        isLate = true;
      }

      // Early leave check (check-out) — hora esperada en Mexico City.
      // Para turnos nocturnos (endTime <= startTime), la salida es
      // al día siguiente.
      let checkoutISO = dateISO;
      if (eh * 60 + em <= sh * 60 + sm) {
        const nextDay = DateTime.fromFormat(dateISO, 'yyyy-MM-dd', {
          zone: MEXICO_TZ,
        }).plus({ days: 1 });
        checkoutISO = nextDay.toFormat('yyyy-MM-dd');
      }
      const expectedCheckOut = buildDateTimeInMexico(checkoutISO, schedule.endTime);
      if (record.checkOutTime.getTime() < expectedCheckOut.getTime() - tolMs) {
        isEarlyLeave = true;
      }
    }
  }

  // fix #3 — bug tolerancia: la tolerancia de salida (checkoutToleranceMinutes)
  // solo determina isEarlyLeave; NO se resta del overtime devengado.
  // fix #4 — jornada incluye comida: se usa workedMinutes (tiempo bruto en
  // sitio, sin descontar comida) porque el schedule YA incluye la comida.
  // Antes se usaba netWorkedMinutes, que penalizaba al empleado que registraba
  // su comida al restarle esos minutos del overtime causado.
  const overtimeMinutes = Math.max(0, workedMinutes - scheduledMinutes);

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
  // fix #4: se usa workedMinutes (bruto) porque la jornada incluye comida.
  const legalOvertimeMinutes = Math.max(0, workedMinutes - legalMaxMinutes);

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

