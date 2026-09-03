// ============================================================
// /api/alerts/nom-035 — GET
//   Detecta factores de riesgo psicosocial por jornadas excesivas
//   (NOM-035-STPS-2018, categoría A.5 "Jornadas de trabajo excesivas").
//
//   Categorías de alerta:
//     - WEEKLY_OVERTIME_EXCEEDED: empleado con > tope semanal de horas
//       extra (9h fijo per art. 66 LFT — NO escala con la reducción de
//       jornada del DOF 27-dic-2024, que solo afecta la jornada ordinaria).
//     - DAILY_OVERTIME_EXCEEDED: empleado con > 4h extra en un solo día
//       (art. 66 LFT — tope diario).
//     - CONSECUTIVE_LONG_DAYS: empleado con ≥ 3 días consecutivos con
//       horas extra en la semana actual. Solo cuentan días con overtime
//       ≥ 30 min (umbral de materialidad — salidas 5-15 min tarde por
//       tolerancia/cierre no constituyen sobrecarga psicosocial; esos
//       minutos igual se pagan como extra).
//     - NO_WEEKLY_REST: empleado sin día de descanso marcado en su
//       horario (art. 71 LFT).
//     - REST_DAY_WORKED: empleado con al menos un AttendanceRecord donde
//       isRestDayWorked=true en la semana actual (art. 73 LFT — prima
//       del 100% por descanso trabajado; nivel HIGH si fue domingo,
//       MEDIUM si fue otro día).
//
//   Query params:
//     ?week=current (default) — semana actual (lun..dom)
//     ?week=last               — semana anterior
//     ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD — rango arbitrario
//       (26-ago-2026): permite ver meses anteriores. El rango se divide
//       en semanas ISO (lun..dom) y se computan alertas por semana.
//
//   Acceso: ADMIN (cualquier rol). SUCURSAL_ADMIN ve solo su sucursal.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { db } from '@/lib/db';
import {
  getAuthUser,
  getSucursalFilter,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
} from '@/lib/auth';
import {
  MEXICO_TZ,
  toISODate,
} from '@/lib/timezone';
import { getWeeklyOvertimeCapMinutes } from '@/lib/overtime-calculator';

type AlertLevel = 'HIGH' | 'MEDIUM' | 'LOW';
type AlertType = 'WEEKLY_OVERTIME_EXCEEDED' | 'DAILY_OVERTIME_EXCEEDED' | 'CONSECUTIVE_LONG_DAYS' | 'NO_WEEKLY_REST' | 'REST_DAY_WORKED';

// --- Case 2026-09-02 (Gabriela Alvarez) — umbral de materialidad ---
// Un día solo cuenta como "día con horas extra" para la racha de
// CONSECUTIVE_LONG_DAYS si el overtime de ESE día alcanza este mínimo.
// Antes: ot > 0 (1 solo minuto ya contaba) → falsos positivos cuando el
// empleado salía 5-15 min tarde (cierre de local, último cliente).
// Esos minutos SE PAGAN como extra (fix #3 — tolerancia no se descuenta
// del overtime devengado), pero 10 min/día NO constituyen una jornada
// excesiva en el sentido de NOM-035 (riesgo psicosocial).
// 30 min = media hora, unidad de referencia del art. 63 LFT (descanso
// dentro de jornada). La nómina NO se ve afectada: el overtime devengado
// sigue contándose minuto a minuto; esto solo filtra la alerta.
const LONG_DAY_MIN_OT_MINUTES = 30;

interface NOM035Alert {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  sucursalId: string;
  sucursalName: string;
  sucursalCodigoLocal: string | null;
  type: AlertType;
  level: AlertLevel;
  title: string;
  description: string;
  metric: {
    weeklyOvertimeMinutes: number;
    weeklyOvertimeCapMinutes: number;
    maxDailyOvertimeMinutes: number;
    consecutiveLongDays: number;
  };
  recommendation: string;
  legalReference: string;
  /** ISO date (YYYY-MM-DD) del lunes de la semana en que se detectó la alerta. */
  weekStart?: string;
  /** ISO date (YYYY-MM-DD) del domingo de la semana en que se detectó la alerta. */
  weekEnd?: string;
}

/**
 * Devuelve el instante del LUNES 00:00 (America/Mexico_City) de la semana
 * ISO (lun..dom) que contiene `date`.
 *
 * Caso Gabriela (2026-09-02): la versión anterior evaluaba el día de la
 * semana en Mexico (getDayOfWeek) pero hacía la aritmética con setHours/
 * setDate en la TZ DEL PROCESO (UTC en Vercel). Esa mezcla producía semanas
 * desfasadas: un rango lun→dom se partía en [domingo→domingo] cortando o
 * agrupando rachas de sobrecarga de forma incorrecta ("2 semanas" fantasma
 * en la vista, alertas de racha con días de semanas distintas).
 *
 * Ahora todo el cálculo calendario se hace con luxon anclado a MEXICO_TZ:
 * la semana calendario que el ADMIN ve en Mexico es la que se computa.
 */
function getMondayOfWeek(date: Date): Date {
  const dt = DateTime.fromJSDate(date, { zone: MEXICO_TZ }).startOf('day');
  return dt.minus({ days: dt.weekday - 1 }).toJSDate(); // weekday: lunes=1..domingo=7
}

/**
 * Divide un rango [start, end] en semanas ISO (lun..dom) ANCLADAS A MEXICO.
 * Cada semana va de lunes 00:00 a domingo 23:59:59.999 en America/Mexico_City
 * (los instantes devueltos son UTC correctos para queries Prisma).
 */
function splitIntoWeeks(start: Date, end: Date): { monday: Date; sunday: Date }[] {
  const weeks: { monday: Date; sunday: Date }[] = [];
  const cursor = getMondayOfWeek(start);
  const endLimit = DateTime.fromJSDate(end, { zone: MEXICO_TZ }).endOf('day').toJSDate();

  let it = new Date(cursor);
  while (it <= endLimit) {
    const sunday = new Date(it);
    sunday.setDate(sunday.getDate() + 7);
    sunday.setMilliseconds(-1); // fin del domingo 23:59:59.999 (Mexico)
    weeks.push({ monday: new Date(it), sunday });
    it = new Date(it);
    it.setDate(it.getDate() + 7);
  }
  return weeks;
}

/** Computa las alertas de UNA semana para todos los empleados dados. */
async function computeAlertsForWeek(
  monday: Date,
  sunday: Date,
  employees: any[],
  weeklyCap: number
): Promise<NOM035Alert[]> {
  const records = await db.attendanceRecord.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      date: { gte: monday, lte: sunday },
    },
    orderBy: { date: 'asc' },
  });

  const recordsByEmployee = new Map<string, typeof records>();
  for (const r of records) {
    const list = recordsByEmployee.get(r.employeeId) || [];
    list.push(r);
    recordsByEmployee.set(r.employeeId, list);
  }

  const alerts: NOM035Alert[] = [];
  const weekStartISO = toISODate(monday);
  const weekEndISO = toISODate(sunday);

  for (const emp of employees) {
    const empRecords = recordsByEmployee.get(emp.id) || [];

    const weeklyOvertimeMinutes = empRecords.reduce(
      (sum, r) => sum + (r.overtimeDoubleMinutes || 0) + (r.overtimeTripleMinutes || 0),
      0
    );

    const maxDailyOvertimeMinutes = empRecords.reduce(
      (max, r) => Math.max(max, (r.overtimeDoubleMinutes || 0) + (r.overtimeTripleMinutes || 0)),
      0
    );

    // Racha de "días largos": solo días con overtime >= LONG_DAY_MIN_OT_MINUTES
    // cuentan (umbral de materialidad — ver nota en LONG_DAY_MIN_OT_MINUTES).
    // streakMinutes acumula el overtime de la racha actual y maxStreakMinutes
    // guarda el total de la racha más larga, para dar contexto en la alerta.
    let consecutiveLongDays = 0;
    let maxStreak = 0;
    let streakMinutes = 0;
    let maxStreakMinutes = 0;
    for (const r of empRecords) {
      const ot = (r.overtimeDoubleMinutes || 0) + (r.overtimeTripleMinutes || 0);
      if (ot >= LONG_DAY_MIN_OT_MINUTES) {
        consecutiveLongDays++;
        streakMinutes += ot;
        if (consecutiveLongDays > maxStreak) {
          maxStreak = consecutiveLongDays;
          maxStreakMinutes = streakMinutes;
        }
      } else {
        consecutiveLongDays = 0;
        streakMinutes = 0;
      }
    }
    consecutiveLongDays = maxStreak;

    const hasWeeklyRest = emp.workSchedules.some((s: any) => s.isWeeklyRest);

    const baseInfo = {
      employeeId: emp.id,
      employeeName: emp.user.name,
      employeeNumber: emp.employeeNumber,
      sucursalId: emp.sucursalId,
      sucursalName: emp.sucursal.name,
      sucursalCodigoLocal: emp.sucursal.codigoLocal,
      weekStart: weekStartISO,
      weekEnd: weekEndISO,
    };

    const metric = {
      weeklyOvertimeMinutes,
      weeklyOvertimeCapMinutes: weeklyCap,
      maxDailyOvertimeMinutes,
      consecutiveLongDays,
      longDayThresholdMinutes: LONG_DAY_MIN_OT_MINUTES,
      streakTotalOvertimeMinutes: maxStreakMinutes,
    };

    if (weeklyOvertimeMinutes > weeklyCap) {
      const excess = weeklyOvertimeMinutes - weeklyCap;
      alerts.push({
        ...baseInfo,
        type: 'WEEKLY_OVERTIME_EXCEEDED',
        level: excess > 180 ? 'HIGH' : 'MEDIUM',
        title: `Exceso de horas extra semanales (${emp.user.name})`,
        description: `${(weeklyOvertimeMinutes / 60).toFixed(1)}h extra esta semana (tope ${(weeklyCap / 60).toFixed(0)}h). Excedente: ${(excess / 60).toFixed(1)}h. Las horas que exceden el tope deben pagarse al TRIPLE (art. 68 LFT).`,
        metric,
        recommendation: 'Redistribuir carga, contratar personal, o autorizar expresamente las horas triple. Documentar la causa.',
        legalReference: 'LFT art. 66/68 (tope semanal fijo 9h)',
      });
    }

    if (maxDailyOvertimeMinutes > 240) {
      alerts.push({
        ...baseInfo,
        type: 'DAILY_OVERTIME_EXCEEDED',
        level: 'HIGH',
        title: `Jornada diaria excesiva (${emp.user.name})`,
        description: `Un día con ${(maxDailyOvertimeMinutes / 60).toFixed(1)}h extra (tope diario 4h, art. 66 LFT). El excedente no se paga como extra autorizada y constituye jornada no permitida.`,
        metric,
        recommendation: 'Evitar asignar >4h extra en un solo día. Si fue emergencia, documentarla.',
        legalReference: 'LFT art. 66 (tope diario 4h)',
      });
    }

    if (consecutiveLongDays >= 3) {
      const streakH = (maxStreakMinutes / 60).toFixed(1);
      alerts.push({
        ...baseInfo,
        type: 'CONSECUTIVE_LONG_DAYS',
        level: consecutiveLongDays >= 5 ? 'HIGH' : 'MEDIUM',
        title: `Sobrecarga sostenida (${emp.user.name})`,
        description: `${consecutiveLongDays} días consecutivos con ≥${LONG_DAY_MIN_OT_MINUTES} min de horas extra (total ${maxStreakMinutes} min ≈ ${streakH}h en la racha). Patrón de sobrecarga que puede constituir factor de riesgo psicosocial.`,
        metric,
        recommendation: 'Revisar carga laboral y organizar turnos. Aplicar NOM-035 referencia identificación de riesgos.',
        legalReference: 'LFT arts. 66/68; identificación de sobrecarga sostenida',
      });
    }

    if (!hasWeeklyRest) {
      alerts.push({
        ...baseInfo,
        type: 'NO_WEEKLY_REST',
        level: 'HIGH',
        title: `Sin día de descanso configurado (${emp.user.name})`,
        description: 'El empleado no tiene ningún día marcado como descanso semanal en su horario. Incumplimiento del art. 71 LFT.',
        metric,
        recommendation: 'Editar el empleado y marcar al menos 1 día como "Descanso" en su horario.',
        legalReference: 'LFT art. 71 (descanso semanal obligatorio)',
      });
    }

    for (const r of empRecords) {
      if (!r.isRestDayWorked) continue;
      const workedMin = r.restDayWorkedMinutes ?? 0;
      const level: AlertLevel = r.isSunday ? 'HIGH' : 'MEDIUM';
      const dayLabel = r.isSunday ? 'domingo' : 'día de descanso';
      alerts.push({
        ...baseInfo,
        type: 'REST_DAY_WORKED',
        level,
        title: `Día de descanso trabajado (${emp.user.name})`,
        description: `El empleado trabajó en su ${dayLabel} el ${toISODate(r.date)}. Minutos trabajados: ${workedMin} (${(workedMin / 60).toFixed(1)}h). Aplica prima del 100% adicional sobre la jornada completa (art. 73 LFT).${r.isSunday ? ' Al ser domingo, también aplica prima dominical (art. 71 LFT).' : ''}`,
        metric,
        recommendation: 'Pagar jornada completa con prima del 100% adicional. Si fue domingo, también aplica prima dominical (art. 71 LFT).',
        legalReference: 'LFT art. 73 (prima del 100% por descanso trabajado); art. 71 (prima dominical)',
      });
    }
  }

  return alerts;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { searchParams } = new URL(req.url);
    const weekParam = searchParams.get('week') || 'current';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Determinar el rango a consultar
    let rangeStart: Date;
    let rangeEnd: Date;
    let isRangeMode = false;

    if (startDateParam && endDateParam) {
      // Modo rango: interpretar las fechas (YYYY-MM-DD) como días calendario
      // EN MEXICO (el admin mexicano elige "31/08" pensando en su día local,
      // no en medianoche UTC, que en Mexico es 30/08 18:00 → semana desfasada).
      // Caso Gabriela: este parseo UTC era parte del bug de "2 semanas fantasma".
      rangeStart = DateTime.fromFormat(startDateParam, 'yyyy-MM-dd', { zone: MEXICO_TZ })
        .startOf('day').toJSDate();
      rangeEnd = DateTime.fromFormat(endDateParam, 'yyyy-MM-dd', { zone: MEXICO_TZ })
        .endOf('day').toJSDate();
      isRangeMode = true;
    } else {
      // Modo semana (backward compat para NotificationBell)
      const today = new Date();
      const monday = getMondayOfWeek(today);
      if (weekParam === 'last') {
        monday.setDate(monday.getDate() - 7);
      }
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 7);
      sunday.setMilliseconds(-1);
      rangeStart = monday;
      rangeEnd = sunday;
    }

    const sucursalFilter = getSucursalFilter(user);

    const employees = await db.employee.findMany({
      where: {
        isActive: true,
        ...sucursalFilter,
      },
      include: {
        user: { select: { id: true, name: true } },
        sucursal: { select: { id: true, name: true, codigoLocal: true } },
        workSchedules: { select: { dayOfWeek: true, isWeeklyRest: true } },
      },
    });

    if (employees.length === 0) {
      return NextResponse.json({ alerts: [], summary: { total: 0, high: 0, medium: 0, low: 0 } });
    }

    // Dividir el rango en semanas ISO y computar alertas por semana
    const weeks = splitIntoWeeks(rangeStart, rangeEnd);
    const allAlerts: NOM035Alert[] = [];

    for (const { monday, sunday } of weeks) {
      const year = monday.getFullYear();
      const weeklyCap = getWeeklyOvertimeCapMinutes(year);
      const weekAlerts = await computeAlertsForWeek(monday, sunday, employees, weeklyCap);
      allAlerts.push(...weekAlerts);
    }

    // Ordenar: HIGH primero, luego MEDIUM, luego LOW
    const levelOrder: Record<AlertLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    allAlerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

    // Summary — weekStart/weekEnd reflejan la PRIMERA y ÚLTIMA semana
    // ISO (Mexico) realmente computadas (no el rango crudo ingresado),
    // así la UI muestra "1 semana" y los bordes lun→dom correctos.
    const summary = {
      total: allAlerts.length,
      high: allAlerts.filter((a) => a.level === 'HIGH').length,
      medium: allAlerts.filter((a) => a.level === 'MEDIUM').length,
      low: allAlerts.filter((a) => a.level === 'LOW').length,
      weekStart: toISODate(weeks[0].monday),
      weekEnd: toISODate(weeks[weeks.length - 1].sunday),
      rangeStart: toISODate(rangeStart),
      rangeEnd: toISODate(rangeEnd),
      weeksCount: weeks.length,
      isRangeMode,
      weeklyOvertimeCapMinutes: getWeeklyOvertimeCapMinutes(rangeStart.getFullYear()),
      employeesChecked: employees.length,
    };

    return NextResponse.json({ alerts: allAlerts, summary });
  } catch (error) {
    console.error('GET /api/alerts/nom-035 error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
