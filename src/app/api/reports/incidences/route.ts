// ============================================================
// /api/reports/incidences — GET
//   Reporte consolidado de incidencias por empleado en un rango.
//   fix #2 — overtime con tolerancia (calculateOvertime).
//   fix #5 — incidencias consolidadas (faltas, retardos,
//            salidas anticipadas, horas extra, vacaciones,
//            incapacidad, días laborados).
//   fix #11 — faltas calculadas con isAbsentOnDate (schedule-aware).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
} from '@/lib/auth';
import { toISODate, getMexicoTodayISO } from '@/lib/timezone';
import {
  isAbsentOnDate,
  loadActiveEmployees,
  loadSchedules,
  loadRecords,
  loadApprovedVacations,
  loadHolidays,
} from '@/lib/absence-calculator';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { searchParams } = new URL(req.url);
    const startDateStr =
      searchParams.get('startDate') || getMexicoTodayISO();
    const endDateStr = searchParams.get('endDate') || getMexicoTodayISO();
    const requestedSucursalId = searchParams.get('sucursalId');

    // SUCURSAL_ADMIN / SUPERVISOR: forzar su sucursal
    const sucursalId =
      user.role === 'SUCURSAL_ADMIN' || user.role === 'SUPERVISOR'
        ? user.sucursalId
        : requestedSucursalId;

    const start = new Date(`${startDateStr}T00:00:00.000Z`);
    const end = new Date(`${endDateStr}T23:59:59.999Z`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Fechas inválidas (use YYYY-MM-DD)' },
        { status: 400 }
      );
    }
    if (start > end) {
      return NextResponse.json(
        { error: 'startDate no puede ser mayor a endDate' },
        { status: 400 }
      );
    }

    // Limit end to today — no contar días futuros
    const todayISO = getMexicoTodayISO();
    const effectiveEndStr = endDateStr > todayISO ? todayISO : endDateStr;
    const effectiveEnd = new Date(`${effectiveEndStr}T23:59:59.999Z`);

    // Generar arreglo de días
    const days: Date[] = [];
    const cursor = new Date(`${startDateStr}T00:00:00.000Z`);
    while (cursor <= effectiveEnd) {
      days.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    // Cargar empleados activos
    const employees = await loadActiveEmployees(sucursalId || undefined);
    const employeeIds = employees.map((e) => e.id);

    // Cargar schedules, records, vacations, holidays
    const [schedulesByEmp, recordsByEmp, vacations, holidays] =
      await Promise.all([
        loadSchedules(employeeIds),
        loadRecords(start, end, sucursalId || undefined),
        loadApprovedVacations(start, end, sucursalId || undefined),
        loadHolidays(start, end),
      ]);

    // Reforma LFT 2027 — dobles/triples y prima descanso se leen directamente
    // de la BD (persistidos por check-out). No se necesita checkoutToleranceMinutes
    // aquí porque no se recalcula overtime.

    // Agrupar vacaciones por empleado (con tipo)
    const vacationsByEmp: Record<
      string,
      { type: string; status: string; startDate: Date; endDate: Date }[]
    > = {};
    for (const v of vacations as any[]) {
      if (!vacationsByEmp[v.employeeId]) vacationsByEmp[v.employeeId] = [];
      vacationsByEmp[v.employeeId].push({
        type: v.type,
        status: v.status,
        startDate: v.startDate,
        endDate: v.endDate,
      });
    }

    // Iterar empleado por empleado, día por día
    const byEmployee: any[] = [];
    for (const emp of employees) {
      const empSchedules = schedulesByEmp[emp.id] || [];
      const empRecords = recordsByEmp[emp.id] || [];
      const empVacations = vacationsByEmp[emp.id] || [];

      // Map de records por fecha ISO
      const recordsByDate: Record<string, (typeof empRecords)[0]> = {};
      for (const r of empRecords) recordsByDate[toISODate(r.date)] = r;

      let diasLaborados = 0;
      let faltas = 0;
      let retardos = 0;
      let salidasAnticipadas = 0;
      let horasExtraMinutos = 0;
      let horasExtraDobleMinutos = 0;
      let horasExtraTripleMinutos = 0;
      let horasTrabajadasMinutos = 0;
      let diasVacaciones = 0;
      let diasIncapacidad = 0;
      let diasDescansoTrabajado = 0;
      let primaDescansoMinutos = 0;

      for (const day of days) {
        const dayISO = toISODate(day);

        // Vacaciones/incapacidad que cubren este día
        const vacation = empVacations.find(
          (v) =>
            v.status === 'APPROVED' &&
            toISODate(v.startDate) <= dayISO &&
            toISODate(v.endDate) >= dayISO
        );

        // Ausencia (schedule-aware — fix #11)
        const absenceResult = isAbsentOnDate(day, {
          employee: { id: emp.id, isActive: emp.isActive },
          schedules: empSchedules.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            isWeeklyRest: s.isWeeklyRest,
          })),
          records: empRecords,
          vacations: empVacations as any,
          holidays,
        });

        const record = recordsByDate[dayISO];

        if (vacation) {
          // Vacaciones / incapacidad / permiso — contar días naturales
          if (
            vacation.type === 'INCAPACIDAD' ||
            vacation.type === 'MATERNIDAD'
          ) {
            diasIncapacidad += 1;
          } else if (vacation.type === 'VACACIONES') {
            diasVacaciones += 1;
          }
          // PERMISO/PATERNIDAD/OTRO: no se cuentan como faltas ni como laborados
          continue;
        }

        if (absenceResult.absent) {
          faltas += 1;
          continue;
        }

        if (!record) continue; // no trabajó (sunday/holiday/no_schedule)

        // Reforma LFT 2027 — dobles/triples y prima descanso ya persistidos
        // por el check-out. Se leen directamente de la BD (no se recalcula).
        if (record.status === 'PRESENT' || record.status === 'LATE') {
          diasLaborados += 1;
        }
        if (record.status === 'LATE') retardos += 1;
        if (record.status === 'EARLY_LEAVE') salidasAnticipadas += 1;

        const recOtMin = record.overtimeMinutes ?? 0;
        const recDoubleMin = record.overtimeDoubleMinutes ?? 0;
        const recTripleMin = record.overtimeTripleMinutes ?? 0;
        horasExtraMinutos += recOtMin;
        horasExtraDobleMinutos += recDoubleMin;
        horasExtraTripleMinutos += recTripleMin;
        horasTrabajadasMinutos += record.workedMinutes ?? 0;

        if (record.isRestDayWorked) {
          diasDescansoTrabajado += 1;
          primaDescansoMinutos += record.restDayPremiumMinutes ?? 0;
        }
      }

      byEmployee.push({
        employeeId: emp.id,
        name: emp.user.name,
        employeeNumber: emp.employeeNumber,
        sucursalId: emp.sucursal?.id || null,
        sucursalName: emp.sucursal?.name || '—',
        sucursalCodigoLocal: emp.sucursal?.codigoLocal || null,
        department: emp.department,
        position: emp.position,
        diasLaborados,
        faltas,
        retardos,
        salidasAnticipadas,
        horasExtraMinutos,
        horasExtraHoras: +(horasExtraMinutos / 60).toFixed(2),
        // Reforma LFT 2027 — dobles (art. 66) / triples (art. 68)
        horasExtraDobleMinutos,
        horasExtraDobleHoras: +(horasExtraDobleMinutos / 60).toFixed(2),
        horasExtraTripleMinutos,
        horasExtraTripleHoras: +(horasExtraTripleMinutos / 60).toFixed(2),
        horasTrabajadasMinutos,
        horasTrabajadasHoras: +(horasTrabajadasMinutos / 60).toFixed(2),
        diasVacaciones,
        diasIncapacidad,
        // Prima por descanso trabajado (art. 73 LFT)
        diasDescansoTrabajado,
        primaDescansoMinutos,
        primaDescansoHoras: +(primaDescansoMinutos / 60).toFixed(2),
      });
    }

    // Ordenar por sucursal + nombre
    byEmployee.sort((a, b) => {
      if (a.sucursalName !== b.sucursalName) {
        return a.sucursalName.localeCompare(b.sucursalName);
      }
      return a.name.localeCompare(b.name);
    });

    // Totales
    const totals = byEmployee.reduce(
      (acc, e) => ({
        diasLaborados: acc.diasLaborados + e.diasLaborados,
        faltas: acc.faltas + e.faltas,
        retardos: acc.retardos + e.retardos,
        salidasAnticipadas: acc.salidasAnticipadas + e.salidasAnticipadas,
        horasExtraMinutos: acc.horasExtraMinutos + e.horasExtraMinutos,
        horasExtraDobleMinutos:
          acc.horasExtraDobleMinutos + e.horasExtraDobleMinutos,
        horasExtraTripleMinutos:
          acc.horasExtraTripleMinutos + e.horasExtraTripleMinutos,
        horasTrabajadasMinutos:
          acc.horasTrabajadasMinutos + e.horasTrabajadasMinutos,
        diasVacaciones: acc.diasVacaciones + e.diasVacaciones,
        diasIncapacidad: acc.diasIncapacidad + e.diasIncapacidad,
        diasDescansoTrabajado:
          acc.diasDescansoTrabajado + e.diasDescansoTrabajado,
        primaDescansoMinutos:
          acc.primaDescansoMinutos + e.primaDescansoMinutos,
      }),
      {
        diasLaborados: 0,
        faltas: 0,
        retardos: 0,
        salidasAnticipadas: 0,
        horasExtraMinutos: 0,
        horasExtraDobleMinutos: 0,
        horasExtraTripleMinutos: 0,
        horasTrabajadasMinutos: 0,
        diasVacaciones: 0,
        diasIncapacidad: 0,
        diasDescansoTrabajado: 0,
        primaDescansoMinutos: 0,
      }
    );

    return NextResponse.json({
      byEmployee,
      totals: {
        ...totals,
        horasExtraHoras: +(totals.horasExtraMinutos / 60).toFixed(2),
        horasExtraDobleHoras: +(totals.horasExtraDobleMinutos / 60).toFixed(2),
        horasExtraTripleHoras: +(totals.horasExtraTripleMinutos / 60).toFixed(2),
        horasTrabajadasHoras: +(totals.horasTrabajadasMinutos / 60).toFixed(2),
        primaDescansoHoras: +(totals.primaDescansoMinutos / 60).toFixed(2),
        totalEmployees: byEmployee.length,
      },
      period: { start: startDateStr, end: effectiveEndStr },
    });
  } catch (error) {
    console.error('GET /api/reports/incidences error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
