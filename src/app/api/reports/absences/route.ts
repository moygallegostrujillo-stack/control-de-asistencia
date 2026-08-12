// ============================================================
// /api/reports/absences — GET
//   Reporte de ausencias en un rango.
//   fix #11 — usa isAbsentOnDate (schedule-aware: omite domingos,
//             feriados, vacaciones y días sin horario).
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

    // Limit end to today — no contar días futuros como ausencia
    const effectiveEnd = getEffectiveEnd(end);

    // Generar arreglo de días en el rango
    const days: Date[] = [];
    const cursor = new Date(start);
    while (cursor <= effectiveEnd) {
      days.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    // Cargar datos de manera agrupada (eficiente)
    const employees = await loadActiveEmployees(sucursalId || undefined);
    const employeeIds = employees.map((e) => e.id);

    const [schedulesByEmp, recordsByEmp, vacations, holidays] =
      await Promise.all([
        loadSchedules(employeeIds),
        loadRecords(start, end, sucursalId || undefined),
        loadApprovedVacations(start, end, sucursalId || undefined),
        loadHolidays(start, end),
      ]);

    // Agrupar vacaciones por empleado
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

    // Construir byEmployee
    const byEmployee: any[] = [];
    for (const emp of employees) {
      const empSchedules = (schedulesByEmp[emp.id] || []).map((s) => ({
        dayOfWeek: s.dayOfWeek,
        isWeeklyRest: s.isWeeklyRest,
      }));
      const empRecords = recordsByEmp[emp.id] || [];
      const empVacations = vacationsByEmp[emp.id] || [];
      const sucursalName = emp.sucursal?.codigoLocal
        ? `Local ${emp.sucursal.codigoLocal} — ${emp.sucursal.name}`
        : emp.sucursal?.name || '—';

      const absentDates: string[] = [];
      for (const day of days) {
        const result = isAbsentOnDate(day, {
          employee: { id: emp.id, isActive: emp.isActive },
          schedules: empSchedules,
          records: empRecords,
          vacations: empVacations as any,
          holidays,
        });
        if (result.absent) {
          absentDates.push(toISODate(day));
        }
      }

      if (absentDates.length > 0) {
        absentDates.sort();
        byEmployee.push({
          employeeId: emp.id,
          name: emp.user.name,
          employeeNumber: emp.employeeNumber,
          sucursalId: emp.sucursal?.id || null,
          sucursalName,
          department: emp.department,
          position: emp.position,
          absentDays: absentDates.length,
          absentDates,
        });
      }
    }

    // Ordenar por más ausencias primero
    byEmployee.sort((a, b) => b.absentDays - a.absentDays);

    // bySucursal en summary
    const bySucursalMap = new Map<
      string,
      {
        sucursalId: string;
        sucursalName: string;
        totalEmployees: number;
        totalAbsentDays: number;
      }
    >();
    for (const e of byEmployee) {
      const key = e.sucursalId || '—';
      if (!bySucursalMap.has(key)) {
        bySucursalMap.set(key, {
          sucursalId: key,
          sucursalName: e.sucursalName,
          totalEmployees: 0,
          totalAbsentDays: 0,
        });
      }
      const s = bySucursalMap.get(key)!;
      s.totalEmployees += 1;
      s.totalAbsentDays += e.absentDays;
    }

    const totalAbsents = byEmployee.reduce((s, e) => s + e.absentDays, 0);

    // --- Auditoría (art. 132 fr. VII LFT — trazabilidad de reportes) ---
    try {
      const { ip, ua } = getIpAndUA(req);
      await auditLog({
        userId: user.id,
        action: 'GENERATE_ABSENCES_REPORT',
        entityType: 'REPORT',
        entityId: null,
        sucursalId: sucursalId || null,
        ipAddress: ip,
        userAgent: ua,
        details: {
          tipo: 'ABSENCES',
          periodo: { start: range.startISO, end: range.endISO },
          sucursalId,
          registros: byEmployee.length,
        },
      });
    } catch (auditErr) {
      console.error('auditLog (absences) error:', auditErr);
    }

    return NextResponse.json({
      byEmployee,
      summary: {
        totalAbsents,
        totalEmployeesWithAbsences: byEmployee.length,
        bySucursal: Array.from(bySucursalMap.values()),
      },
      period: buildPeriodResponseEffective(range, effectiveEnd),
      totalWorkDays: days.length,
    });
  } catch (error) {
    console.error('GET /api/reports/absences error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
