// ============================================================
// src/lib/work-schedule.ts
//   Validación compartida de horarios semanales (WorkSchedule).
//   Usado por /api/employees (POST) y /api/employees/[id] (PUT)
//   para evitar duplicación de lógica legal.
//
//   Cumple con:
//     - art. 71 LFT: mínimo 1 día de descanso semanal.
//     - art. 61 LFT (reforma DOF 27-dic-2024): tope semanal de jornada
//       (48h 2026 → 46h 2027 → 44h 2028 → 42h 2029 → 40h 2030).
//     - Reforma LFT 2027 (art. 132 XXXIV): registro electrónico
//       de asistencia con horario definido por empleado.
//
//   RT-P0.1 (auditoría 14-ago-2026): añadida validación de tope semanal
//   consultando la tabla JornadaConfig. Antes el sistema permitía configurar
//   horarios semanales que violaban el art. 61 LFT (>48h en 2026, >46h en 2027).
// ============================================================

import { db } from './db';

export interface ScheduleInput {
  dayOfWeek: number; // 0=Domingo ... 6=Sábado
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  toleranceMinutes?: number;
  isWeeklyRest?: boolean;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Calcula los minutos totales de un día laboral a partir de startTime y endTime.
 * Si endTime <= startTime, se asume turno nocturno (cruza medianoche).
 *
 * @returns Minutos de jornada del día (0 si es día de descanso).
 */
function calculateDayMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60; // turno nocturno
  return minutes;
}

/**
 * Obtiene el tope de jornada semanal máxima para un año dado desde la
 * tabla JornadaConfig. Si no hay configuración para ese año, usa el tope
 * del año más reciente anterior, o 48h como fallback conservador.
 *
 * @param year - Año del que se quiere saber el tope.
 * @returns Tope semanal en horas (48 por defecto).
 */
export async function getMaxWeeklyHoursForYear(year: number): Promise<number> {
  // Buscar configuración exacta del año
  const exact = await db.jornadaConfig.findUnique({ where: { year } });
  if (exact) return exact.maxWeeklyHours;

  // Si no existe, buscar el año más reciente anterior (ej. 2031 → usa 2030)
  const fallback = await db.jornadaConfig.findFirst({
    where: { year: { lte: year } },
    orderBy: { year: 'desc' },
  });
  if (fallback) return fallback.maxWeeklyHours;

  // Si la tabla está vacía, usar 48h (tope más permisivo, pre-reforma).
  // Esto no debería ocurrir porque el seed crea los 5 registros 2026-2030.
  return 48;
}

/**
 * Valida un conjunto de horarios semanales.
 *
 * Reglas:
 *  1. Debe contener al menos 1 entrada (no se permite horario vacío).
 *  2. Debe incluir al menos 1 día de descanso semanal (art. 71 LFT).
 *  3. Los días laborales deben tener hora de entrada y salida válidas (HH:mm).
 *  4. dayOfWeek debe estar entre 0 y 6.
 *  5. No debe haber días duplicados.
 *  6. RT-P0.1: La suma de horas laborales no debe exceder el tope semanal
 *     del año en curso (art. 61 LFT, reforma DOF 27-dic-2024).
 *
 * @param schedules - Array de horarios a validar.
 * @param asOfDate - Fecha de referencia para determinar el tope del año (default: hoy).
 * @returns `null` si OK, o un mensaje de error en español si no cumple.
 */
export async function validateWorkSchedules(
  schedules: unknown,
  asOfDate: Date = new Date()
): Promise<string | null> {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return 'Debes asignar el horario semanal del empleado. Marca al menos un día de trabajo y un día de descanso.';
  }

  const arr = schedules as ScheduleInput[];

  // art. 71 LFT — mínimo 1 día de descanso semanal.
  const hasRest = arr.some((s) => s.isWeeklyRest === true);
  if (!hasRest) {
    return 'El horario debe incluir al menos 1 día de descanso semanal (art. 71 LFT). Marca un día como "Descanso".';
  }

  const seen = new Set<number>();
  let totalWeeklyMinutes = 0;
  let totalWorkedDays = 0;

  for (const s of arr) {
    if (typeof s.dayOfWeek !== 'number' || s.dayOfWeek < 0 || s.dayOfWeek > 6) {
      return `Día de la semana inválido: ${s.dayOfWeek} (debe ser 0-6).`;
    }
    if (seen.has(s.dayOfWeek)) {
      return `Hay días duplicados en el horario.`;
    }
    seen.add(s.dayOfWeek);

    if (!s.isWeeklyRest) {
      // Día laboral: requiere horas válidas.
      if (!s.startTime || !s.endTime) {
        return `Falta la hora de entrada o salida para un día laboral.`;
      }
      if (!TIME_RE.test(s.startTime) || !TIME_RE.test(s.endTime)) {
        return `Formato de hora inválido (usa HH:mm, 24h).`;
      }
      totalWeeklyMinutes += calculateDayMinutes(s.startTime, s.endTime);
      totalWorkedDays++;
    }
  }

  // RT-P0.1 (auditoría 14-ago-2026): validar tope semanal (art. 61 LFT).
  // Solo se valida si hay días laborales; si solo hay descansos (caso edge),
  // no hay tope que validar.
  if (totalWorkedDays > 0) {
    const year = asOfDate.getFullYear();
    const maxWeeklyHours = await getMaxWeeklyHoursForYear(year);
    const maxWeeklyMinutes = maxWeeklyHours * 60;
    if (totalWeeklyMinutes > maxWeeklyMinutes) {
      const totalHours = (totalWeeklyMinutes / 60).toFixed(1);
      return (
        `El horario excede el tope semanal de ${maxWeeklyHours}h establecido por el ` +
        `art. 61 LFT (reforma DOF 27-dic-2024, año ${year}). ` +
        `Total configurado: ${totalHours}h en ${totalWorkedDays} días laborales.`
      );
    }
  }

  return null;
}

