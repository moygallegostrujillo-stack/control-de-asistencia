// ============================================================
// SHIFT CLASSIFIER — Art. 60 y 61 Ley Federal del Trabajo (México)
// ------------------------------------------------------------
// Clasifica la jornada de un empleado en DIURNA, NOCTURNA o MIXTA
// según los minutos trabajados en horario nocturno (20:00-06:00).
//
// Art. 60 LFT — tipos de jornada:
//   - DIURNA:   entre las 06:00 y las 20:00 horas
//   - NOCTURNA: entre las 20:00 y las 06:00 horas
//   - MIXTA:    combina períodos de ambas, siempre que el período
//               nocturno sea MENOR a 3.5 horas (210 min).
//               Si el período nocturno es ≥ 3.5 horas, se reputa
//               NOCTURNA (art. 60 párrafo final).
//
// Art. 61 LFT — jornada máxima diaria según el tipo:
//   - DIURNA:   8 horas (480 min)
//   - NOCTURNA: 7 horas (420 min)
//   - MIXTA:    7.5 horas (450 min)
//
// Prima nocturna (art. 61 + jurisprudencia): los trabajadores de
// jornada NOCTURNA o MIXTA tienen derecho a una prima adicional del
// 25% sobre el salario de las horas diurnas. El monto exacto lo
// calcula nómina; aquí solo dejamos registrado `nightMinutes` para
// que nómina pueda aplicarla después.
// ============================================================

/** Tipos de jornada según art. 60 LFT. */
export type ShiftType = 'DIURNA' | 'NOCTURNA' | 'MIXTA';

/** Umbral legal: 3.5 horas = 210 minutos. Si nightMinutes ≥ 210 → NOCTURNA. */
export const NIGHT_SHIFT_THRESHOLD_MINUTES = 210;

/** Inicio del horario nocturno (hora del día, 0-23). */
const NIGHT_START_HOUR = 20;
/** Fin del horario nocturno (hora del día, 0-23). */
const NIGHT_END_HOUR = 6;

/**
 * Calcula cuántos minutos del intervalo [checkIn, checkOut] caen
 * dentro del horario nocturno (20:00-06:00 cada día).
 *
 * Recorre cada día calendario que toca el intervalo y suma el
 * solapamiento con la ventana nocturna de ese día. Funciona
 * correctamente para turnos que cruzan medianoche y para
 * intervalos de varios días.
 *
 * @param checkIn  - Fecha/hora de entrada del empleado.
 * @param checkOut - Fecha/hora de salida del empleado.
 * @returns Minutos totales en horario nocturno (≥ 0).
 */
export function nightMinutesBetween(checkIn: Date, checkOut: Date): number {
  if (checkOut <= checkIn) return 0;

  let totalNightMinutes = 0;

  // Iterar por cada día calendario que toca el intervalo.
  // Para cada día, la ventana nocturna es [20:00 de ese día, 06:00 del día siguiente].
  const dayCursor = new Date(checkIn);
  dayCursor.setHours(0, 0, 0, 0); // inicio del día del check-in

  // Safety limit: máximo 7 días de iteración (turnos >7 días no son legales).
  for (let i = 0; i < 7 && dayCursor <= checkOut; i++) {
    const nightStart = new Date(dayCursor);
    nightStart.setHours(NIGHT_START_HOUR, 0, 0, 0); // 20:00 hoy

    const nightEnd = new Date(dayCursor);
    nightEnd.setDate(nightEnd.getDate() + 1);
    nightEnd.setHours(NIGHT_END_HOUR, 0, 0, 0); // 06:00 mañana

    // Solapamiento de [checkIn, checkOut] con [nightStart, nightEnd]
    const overlapStart = checkIn > nightStart ? checkIn : nightStart;
    const overlapEnd = checkOut < nightEnd ? checkOut : nightEnd;

    if (overlapEnd > overlapStart) {
      totalNightMinutes += Math.round(
        (overlapEnd.getTime() - overlapStart.getTime()) / 60_000
      );
    }

    // Avanzar al siguiente día.
    dayCursor.setDate(dayCursor.getDate() + 1);
  }

  return totalNightMinutes;
}

/**
 * Clasifica la jornada de un empleado según los arts. 60 y 61 LFT.
 *
 * Reglas:
 *   - nightMinutes === 0                  → DIURNA
 *   - nightMinutes >= 210 (3.5h)          → NOCTURNA (aunque tenga parte diurna)
 *   - 0 < nightMinutes < 210              → MIXTA
 *
 * @param checkIn  - Fecha/hora de entrada.
 * @param checkOut - Fecha/hora de salida.
 * @returns Objeto con `shiftType` y `nightMinutes`.
 */
export function classifyShift(
  checkIn: Date,
  checkOut: Date
): { shiftType: ShiftType; nightMinutes: number } {
  if (checkOut <= checkIn) {
    return { shiftType: 'DIURNA', nightMinutes: 0 };
  }

  const nightMinutes = nightMinutesBetween(checkIn, checkOut);

  let shiftType: ShiftType;
  if (nightMinutes === 0) {
    shiftType = 'DIURNA';
  } else if (nightMinutes >= NIGHT_SHIFT_THRESHOLD_MINUTES) {
    shiftType = 'NOCTURNA';
  } else {
    shiftType = 'MIXTA';
  }

  return { shiftType, nightMinutes };
}

/**
 * Devuelve la jornada máxima diaria legal en minutos según el tipo
 * de jornada (art. 61 LFT).
 *
 *   DIURNA   → 8 horas  = 480 min
 *   NOCTURNA → 7 horas  = 420 min
 *   MIXTA    → 7.5 horas = 450 min
 *
 * @param shiftType - Tipo de jornada ('DIURNA' | 'NOCTURNA' | 'MIXTA').
 * @returns Minutos máximos legales por día.
 */
export function getLegalMaxMinutes(shiftType: ShiftType): number {
  switch (shiftType) {
    case 'DIURNA':
      return 8 * 60; // 480
    case 'NOCTURNA':
      return 7 * 60; // 420
    case 'MIXTA':
      return 7.5 * 60; // 450
    default:
      return 8 * 60; // fallback conservador
  }
}
