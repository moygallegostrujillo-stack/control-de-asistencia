// ============================================================
// /api/alerts/nom-035 — GET
//   Detecta factores de riesgo psicosocial por jornadas excesivas
//   (NOM-035-STPS-2018, categoría A.5 "Jornadas de trabajo excesivas").
//
//   Categorías de alerta:
//     - WEEKLY_OVERTIME_EXCEEDED: empleado con > tope semanal de horas
//       extra (9h en 2027, gradual hasta 12h en 2030 — Transitorio
//       Cuarto DOF 1-may-2026).
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

interface NOM035Alert {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  sucursalId: string;
  sucursalName: string;
  sucursalCodigoLocal: string | null;
  type: 'WEEKLY_OVERTIME_EXCEEDED' | 'DAILY_OVERTIME_EXCEEDED' | 'CONSECUTIVE_LONG_DAYS' | 'NO_WEEKLY_REST' | 'REST_DAY_WORKED';
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
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { searchParams } = new URL(req.url);
    const weekParam = searchParams.get('week') || 'current';

    // Calcular rango de la semana (lun..dom, México)
    const today = new Date();
    const todayDow = getDayOfWeek(today); // 0=domingo..6=sábado
    const daysFromMonday = (todayDow + 6) % 7; // lun=0, ..., dom=6

    let monday = new Date(today);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - daysFromMonday);

    if (weekParam === 'last') {
      monday.setDate(monday.getDate() - 7);
    }

    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 7);
    sunday.setMilliseconds(-1); // fin del domingo

    // Filtro por sucursal para SUCURSAL_ADMIN
    const sucursalFilter = getSucursalFilter(user);

    // Cargar empleados activos de la sucursal
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

    // Cargar registros de asistencia de la semana
    const records = await db.attendanceRecord.findMany({
      where: {
        employeeId: { in: employees.map((e) => e.id) },
        date: { gte: monday, lte: sunday },
      },
      orderBy: { date: 'asc' },
    });

    // Agrupar registros por empleado
    const recordsByEmployee = new Map<string, typeof records>();
    for (const r of records) {
      const list = recordsByEmployee.get(r.employeeId) || [];
      list.push(r);
      recordsByEmployee.set(r.employeeId, list);
    }

    const alerts: NOM035Alert[] = [];
    const year = monday.getFullYear();
    const weeklyCap = getWeeklyOvertimeCapMinutes(year); // 540 en 2027

    for (const emp of employees) {
      const empRecords = recordsByEmployee.get(emp.id) || [];

      // 1. Acumulado semanal de horas extra (dobles + triples)
      const weeklyOvertimeMinutes = empRecords.reduce(
        (sum, r) => sum + (r.overtimeDoubleMinutes || 0) + (r.overtimeTripleMinutes || 0),
        0
      );

      // 2. Máximo diario de horas extra
      const maxDailyOvertimeMinutes = empRecords.reduce(
        (max, r) => Math.max(max, (r.overtimeDoubleMinutes || 0) + (r.overtimeTripleMinutes || 0)),
        0
      );

      // 3. Días consecutivos con horas extra (> 0)
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

      // 4. Validar descanso semanal
      const hasWeeklyRest = emp.workSchedules.some((s) => s.isWeeklyRest);

      const sucursalCodigoLocal = emp.sucursal.codigoLocal;
      const baseInfo = {
        employeeId: emp.id,
        employeeName: emp.user.name,
        employeeNumber: emp.employeeNumber,
        sucursalId: emp.sucursalId,
        sucursalName: emp.sucursal.name,
        sucursalCodigoLocal,
      };

      // Alerta: Tope semanal excedido
      if (weeklyOvertimeMinutes > weeklyCap) {
        const excess = weeklyOvertimeMinutes - weeklyCap;
        alerts.push({
          ...baseInfo,
          type: 'WEEKLY_OVERTIME_EXCEEDED',
          level: excess > 180 ? 'HIGH' : 'MEDIUM', // >3h de exceso = HIGH
          title: `Exceso de horas extra semanales (${emp.user.name})`,
          description: `${(weeklyOvertimeMinutes / 60).toFixed(1)}h extra esta semana (tope ${(weeklyCap / 60).toFixed(0)}h). Excedente: ${(excess / 60).toFixed(1)}h. Las horas que exceden el tope deben pagarse al TRIPLE (art. 68 LFT).`,
          metric: {
            weeklyOvertimeMinutes,
            weeklyOvertimeCapMinutes: weeklyCap,
            maxDailyOvertimeMinutes,
            consecutiveLongDays,
          },
          recommendation: 'Redistribuir carga, contratar personal, o autorizar expresamente las horas triple. Documentar la causa.',
          legalReference: 'LFT art. 66/68 + Transitorio Cuarto DOF 1-may-2026; NOM-035-STPS-2018 A.5',
        });
      }

      // Alerta: Tope diario excedido (art. 66 — 4h)
      if (maxDailyOvertimeMinutes > 240) {
        alerts.push({
          ...baseInfo,
          type: 'DAILY_OVERTIME_EXCEEDED',
          level: 'HIGH',
          title: `Jornada diaria excesiva (${emp.user.name})`,
          description: `Un día con ${(maxDailyOvertimeMinutes / 60).toFixed(1)}h extra (tope diario 4h, art. 66 LFT). El excedente no se paga como extra autorizada y constituye jornada no permitida.`,
          metric: {
            weeklyOvertimeMinutes,
            weeklyOvertimeCapMinutes: weeklyCap,
            maxDailyOvertimeMinutes,
            consecutiveLongDays,
          },
          recommendation: 'Evitar asignar >4h extra en un solo día. Si fue emergencia, documentarla.',
          legalReference: 'LFT art. 66; NOM-035-STPS-2018 A.5',
        });
      }

      // Alerta: ≥3 días consecutivos con extra
      if (consecutiveLongDays >= 3) {
        alerts.push({
          ...baseInfo,
          type: 'CONSECUTIVE_LONG_DAYS',
          level: consecutiveLongDays >= 5 ? 'HIGH' : 'MEDIUM',
          title: `Sobrecarga sostenida (${emp.user.name})`,
          description: `${consecutiveLongDays} días consecutivos con horas extra esta semana. Patrón de sobrecarga que puede constituir factor de riesgo psicosocial.`,
          metric: {
            weeklyOvertimeMinutes,
            weeklyOvertimeCapMinutes: weeklyCap,
            maxDailyOvertimeMinutes,
            consecutiveLongDays,
          },
          recommendation: 'Revisar carga laboral y organizar turnos. Aplicar NOM-035 referencia identificación de riesgos.',
          legalReference: 'NOM-035-STPS-2018 categorías A.5 y C.1',
        });
      }

      // Alerta: Sin descanso semanal
      if (!hasWeeklyRest) {
        alerts.push({
          ...baseInfo,
          type: 'NO_WEEKLY_REST',
          level: 'HIGH',
          title: `Sin día de descanso configurado (${emp.user.name})`,
          description: 'El empleado no tiene ningún día marcado como descanso semanal en su horario. Incumplimiento del art. 71 LFT.',
          metric: {
            weeklyOvertimeMinutes,
            weeklyOvertimeCapMinutes: weeklyCap,
            maxDailyOvertimeMinutes,
            consecutiveLongDays,
          },
          recommendation: 'Editar el empleado y marcar al menos 1 día como "Descanso" en su horario.',
          legalReference: 'LFT art. 71; NOM-035-STPS-2018 A.5',
        });
      }

      // Alerta: Día de descanso trabajado (art. 73 LFT — prima del 100%)
      // Una alerta por cada registro de la semana con isRestDayWorked=true.
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
          metric: {
            weeklyOvertimeMinutes,
            weeklyOvertimeCapMinutes: weeklyCap,
            maxDailyOvertimeMinutes,
            consecutiveLongDays,
          },
          recommendation: 'Pagar jornada completa con prima del 100% adicional. Si fue domingo, también aplica prima dominical (art. 71 LFT).',
          legalReference: 'LFT art. 73 (prima del 100% por descanso trabajado); art. 71 (prima dominical)',
        });
      }
    }

    // Ordenar: HIGH primero, luego MEDIUM, luego LOW
    const levelOrder: Record<AlertLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

    const summary = {
      total: alerts.length,
      high: alerts.filter((a) => a.level === 'HIGH').length,
      medium: alerts.filter((a) => a.level === 'MEDIUM').length,
      low: alerts.filter((a) => a.level === 'LOW').length,
      weekStart: toISODate(monday),
      weekEnd: toISODate(sunday),
      weeklyOvertimeCapMinutes: weeklyCap,
      employeesChecked: employees.length,
    };

    return NextResponse.json({ alerts, summary });
  } catch (error) {
    console.error('GET /api/alerts/nom-035 error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
