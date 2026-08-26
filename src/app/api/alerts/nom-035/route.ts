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
//       horas extra en la semana actual.
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
import { db } from '@/lib/db';
import {
  getAuthUser,
  getSucursalFilter,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
} from '@/lib/auth';
import {
  getDayOfWeek,
  toISODate,
} from '@/lib/timezone';
import { getWeeklyOvertimeCapMinutes } from '@/lib/overtime-calculator';

type AlertLevel = 'HIGH' | 'MEDIUM' | 'LOW';
type AlertType = 'WEEKLY_OVERTIME_EXCEEDED' | 'DAILY_OVERTIME_EXCEEDED' | 'CONSECUTIVE_LONG_DAYS' | 'NO_WEEKLY_REST' | 'REST_DAY_WORKED';

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

/** Devuelve la fecha del lunes (00:00) de la semana ISO que contiene `date`. */
function getMondayOfWeek(date: Date): Date {
  const dow = getDayOfWeek(date); // 0=domingo..6=sábado
  const daysFromMonday = (dow + 6) % 7; // lun=0, ..., dom=6
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - daysFromMonday);
  return monday;
}

/** Divide un rango [start, end] en semanas ISO (lun..dom) y devuelve cada una. */
function splitIntoWeeks(start: Date, end: Date): { monday: Date; sunday: Date }[] {
  const weeks: { monday: Date; sunday: Date }[] = [];
  const cursor = getMondayOfWeek(start);
  const endLimit = new Date(end);
  endLimit.setHours(23, 59, 59, 999);

  while (cursor <= endLimit) {
    const sunday = new Date(cursor);
    sunday.setDate(sunday.getDate() + 7);
    sunday.setMilliseconds(-1); // fin del domingo
    weeks.push({ monday: new Date(cursor), sunday });
    cursor.setDate(cursor.getDate() + 7);
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

    let consecutiveLongDays = 0;
    let maxStreak = 0;
    for (const r of empRecords) {
      const ot = (r.overtimeDoubleMinutes || 0) + (r.overtimeTripleMinutes || 0);
      if (ot > 0) {
        consecutiveLongDays++;
        maxStreak = Math.max(maxStreak, consecutiveLongDays);
      } else {
        consecutiveLongDays = 0;
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
      alerts.push({
        ...baseInfo,
        type: 'CONSECUTIVE_LONG_DAYS',
        level: consecutiveLongDays >= 5 ? 'HIGH' : 'MEDIUM',
        title: `Sobrecarga sostenida (${emp.user.name})`,
        description: `${consecutiveLongDays} días consecutivos con horas extra esta semana. Patrón de sobrecarga que puede constituir factor de riesgo psicosocial.`,
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
      // Modo rango: usar las fechas dadas (YYYY-MM-DD)
      rangeStart = new Date(startDateParam + 'T00:00:00');
      rangeEnd = new Date(endDateParam + 'T23:59:59');
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

    // Para backward compat con NotificationBell: si es modo semana única,
    // weekStart/weekEnd son los de esa semana. Si es modo rango, son el
    // inicio/fin del rango completo.
    const summary = {
      total: allAlerts.length,
      high: allAlerts.filter((a) => a.level === 'HIGH').length,
      medium: allAlerts.filter((a) => a.level === 'MEDIUM').length,
      low: allAlerts.filter((a) => a.level === 'LOW').length,
      weekStart: toISODate(rangeStart),
      weekEnd: toISODate(rangeEnd),
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
