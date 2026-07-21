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

    // SUCURSAL_ADMIN / SUPERVISOR: forzar su sucursal
    const sucursalId =
      user.role === 'SUCURSAL_ADMIN' || user.role === 'SUPERVISOR'
        ? user.sucursalId
        : requestedSucursalId;

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

    // Los campos overtimeDoubleMinutes / overtimeTripleMinutes / isRestDayWorked /
    // restDayWorkedMinutes / restDayPremiumMinutes / isSunday ya vienen persistidos
    // por el check-out (reforma LFT 2027). NO se recalculan aquí.

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
        totalDoubleMinutes: number;
        totalTripleMinutes: number;
        restDayWorkedCount: number;
        totalRestDayWorkedMinutes: number;
        totalRestDayPremiumMinutes: number;
        days: number;
        dailyRecords: any[];
      }
    >();

    for (const r of records) {
      // Solo registros con check-in y check-out
      if (!r.checkInTime || !r.checkOutTime) continue;

      const otMin = r.overtimeMinutes ?? 0;
      const doubleMin = r.overtimeDoubleMinutes ?? 0;
      const tripleMin = r.overtimeTripleMinutes ?? 0;
      const restWorkedMin = r.restDayWorkedMinutes ?? 0;
      const restPremiumMin = r.restDayPremiumMinutes ?? 0;
      const workedMin = r.workedMinutes ?? 0;

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
          totalDoubleMinutes: 0,
          totalTripleMinutes: 0,
          restDayWorkedCount: 0,
          totalRestDayWorkedMinutes: 0,
          totalRestDayPremiumMinutes: 0,
          days: 0,
          dailyRecords: [],
        });
      }
      const e = byEmployeeMap.get(key)!;
      e.totalOvertimeMinutes += otMin;
      e.totalWorkedMinutes += workedMin;
      e.totalDoubleMinutes += doubleMin;
      e.totalTripleMinutes += tripleMin;
      if (r.isRestDayWorked) {
        e.restDayWorkedCount += 1;
        e.totalRestDayWorkedMinutes += restWorkedMin;
        e.totalRestDayPremiumMinutes += restPremiumMin;
      }
      e.days += 1;
      e.dailyRecords.push({
        date: toISODate(r.date),
        checkIn: formatTimeInMexico(r.checkInTime),
        checkOut: formatTimeInMexico(r.checkOutTime),
        workedMinutes: workedMin,
        overtimeMinutes: otMin,
        overtimeHours: minutesToHours(otMin),
        // Reforma LFT 2027 — dobles/triples persistidos por check-out
        overtimeDoubleMinutes: doubleMin,
        overtimeTripleMinutes: tripleMin,
        overtimeDoubleHours: minutesToHours(doubleMin),
        overtimeTripleHours: minutesToHours(tripleMin),
        // Prima por descanso trabajado (art. 73 LFT)
        isRestDayWorked: r.isRestDayWorked,
        restDayWorkedMinutes: restWorkedMin,
        restDayPremiumMinutes: restPremiumMin,
        isSunday: r.isSunday,
        status: r.status,
      });
    }

    // Convertir a arreglo, calcular horas y ordenar por más horas extra
    const byEmployee = Array.from(byEmployeeMap.values())
      .map((e) => ({
        ...e,
        totalOvertimeHours: minutesToHours(e.totalOvertimeMinutes),
        totalWorkedHours: minutesToHours(e.totalWorkedMinutes),
        totalDoubleHours: minutesToHours(e.totalDoubleMinutes),
        totalTripleHours: minutesToHours(e.totalTripleMinutes),
        totalRestDayWorkedHours: minutesToHours(e.totalRestDayWorkedMinutes),
        totalRestDayPremiumHours: minutesToHours(e.totalRestDayPremiumMinutes),
      }))
      .sort((a, b) => b.totalOvertimeMinutes - a.totalOvertimeMinutes);

    const totalEmployees = byEmployee.length;
    const totalOvertimeMinutes = byEmployee.reduce(
      (s, e) => s + e.totalOvertimeMinutes,
      0
    );
    const totalDoubleMinutes = byEmployee.reduce(
      (s, e) => s + e.totalDoubleMinutes,
      0
    );
    const totalTripleMinutes = byEmployee.reduce(
      (s, e) => s + e.totalTripleMinutes,
      0
    );
    const totalRestDayWorkedCount = byEmployee.reduce(
      (s, e) => s + e.restDayWorkedCount,
      0
    );
    const totalRestDayPremiumMinutes = byEmployee.reduce(
      (s, e) => s + e.totalRestDayPremiumMinutes,
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
        totalDoubleHours: minutesToHours(totalDoubleMinutes),
        totalTripleHours: minutesToHours(totalTripleMinutes),
        totalRestDayWorkedCount,
        totalRestDayPremiumHours: minutesToHours(totalRestDayPremiumMinutes),
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
