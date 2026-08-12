// ============================================================
// Helpers compartidos para reportes — Control de Asistencia
// ------------------------------------------------------------
// Centraliza la validación de rangos de fechas para que todos
// los endpoints de reportes usen las mismas reglas y mensajes.
//
// Decisiones de diseño (confirmadas con el usuario):
//   • SIN tope máximo de rango — el usuario confía en que no
//     se abusará. Los reportes pueden cubrir cualquier rango.
//   • effectiveEnd = min(endDate, today) para reportes que
//     no deben contar días futuros (ausencias, incidencias,
//     comparativa). Para reportes históricos puros (horas
//     extra, export, daily) se permite endDate futura.
//   • Formato de fecha SIEMPRE "YYYY-MM-DD".
//   • Las fechas se interpretan como medianoche en hora de
//     México (America/Mexico_City) — nunca como UTC midnight
//     (que causaría el bug de desfase -1 día).
// ============================================================

import { NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { MEXICO_TZ, getMexicoTodayISO, buildDateTimeInMexico } from './timezone';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface DateRange {
  start: Date; // instante UTC = 00:00 hora México del startDate
  end: Date;   // instante UTC = 23:59:59.999 hora México del endDate
  startISO: string;
  endISO: string;
}

/**
 * Valida y parsea un rango de fechas "YYYY-MM-DD".
 * NO impone tope máximo de días (decisión del usuario).
 * Devuelve null + crea un NextResponse 400 si hay error.
 *
 * Uso típico:
 *   const range = parseDateRange(startDateStr, endDateStr);
 *   if (!range) return errorResponse!;
 *   // usar range.start, range.end, range.startISO, range.endISO
 */
export function parseDateRange(
  startDateStr: string | null | undefined,
  endDateStr: string | null | undefined
): { range: DateRange | null; errorResponse: NextResponse | null } {
  const startISO = startDateStr || getMexicoTodayISO();
  const endISO = endDateStr || startISO;

  if (!ISO_DATE_REGEX.test(startISO) || !ISO_DATE_REGEX.test(endISO)) {
    return {
      range: null,
      errorResponse: NextResponse.json(
        { error: 'Fechas inválidas (use formato YYYY-MM-DD)' },
        { status: 400 }
      ),
    };
  }

  // Construir como medianoche hora México → UTC (fix #10 de TZ).
  let start: Date;
  let end: Date;
  try {
    start = buildDateTimeInMexico(startISO, '00:00');
    end = buildDateTimeInMexico(endISO, '23:59');
  } catch {
    return {
      range: null,
      errorResponse: NextResponse.json(
        { error: 'Fechas inválidas (use formato YYYY-MM-DD)' },
        { status: 400 }
      ),
    };
  }

  if (start > end) {
    return {
      range: null,
      errorResponse: NextResponse.json(
        { error: 'La fecha de inicio no puede ser posterior a la de fin' },
        { status: 400 }
      ),
    };
  }

  return { range: { start, end, startISO, endISO }, errorResponse: null };
}

/**
 * Para reportes que NO deben contar días futuros (ausencias,
 * incidencias, comparativa). Recorta el end a "hoy" si el rango
 * se extiende al futuro.
 *
 * Devuelve un nuevo objeto Date (no muta el original).
 */
export function getEffectiveEnd(end: Date): Date {
  const todayLx = DateTime.now().setZone(MEXICO_TZ).endOf('day');
  const todayUtc = todayLx.toUTC().toJSDate();
  return end > todayUtc ? todayUtc : end;
}

/**
 * Construye un objeto `period` estandarizado para incluir en
 * las respuestas JSON de los reportes.
 *   { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' }
 */
export function buildPeriodResponse(range: DateRange): { start: string; end: string } {
  return { start: range.startISO, end: range.endISO };
}

/**
 * Construye un objeto `period` estandarizado cuando el end
 * efectivo es distinto al solicitado (ej. ausencias recortadas
 * a "hoy"). Se usa para que la UI sepa qué rango real se evaluó.
 */
export function buildPeriodResponseEffective(
  range: DateRange,
  effectiveEnd: Date
): { start: string; end: string; requestedEnd: string } {
  const effectiveEndISO = DateTime.fromJSDate(effectiveEnd)
    .setZone(MEXICO_TZ)
    .toFormat('yyyy-MM-dd');
  return {
    start: range.startISO,
    end: effectiveEndISO,
    requestedEnd: range.endISO,
  };
}
