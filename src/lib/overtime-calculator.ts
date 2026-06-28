// ============================================================
// OVERTIME CALCULATOR — fix #2
// Aplica checkoutToleranceMinutes antes de contar horas extra
// ============================================================

import type { AttendanceRecord, Sucursal, WorkSchedule } from '@prisma/client';
import { getDayOfWeek, minutesBetween, toISODate } from './timezone';

export interface OvertimeInput {
  record: AttendanceRecord;
  schedule: WorkSchedule | null;
  sucursal: Pick<Sucursal, 'checkoutToleranceMinutes'>;
}

export interface OvertimeResult {
  workedMinutes: number | null;
  overtimeMinutes: number;
  overtimeHours: number;
  isLate: boolean;
  isEarlyLeave: boolean;
  status: 'PRESENT' | 'LATE' | 'EARLY_LEAVE' | 'ABSENT';
}

/**
 * Calcula horas trabajadas, horas extra (con tolerancia aplicada — fix #2),
 * y estado (PRESENT/LATE/EARLY_LEAVE).
 *
 * Fórmula overtime con tolerancia (fix #2):
 *   overtimeMinutes = max(0, workedMinutes - scheduledMinutes - checkoutToleranceMinutes)
 */
export function calculateOvertime(input: OvertimeInput): OvertimeResult {
  const { record, schedule, sucursal } = input;

  // Si no hay check-in ni check-out, no se puede calcular
  if (!record.checkInTime || !record.checkOutTime) {
    return {
      workedMinutes: null,
      overtimeMinutes: 0,
      overtimeHours: 0,
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
