// ============================================================
// VACATION CALCULATOR — cálculo de días de vacaciones
//
// Fix (15-ago-2026): El cliente reportó que el sistema contaba
// días naturales (incluyendo domingos), pero la política de la
// empresa es contar días laborables (excluyendo domingos y días
// festivos oficiales art. 74 LFT).
//
// Este helper unifica el cálculo en un solo lugar y es usado por:
//   - POST /api/vacations           (crear)
//   - PATCH /api/vacations/[id]     (editar)
//   - POST /api/admin/recalc-vacations-holidays  (fix retroactivo)
//   - Frontend: GrantVacationDialog y EditVacationDialog (preview)
//
// LFT art. 71 — descanso semanal (domingo).
// LFT art. 74 — días festivos oficiales.
// ============================================================

import { DateTime } from 'luxon';
import { MEXICO_TZ, toISODate, getDayOfWeek } from './timezone';

/**
 * Días festivos oficiales de México conforme al art. 74 LFT.
 * Devuelve un Set de strings ISO "YYYY-MM-DD" para un año dado.
 *
 * Lista (art. 74 LFT):
 *   I.   1 de enero
 *   II.  Primer lunes de febrero (5 de febrero)
 *   III. Tercer lunes de marzo (21 de marzo)
 *   IV.  1 de mayo
 *   V.   16 de septiembre
 *   VI.  Tercer lunes de noviembre (20 de noviembre)
 *   VII. 1 de diciembre cada 6 años (transmisión Poder Ejecutivo: 2024, 2030...)
 *   VIII.25 de diciembre
 *
 * Nota: Las elecciones (fr. IX) no se incluyen porque varían por año y
 * entidad, y no aplican recursivamente al cálculo de vacaciones.
 */
export function getOfficialMexicanHolidays(year: number): Set<string> {
  const holidays = new Set<string>();

  // I. 1 de enero
  holidays.add(`${year}-01-01`);

  // II. Primer lunes de febrero
  holidays.add(firstMondayOfMonth(year, 2));

  // III. Tercer lunes de marzo
  holidays.add(nthMondayOfMonth(year, 3, 3));

  // IV. 1 de mayo
  holidays.add(`${year}-05-01`);

  // V. 16 de septiembre
  holidays.add(`${year}-09-16`);

  // VI. Tercer lunes de noviembre
  holidays.add(nthMondayOfMonth(year, 11, 3));

  // VII. 1 de diciembre cada 6 años (transmisión Poder Ejecutivo).
  // Secuencia: 1934, 1940, ..., 2000, 2006, 2012, 2018, 2024, 2030...
  // 2024 % 6 = 2, 2030 % 6 = 2, 2018 % 6 = 2 → year % 6 === 2
  if (year % 6 === 2) {
    holidays.add(`${year}-12-01`);
  }

  // VIII. 25 de diciembre
  holidays.add(`${year}-12-25`);

  return holidays;
}

/**
 * Devuelve el primer lunes de un mes/año dado, en formato "YYYY-MM-DD".
 */
function firstMondayOfMonth(year: number, month: number): string {
  return nthMondayOfMonth(year, month, 1);
}

/**
 * Devuelve el N-ésimo lunes de un mes/año dado (n=1 primer lunes, n=3 tercero).
 */
function nthMondayOfMonth(year: number, month: number, n: number): string {
  // Luxon: weekday=1 es lunes. Si day=8, weekday es el del 8vo día del mes.
  // Buscamos el primer día del mes y avanzamos hasta el primer lunes.
  const first = DateTime.fromObject({ year, month, day: 1 }, { zone: MEXICO_TZ });
  let monday = first;
  // weekday: 1=mon..7=sun (luxon)
  const offset = (1 - first.weekday + 7) % 7; // días hasta el primer lunes
  monday = first.plus({ days: offset });
  // Avanzar (n-1) semanas
  monday = monday.plus({ weeks: n - 1 });
  return monday.toFormat('yyyy-MM-dd');
}

/**
 * Interfaz para feriados extra (de la BD Holiday) que el backend puede pasar.
 */
export interface ExtraHoliday {
  date: Date;
}

/**
 * Calcula los días laborables de vacaciones en un rango [startDate, endDate],
 * excluyendo:
 *   - Domingos (día de descanso obligatorio, art. 71 LFT)
 *   - Días festivos oficiales (art. 74 LFT, calculados algorítmicamente)
 *   - Días festivos adicionales cargados en la BD (tabla Holiday, opcionales)
 *
 * El resultado es el número de días que se descuentan del saldo de vacaciones.
 *
 * @param startDate Fecha de inicio (inclusive)
 * @param endDate   Fecha de fin (inclusive)
 * @param extraHolidays Feriados extra de la BD (opcional). El backend los
 *                      carga con db.holiday.findMany; el frontend puede omitirlos.
 * @returns Número de días laborables (>= 0)
 */
export function computeVacationDays(
  startDate: Date,
  endDate: Date,
  extraHolidays?: ExtraHoliday[]
): number {
  if (!startDate || !endDate || endDate < startDate) {
    return 0;
  }

  // ---- Construir set de festivos (oficiales + BD) para todos los años del rango ----
  const holidaySet = new Set<string>();

  // Años que toca el rango (en zona Mexico)
  const startYear = DateTime.fromJSDate(startDate).setZone(MEXICO_TZ).year;
  const endYear = DateTime.fromJSDate(endDate).setZone(MEXICO_TZ).year;
  for (let y = startYear; y <= endYear; y++) {
    getOfficialMexicanHolidays(y).forEach((d) => holidaySet.add(d));
  }

  // Feriados extra de la BD (si los pasa el backend)
  if (extraHolidays && extraHolidays.length > 0) {
    for (const h of extraHolidays) {
      holidaySet.add(toISODate(h.date));
    }
  }

  // ---- Iterar día por día, contando los laborables ----
  let count = 0;
  const current = DateTime.fromJSDate(startDate).setZone(MEXICO_TZ).startOf('day');
  const end = DateTime.fromJSDate(endDate).setZone(MEXICO_TZ).startOf('day');

  let cursor = current;
  while (cursor <= end) {
    const iso = cursor.toFormat('yyyy-MM-dd');
    // getDayOfWeek: 0=domingo..6=sábado (igual que Date.getDay pero en Mexico TZ)
    const dow = cursor.weekday % 7; // luxon: 1=lunes..7=domingo → 0=domingo..6=sábado
    const isSunday = dow === 0;
    const isHoliday = holidaySet.has(iso);

    if (!isSunday && !isHoliday) {
      count++;
    }
    cursor = cursor.plus({ days: 1 });
  }

  return count;
}

/**
 * Versión ligera para el frontend: calcula días excluyendo domingos y
 * festivos oficiales (sin consultar la BD). El backend usa
 * `computeVacationDays` con `extraHolidays` para mayor precisión.
 *
 * El frontend puede usar este helper para mostrar un preview aproximado;
 * el valor almacenado lo calcula el backend.
 */
export function computeVacationDaysFrontend(
  startDate: Date,
  endDate: Date
): number {
  return computeVacationDays(startDate, endDate, undefined);
}

/**
 * Devuelve la lista de festivos oficiales (ISO strings) que caen dentro
 * de un rango dado. Útil para mostrar al usuario qué días se excluyeron.
 */
export function getHolidaysInRange(
  startDate: Date,
  endDate: Date,
  extraHolidays?: ExtraHoliday[]
): string[] {
  const holidaySet = new Set<string>();
  const startYear = DateTime.fromJSDate(startDate).setZone(MEXICO_TZ).year;
  const endYear = DateTime.fromJSDate(endDate).setZone(MEXICO_TZ).year;
  for (let y = startYear; y <= endYear; y++) {
    getOfficialMexicanHolidays(y).forEach((d) => holidaySet.add(d));
  }
  if (extraHolidays) {
    for (const h of extraHolidays) {
      holidaySet.add(toISODate(h.date));
    }
  }

  const inRange: string[] = [];
  const start = DateTime.fromJSDate(startDate).setZone(MEXICO_TZ).startOf('day');
  const end = DateTime.fromJSDate(endDate).setZone(MEXICO_TZ).startOf('day');
  let cursor = start;
  while (cursor <= end) {
    const iso = cursor.toFormat('yyyy-MM-dd');
    const dow = cursor.weekday % 7;
    if (dow === 0) {
      // domingo — lo incluimos en la lista de excluidos también
      inRange.push(iso + ' (domingo)');
    } else if (holidaySet.has(iso)) {
      inRange.push(iso + ' (festivo)');
    }
    cursor = cursor.plus({ days: 1 });
  }
  return inRange;
}
