// ============================================================
// ABSENCE CALCULATOR — fix #11 y fix #12
// Unifica el cálculo de ausentes entre dashboard, reportes y desglose
// ============================================================

import { db } from './db';
import { getDayOfWeek, toISODate } from './timezone';
import type { Employee, WorkSchedule, AttendanceRecord, Vacation, Holiday } from '@prisma/client';

export interface AbsenceContext {
  employee: Pick<Employee, 'id' | 'isActive'>;
  schedules: Pick<WorkSchedule, 'dayOfWeek' | 'isWeeklyRest'>[];
  records: AttendanceRecord[]; // registros del periodo relevante
  vacations: Vacation[]; // aprobadas que cubren el periodo
  holidays: Holiday[]; // feriados oficiales
}

export interface AbsenceResult {
  absent: boolean;
  reason?: string; // 'no_schedule' | 'sunday' | 'holiday' | 'vacation' | 'absent'
}

/**
 * Determina si un empleado está ausente en una fecha dada.
 * Lógica unificada — usada por dashboard, absences report y daily report.
 */
export function isAbsentOnDate(
  date: Date,
  ctx: AbsenceContext
): AbsenceResult {
  // 1. Si no está activo, no se cuenta
  if (!ctx.employee.isActive) {
    return { absent: false, reason: 'inactive' };
  }

  const dow = getDayOfWeek(date); // 0=domingo..6=sábado
  const dateISO = toISODate(date);

  // 2. Domingo = descanso oficial (no se cuenta como ausencia)
  if (dow === 0) {
    return { absent: false, reason: 'sunday' };
  }

  // 3. Feriado oficial
  const isHoliday = ctx.holidays.some((h) => toISODate(h.date) === dateISO);
  if (isHoliday) {
    return { absent: false, reason: 'holiday' };
  }

  // 4. Vacaciones aprobadas que cubren la fecha
  const onVacation = ctx.vacations.some(
    (v) =>
      v.status === 'APPROVED' &&
      toISODate(v.startDate) <= dateISO &&
      toISODate(v.endDate) >= dateISO
  );
  if (onVacation) {
    return { absent: false, reason: 'vacation' };
  }

  // 5. Sin horario ese día → no ausente (no trabaja ese día)
  const daySchedule = ctx.schedules.find((s) => s.dayOfWeek === dow);
  if (!daySchedule || daySchedule.isWeeklyRest) {
    return { absent: false, reason: 'no_schedule' };
  }

  // 6. Tiene horario → verificar registro
  const record = ctx.records.find((r) => toISODate(r.date) === dateISO);
  if (!record || record.status === 'ABSENT') {
    return { absent: true, reason: 'absent' };
  }

  return { absent: false, reason: 'present' };
}

/**
 * Carga el contexto completo para un empleado en un periodo.
 */
export async function loadAbsenceContext(
  employeeId: string,
  startDate: Date,
  endDate: Date
): Promise<AbsenceContext> {
  const [employee, schedules, records, vacations, holidays] = await Promise.all([
    db.employee.findUniqueOrThrow({ where: { id: employeeId }, select: { id: true, isActive: true } }),
    db.workSchedule.findMany({ where: { employeeId }, select: { dayOfWeek: true, isWeeklyRest: true } }),
    db.attendanceRecord.findMany({
      where: { employeeId, date: { gte: startDate, lte: endDate } },
    }),
    db.vacation.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    }),
    db.holiday.findMany({
      where: { date: { gte: startDate, lte: endDate } },
    }),
  ]);

  return { employee, schedules, records, vacations, holidays };
}

/**
 * Carga holidays en un rango (común para todos los empleados).
 */
export async function loadHolidays(startDate: Date, endDate: Date): Promise<Holiday[]> {
  return db.holiday.findMany({ where: { date: { gte: startDate, lte: endDate } } });
}

/**
 * Carga vacations aprobadas en un rango.
 */
export async function loadApprovedVacations(
  startDate: Date,
  endDate: Date,
  sucursalId?: string
): Promise<(Vacation & { employee: { id: string; sucursalId: string } })[]> {
  return db.vacation.findMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: endDate },
      endDate: { gte: startDate },
      ...(sucursalId ? { employee: { sucursalId } } : {}),
    },
    include: { employee: { select: { id: true, sucursalId: true } } },
  }) as any;
}

/**
 * Carga schedules por empleado para una sucursal (opcional).
 */
export async function loadSchedules(employeeIds: string[]): Promise<Record<string, WorkSchedule[]>> {
  const schedules = await db.workSchedule.findMany({
    where: { employeeId: { in: employeeIds } },
  });
  const byEmp: Record<string, WorkSchedule[]> = {};
  for (const s of schedules) {
    if (!byEmp[s.employeeId]) byEmp[s.employeeId] = [];
    byEmp[s.employeeId].push(s);
  }
  return byEmp;
}

/**
 * Carga records por empleado en un rango.
 */
export async function loadRecords(
  startDate: Date,
  endDate: Date,
  sucursalId?: string
): Promise<Record<string, AttendanceRecord[]>> {
  const records = await db.attendanceRecord.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
      ...(sucursalId ? { sucursalId } : {}),
    },
  });
  const byEmp: Record<string, AttendanceRecord[]> = {};
  for (const r of records) {
    if (!byEmp[r.employeeId]) byEmp[r.employeeId] = [];
    byEmp[r.employeeId].push(r);
  }
  return byEmp;
}

/**
 * Carga empleados activos (opcionalmente por sucursal).
 */
export async function loadActiveEmployees(sucursalId?: string) {
  return db.employee.findMany({
    where: {
      isActive: true,
      ...(sucursalId ? { sucursalId } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      sucursal: { select: { id: true, name: true, codigoLocal: true } },
    },
    orderBy: { user: { name: 'asc' } }, // fix #8
  });
}

/**
 * Calcula ausentes para una fecha dada en una sucursal (opcional).
 * Devuelve la lista de empleados ausentes.
 */
export async function computeAbsentsForDate(
  date: Date,
  sucursalId?: string
): Promise<{ id: string; name: string; employeeNumber: string; sucursalName: string }[]> {
  const employees = await loadActiveEmployees(sucursalId);
  const employeeIds = employees.map((e) => e.id);
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  const [schedulesByEmp, recordsByEmp, vacations, holidays] = await Promise.all([
    loadSchedules(employeeIds),
    loadRecords(startDate, endDate, sucursalId),
    loadApprovedVacations(startDate, endDate, sucursalId || undefined),
    loadHolidays(startDate, endDate),
  ]);

  const vacationsByEmp: Record<string, Vacation[]> = {};
  for (const v of vacations) {
    if (!vacationsByEmp[v.employeeId]) vacationsByEmp[v.employeeId] = [];
    vacationsByEmp[v.employeeId].push(v);
  }

  const absents: { id: string; name: string; employeeNumber: string; sucursalName: string }[] = [];

  for (const emp of employees) {
    const result = isAbsentOnDate(date, {
      employee: { id: emp.id, isActive: emp.isActive },
      schedules: (schedulesByEmp[emp.id] || []).map((s) => ({
        dayOfWeek: s.dayOfWeek,
        isWeeklyRest: s.isWeeklyRest,
      })),
      records: recordsByEmp[emp.id] || [],
      vacations: vacationsByEmp[emp.id] || [],
      holidays,
    });
    if (result.absent) {
      absents.push({
        id: emp.id,
        name: emp.user.name,
        employeeNumber: emp.employeeNumber,
        sucursalName: emp.sucursal.codigoLocal
          ? `Local ${emp.sucursal.codigoLocal} — ${emp.sucursal.name}`
          : emp.sucursal.name,
      });
    }
  }

  return absents;
}
