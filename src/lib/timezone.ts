// Mexico City timezone utility - ensures all date calculations use America/Mexico_City
// This is critical for NOM-037 compliance where records must match the local workday

export const MEXICO_TZ = 'America/Mexico_City';

/**
 * Get today's date string in Mexico City timezone (yyyy-MM-dd)
 * This MUST be used instead of format(new Date(), 'yyyy-MM-dd') for all attendance records
 */
export function getMexicoTodayDate(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: MEXICO_TZ });
}

/**
 * Get current Date object adjusted to Mexico City timezone context
 * Returns a Date that, when formatted with date-fns format(), gives Mexico local time
 */
export function getMexicoNow(): Date {
  const now = new Date();
  const mexicoStr = now.toLocaleString('en-US', { timeZone: MEXICO_TZ });
  return new Date(mexicoStr);
}

/**
 * Get Mexico City timezone offset from UTC in hours
 */
export function getMexicoOffset(): number {
  const now = new Date();
  const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const mexicoDate = new Date(now.toLocaleString('en-US', { timeZone: MEXICO_TZ }));
  return (mexicoDate.getTime() - utcDate.getTime()) / (1000 * 60 * 60);
}

/**
 * Build a date range filter for "today" that works regardless of column type.
 * The Supabase `date` column may store values as plain text ("2026-06-08")
 * or as timestamptz ("2026-06-08T12:00:00.000Z"). Using gte/lt with date-only
 * strings ensures both formats are captured correctly.
 *
 * Returns { gte: "<today>", lt: "<tomorrow>" } (date-only strings)
 */
export function buildTodayDateRange(): { gte: string; lt: string } {
  const today = getMexicoTodayDate();
  // Compute tomorrow in Mexico timezone
  const now = new Date();
  const tomorrowMs = now.getTime() + 24 * 60 * 60 * 1000;
  const tomorrowDate = new Date(tomorrowMs).toLocaleDateString('sv-SE', { timeZone: MEXICO_TZ });
  return {
    gte: today,
    lt: tomorrowDate,
  };
}

/**
 * Build a date range filter for an arbitrary date string (yyyy-MM-dd).
 * Same idea as buildTodayDateRange but for any date.
 */
export function buildDateRange(dateStr: string): { gte: string; lt: string } {
  // Compute next day
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  const nextDay = d.toISOString().slice(0, 10);
  return {
    gte: dateStr,
    lt: nextDay,
  };
}

/**
 * Convert an inclusive end date (lte) to an exclusive end date (lt) by adding one day.
 * This is needed because Supabase timestamptz columns with `lte '2026-06-08'` 
 * don't match records with time components like '2026-06-08T12:00:00Z'.
 * Using `lt '2026-06-09'` instead captures the entire day.
 */
export function endDateToExclusive(endDate: string): string {
  const d = new Date(endDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
