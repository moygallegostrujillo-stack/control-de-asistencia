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
import { auditLog, getIpAndUA } from '@/lib/audit';
import { toISODate } from '@/lib/timezone';
import {
  parseDateRange,
  getEffectiveEnd,
  buildPeriodResponseEffective,
} from '@/lib/reports';
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
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const requestedSucursalId = searchParams.get('sucursalId');

    // SUCURSAL_ADMIN / SUPERVISOR: forzar su sucursal
    const sucursalId =
      user.role === 'SUCURSAL_ADMIN' || user.role === 'SUPERVISOR'
        ? user.sucursalId
        : requestedSucursalId;

    // Validar rango (sin tope máximo)
    const { range, errorResponse } = parseDateRange(startDateStr, endDateStr);
    if (!range) return errorResponse!;
    const { start, end } = range;

    // Limit end to today — no contar días futuros
    const effectiveEnd = getEffectiveEnd(end);

    // Generar arreglo de días
    const days: Date[] = [];
    const cursor = new Date(start);
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

    // --- LFT art. 71, 72, 75 — Set de fechas feriadas para lookup O(1) ---
    // Los feriados son globales (modelo Holiday no tiene sucursalId), así que
    // un único Set aplica a todos los empleados. Se consulta dentro del loop
    // per-empleado para distinguir "séptimo día trabajado" (descanso semanal)
    // de "día festivo trabajado" (art. 75 LFT).
    const holidayDateSet = new Set(holidays.map((h) => toISODate(h.date)));

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
      // --- LFT art. 71 (prima dominical), 72 (séptimo día), 75 (festivos) ---
      let domingosTrabajados = 0;
      let diasSeptimo = 0;
      let diasFestivosTrabajados = 0;
      // --- LFT art. 60/61 (jornada nocturna/mixta — prima nocturna 25%) ---
      let minutosNocturnos = 0;
      let jornadaNocturna = false;

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

        // --- LFT art. 71, 72, 75 — nuevos campos legales ---
        // Prima dominical (art. 71 LFT): domingos efectivamente trabajados
        // (status PRESENT o LATE). El flag isSunday ya está persistido por
        // check-in; se usa directamente en lugar de recalcular con getDayOfWeek.
        if (
          (record.status === 'PRESENT' || record.status === 'LATE') &&
          record.isSunday
        ) {
          domingosTrabajados += 1;
        }
        // Séptimo día (art. 72 LFT): día de descanso semanal trabajado,
        // excluyendo festivos (esos se contabilizan en diasFestivosTrabajados).
        if (record.isRestDayWorked && !holidayDateSet.has(dayISO)) {
          diasSeptimo += 1;
        }
        // Días festivos trabajados (art. 75 LFT): doble pago por laborar
        // en día de descanso obligatorio. Solo si asistió (PRESENT o LATE).
        if (
          (record.status === 'PRESENT' || record.status === 'LATE') &&
          holidayDateSet.has(dayISO)
        ) {
          diasFestivosTrabajados += 1;
        }

        // --- LFT art. 60/61 — jornada nocturna/mixta (prima nocturna 25%) ---
        // Minutos trabajados en ventana 20:00-06:00 (persistido por check-out).
        // jornadaNocturna = true si ANY registro es NOCTURNA o MIXTA (art. 60 LFT).
        minutosNocturnos += record.nightMinutes || 0;
        if (
          record.shiftType === 'NOCTURNA' ||
          record.shiftType === 'MIXTA'
        ) {
          jornadaNocturna = true;
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
        // --- LFT art. 71, 72, 75 — nuevos campos legales ---
        // Prima dominical (art. 71) — domingos trabajados (prima ≥25%)
        domingosTrabajados,
        // Séptimo día (art. 72) — descanso semanal trabajado (excluye festivos)
        diasSeptimo,
        // Días festivos trabajados (art. 75) — doble pago por festivo laborado
        diasFestivosTrabajados,
        // --- LFT art. 60/61 — jornada nocturna/mixta (prima nocturna 25%) ---
        // Minutos totales en ventana nocturna (20:00-06:00) del periodo.
        minutosNocturnos,
        // true si ANY registro del empleado fue NOCTURNA o MIXTA (art. 60 LFT).
        jornadaNocturna,
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
        // LFT art. 71, 72, 75
        domingosTrabajados: acc.domingosTrabajados + e.domingosTrabajados,
        diasSeptimo: acc.diasSeptimo + e.diasSeptimo,
        diasFestivosTrabajados:
          acc.diasFestivosTrabajados + e.diasFestivosTrabajados,
        // LFT art. 60/61 — jornada nocturna/mixta (prima nocturna 25%)
        minutosNocturnos: acc.minutosNocturnos + e.minutosNocturnos,
        jornadaNocturna: acc.jornadaNocturna || e.jornadaNocturna,
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
        domingosTrabajados: 0,
        diasSeptimo: 0,
        diasFestivosTrabajados: 0,
        minutosNocturnos: 0,
        jornadaNocturna: false,
      }
    );

    // --- Auditoría (art. 132 fr. VII LFT — trazabilidad de reportes) ---
    try {
      const { ip, ua } = getIpAndUA(req);
      await auditLog({
        userId: user.id,
        action: 'GENERATE_INCIDENCES_REPORT',
        entityType: 'REPORT',
        entityId: null,
        sucursalId: sucursalId || null,
        ipAddress: ip,
        userAgent: ua,
        details: {
          tipo: 'INCIDENCES',
          periodo: { start: range.startISO, end: range.endISO },
          sucursalId,
          registros: byEmployee.length,
        },
      });
    } catch (auditErr) {
      console.error('auditLog (incidences) error:', auditErr);
    }

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
        // LFT art. 60/61 — prima nocturna 25% (jornada nocturna/mixta)
        minutosNocturnos: totals.minutosNocturnos,
        minutosNocturnosHoras: +(totals.minutosNocturnos / 60).toFixed(2),
        jornadaNocturna: totals.jornadaNocturna,
      },
      period: buildPeriodResponseEffective(range, effectiveEnd),
    });
  } catch (error) {
    console.error('GET /api/reports/incidences error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
