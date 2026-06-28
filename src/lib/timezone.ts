// ============================================================
// Timezone utilities — America/Mexico_City
// Usa luxon para cálculos robustos de zona horaria
// ============================================================

import { DateTime } from 'luxon';

export const MEXICO_TZ = 'America/Mexico_City';

/** Devuelve el "ahora" en zona Mexico City como objeto DateTime de luxon */
export function getMexicoNow(): DateTime {
  return DateTime.now().setZone(MEXICO_TZ);
}

/** Devuelve el "ahora" como Date UTC correspondiente al momento actual */
export function getUtcNow(): Date {
  return new Date();
}

/**
 * Devuelve la fecha de hoy (sin hora) en zona Mexico City como Date.
 * Se usa para el campo `date` (Date @db.Date) de AttendanceRecord.
 */
export function getMexicoTodayDate(): Date {
  const now = getMexicoNow();
  // Devuelve un Date a medianoche en Mexico TZ (el @db.Date ignora la hora)
  return now.startOf('day').toJSDate();
}

/**
 * Devuelve la fecha de hoy en formato ISO "YYYY-MM-DD" en Mexico TZ.
 */
export function getMexicoTodayISO(): string {
  return getMexicoNow().toFormat('yyyy-MM-dd');
}

/**
 * Construye un Date (UTC) a partir de una fecha "YYYY-MM-DD" y hora "HH:mm"
 * interpretados como hora local de Mexico City. fix #10.
 */
export function buildDateTimeInMexico(dateISO: string, timeHHmm: string): Date {
  const dt = DateTime.fromFormat(
    `${dateISO} ${timeHHmm}`,
    'yyyy-MM-dd HH:mm',
    { zone: MEXICO_TZ }
  );
  if (!dt.isValid) {
    throw new Error(`Fecha/hora inválida: ${dateISO} ${timeHHmm} — ${dt.invalidReason}`);
  }
  return dt.toUTC().toJSDate();
}

/**
 * Formatea un Date (UTC) a "HH:mm" en zona Mexico City.
 */
export function formatTimeInMexico(date: Date | string | null | undefined): string {
  if (!date) return '--:--';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '--:--';
  return DateTime.fromJSDate(d).setZone(MEXICO_TZ).toFormat('HH:mm');
}

/**
 * Formatea un Date a "dd/MM/yyyy" en Mexico TZ.
 */
export function formatDateInMexico(date: Date | string | null | undefined): string {
  if (!date) return '--/--/----';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '--/--/----';
  return DateTime.fromJSDate(d).setZone(MEXICO_TZ).toFormat('dd/MM/yyyy');
}

/**
 * Formatea un Date a "dd/MM/yyyy HH:mm" en Mexico TZ.
 */
export function formatDateTimeInMexico(date: Date | string | null | undefined): string {
  if (!date) return '--/--/---- --:--';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '--/--/---- --:--';
  return DateTime.fromJSDate(d).setZone(MEXICO_TZ).toFormat('dd/MM/yyyy HH:mm');
}

/**
 * Devuelve el día de la semana (0=domingo..6=sábado) para una fecha Date.
 */
export function getDayOfWeek(date: Date): number {
  return DateTime.fromJSDate(date).setZone(MEXICO_TZ).weekday % 7; // luxon: 1=lunes..7=domingo
}

/**
 * Devuelve la fecha en formato ISO "YYYY-MM-DD" a partir de un Date.
 */
export function toISODate(date: Date): string {
  return DateTime.fromJSDate(date).setZone(MEXICO_TZ).toFormat('yyyy-MM-dd');
}

/**
 * Calcula los minutos entre dos Date (b - a), considerando que son momentos UTC.
 */
export function minutesBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

/**
 * Convierte minutos a horas decimales con 2 decimales.
 */
export function minutesToHours(minutes: number): number {
  return +(minutes / 60).toFixed(2);
}

/**
 * Formatea minutos como "Xh Ymin" o "Ymin".
 */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return '--';
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}
