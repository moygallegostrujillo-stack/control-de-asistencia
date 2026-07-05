// ============================================================
// src/lib/work-schedule.ts
//   Validación compartida de horarios semanales (WorkSchedule).
//   Usado por /api/employees (POST) y /api/employees/[id] (PUT)
//   para evitar duplicación de lógica legal.
//
//   Cumple con:
//     - art. 71 LFT: mínimo 1 día de descanso semanal.
//     - Reforma LFT 2027 (art. 132 XXXIV): registro electrónico
//       de asistencia con horario definido por empleado.
// ============================================================

export interface ScheduleInput {
  dayOfWeek: number; // 0=Domingo ... 6=Sábado
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  toleranceMinutes?: number;
  isWeeklyRest?: boolean;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Valida un conjunto de horarios semanales.
 *
 * Reglas:
 *  1. Debe contener al menos 1 entrada (no se permite horario vacío).
 *  2. Debe incluir al menos 1 día de descanso semanal (art. 71 LFT).
 *  3. Los días laborales deben tener hora de entrada y salida válidas (HH:mm).
 *  4. dayOfWeek debe estar entre 0 y 6.
 *  5. No debe haber días duplicados.
 *
 * @returns `null` si OK, o un mensaje de error en español si no cumple.
 */
export function validateWorkSchedules(schedules: unknown): string | null {
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
    }
  }

  return null;
}
