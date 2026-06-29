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
import { calculateOvertime, findScheduleForDate } from '@/lib/overtime-calculator';

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

    // Cargar sucursales para checkoutToleranceMinutes (fix #2)
    const sucursalIdsInEmployees = [
      ...new Set(employees.map((e) => e.sucursalId)),
    ];
    const sucursalMap = new Map<
      string,
      {
        id: string;
        name: string;
        codigoLocal: string | null;
        checkoutToleranceMinutes: number;
      }
    >();
    if (sucursalIdsInEmployees.length) {
      const sucs = await db.sucursal.findMany({
        where: { id: { in: sucursalIdsInEmployees } },
        select: {
          id: true,
          name: true,
          codigoLocal: true,
          checkoutToleranceMinutes: true,
        },
      });
      for (const s of sucs) sucursalMap.set(s.id, s);
    }

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
      const sucursal = sucursalMap.get(emp.sucursalId);

      // Map de records por fecha ISO
      const recordsByDate: Record<string, (typeof empRecords)[0]> = {};
      for (const r of empRecords) recordsByDate[toISODate(r.date)] = r;

      let diasLaborados = 0;
      let faltas = 0;
      let retardos = 0;
      let salidasAnticipadas = 0;
      let horasExtraMinutos = 0;
      let horasTrabajadasMinutos = 0;
      let diasVacaciones = 0;
      let diasIncapacidad = 0;

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

        // Calcular overtime (fix #2)
        const sched = findScheduleForDate(empSchedules, day);
        const ot = calculateOvertime({
          record,
          schedule: sched,
          sucursal: {
            checkoutToleranceMinutes:
              sucursal?.checkoutToleranceMinutes ?? 0,
          },
        });

        if (record.status === 'PRESENT' || record.status === 'LATE') {
          diasLaborados += 1;
        }
        if (record.status === 'LATE') retardos += 1;
        if (record.status === 'EARLY_LEAVE') salidasAnticipadas += 1;
        horasExtraMinutos += ot.overtimeMinutes;
        horasTrabajadasMinutos += ot.workedMinutes ?? 0;
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
        horasTrabajadasMinutos,
        horasTrabajadasHoras: +(horasTrabajadasMinutos / 60).toFixed(2),
        diasVacaciones,
        diasIncapacidad,
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
        horasTrabajadasMinutos:
          acc.horasTrabajadasMinutos + e.horasTrabajadasMinutos,
        diasVacaciones: acc.diasVacaciones + e.diasVacaciones,
        diasIncapacidad: acc.diasIncapacidad + e.diasIncapacidad,
      }),
      {
        diasLaborados: 0,
        faltas: 0,
        retardos: 0,
        salidasAnticipadas: 0,
        horasExtraMinutos: 0,
        horasTrabajadasMinutos: 0,
        diasVacaciones: 0,
        diasIncapacidad: 0,
      }
    );

    return NextResponse.json({
      byEmployee,
      totals: {
        ...totals,
        horasExtraHoras: +(totals.horasExtraMinutos / 60).toFixed(2),
        horasTrabajadasHoras: +(totals.horasTrabajadasMinutos / 60).toFixed(2),
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
