// ============================================================
// /api/reports/employee-overtime — GET
//   Reporte de horas extra acumuladas por empleado en un rango,
//   con desglose día por día.
//   fix #2 — calculateOvertime aplica checkoutToleranceMinutes.
//   fix #6 — acumulado por empleado + dailyRecords.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
} from '@/lib/auth';
import {
  toISODate,
  getMexicoTodayISO,
  minutesToHours,
  formatTimeInMexico,
} from '@/lib/timezone';
import { calculateOvertime, findScheduleForDate } from '@/lib/overtime-calculator';
import type { WorkSchedule } from '@prisma/client';

const MAX_RANGE_DAYS = 90;

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
    const employeeIdParam = searchParams.get('employeeId');

    // SUCURSAL_ADMIN: forzar su sucursal
    const sucursalId =
      user.role === 'SUCURSAL_ADMIN' ? user.sucursalId : requestedSucursalId;

    // Validar rango
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
    const diffDays =
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Rango máximo permitido: ${MAX_RANGE_DAYS} días` },
        { status: 400 }
      );
    }

    // Construir filtro
    const where: any = { date: { gte: start, lte: end } };
    if (sucursalId) where.sucursalId = sucursalId;
    if (employeeIdParam) where.employeeId = employeeIdParam;

    const records = await db.attendanceRecord.findMany({
      where,
      include: {
        employee: {
          include: {
            user: { select: { name: true } },
            sucursal: { select: { id: true, name: true, codigoLocal: true } },
          },
        },
        sucursal: {
          select: {
            id: true,
            name: true,
            codigoLocal: true,
            checkoutToleranceMinutes: true,
          },
        },
      },
      orderBy: [{ employee: { employeeNumber: 'asc' } }, { date: 'asc' }],
    });

    // Cargar schedules
    const employeeIds = [...new Set(records.map((r) => r.employeeId))];
    const schedules = employeeIds.length
      ? await db.workSchedule.findMany({
          where: { employeeId: { in: employeeIds } },
        })
      : [];
    const schedulesByEmp: Record<string, WorkSchedule[]> = {};
    for (const s of schedules) {
      if (!schedulesByEmp[s.employeeId]) schedulesByEmp[s.employeeId] = [];
      schedulesByEmp[s.employeeId].push(s);
    }

    // Agrupar por empleado
    const byEmployeeMap = new Map<
      string,
      {
        employeeId: string;
        name: string;
        employeeNumber: string;
        sucursalName: string;
        sucursalCodigoLocal: string | null;
        totalOvertimeMinutes: number;
        totalWorkedMinutes: number;
        days: number;
        dailyRecords: any[];
      }
    >();

    for (const r of records) {
      // Solo registros con check-in y check-out
      if (!r.checkInTime || !r.checkOutTime) continue;

      const sched = findScheduleForDate(
        schedulesByEmp[r.employeeId] || [],
        r.date
      );
      const ot = calculateOvertime({
        record: r,
        schedule: sched,
        sucursal: {
          checkoutToleranceMinutes: r.sucursal.checkoutToleranceMinutes,
        },
      });

      const key = r.employeeId;
      if (!byEmployeeMap.has(key)) {
        byEmployeeMap.set(key, {
          employeeId: r.employeeId,
          name: r.employee.user.name,
          employeeNumber: r.employee.employeeNumber,
          sucursalName: r.sucursal.name,
          sucursalCodigoLocal: r.sucursal.codigoLocal,
          totalOvertimeMinutes: 0,
          totalWorkedMinutes: 0,
          days: 0,
          dailyRecords: [],
        });
      }
      const e = byEmployeeMap.get(key)!;
      e.totalOvertimeMinutes += ot.overtimeMinutes;
      e.totalWorkedMinutes += ot.workedMinutes ?? 0;
      e.days += 1;
      e.dailyRecords.push({
        date: toISODate(r.date),
        checkIn: formatTimeInMexico(r.checkInTime),
        checkOut: formatTimeInMexico(r.checkOutTime),
        workedMinutes: ot.workedMinutes ?? 0,
        overtimeMinutes: ot.overtimeMinutes,
        overtimeHours: ot.overtimeHours,
        status: r.status,
      });
    }

    // Convertir a arreglo, calcular horas y ordenar por más horas extra
    const byEmployee = Array.from(byEmployeeMap.values())
      .map((e) => ({
        ...e,
        totalOvertimeHours: minutesToHours(e.totalOvertimeMinutes),
        totalWorkedHours: minutesToHours(e.totalWorkedMinutes),
      }))
      .sort((a, b) => b.totalOvertimeMinutes - a.totalOvertimeMinutes);

    const totalEmployees = byEmployee.length;
    const totalOvertimeMinutes = byEmployee.reduce(
      (s, e) => s + e.totalOvertimeMinutes,
      0
    );
    const totalOvertimeHours = minutesToHours(totalOvertimeMinutes);
    const avgPerEmployee =
      totalEmployees > 0
        ? minutesToHours(Math.round(totalOvertimeMinutes / totalEmployees))
        : 0;

    return NextResponse.json({
      byEmployee,
      summary: {
        totalEmployees,
        totalOvertimeHours,
        avgPerEmployee,
      },
      period: { start: startDateStr, end: endDateStr },
    });
  } catch (error) {
    console.error('GET /api/reports/employee-overtime error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
