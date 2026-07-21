// ============================================================
// /api/reports/overtime — GET
//   Reporte de horas extra en un rango.
//   fix #2 — calculateOvertime aplica checkoutToleranceMinutes.
//   fix #6 — desglose por empleado (byEmployee) acumulado.
//   Valida rango máximo de 90 días.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
} from '@/lib/auth';
import { toISODate, getMexicoTodayISO, minutesToHours } from '@/lib/timezone';

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
      orderBy: [{ date: 'asc' }, { employee: { employeeNumber: 'asc' } }],
    });

    // Los campos overtimeDoubleMinutes / overtimeTripleMinutes / isRestDayWorked /
    // restDayWorkedMinutes / restDayPremiumMinutes / isSunday ya vienen persistidos
    // por el check-out (reforma LFT 2027). NO se recalculan aquí.

    // Enriquecer registros: sólo los que tienen check-in y check-out.
    const enrichedRecords = records
      .filter((r) => r.checkInTime && r.checkOutTime)
      .map((r) => {
        const doubleMin = r.overtimeDoubleMinutes ?? 0;
        const tripleMin = r.overtimeTripleMinutes ?? 0;
        const restWorkedMin = r.restDayWorkedMinutes ?? 0;
        const restPremiumMin = r.restDayPremiumMinutes ?? 0;
        const otMin = r.overtimeMinutes ?? 0;
        return {
          id: r.id,
          employeeId: r.employeeId,
          employeeNumber: r.employee.employeeNumber,
          name: r.employee.user.name,
          department: r.employee.department,
          position: r.employee.position,
          sucursalId: r.sucursalId,
          sucursalName: r.sucursal.name,
          sucursalCodigoLocal: r.sucursal.codigoLocal,
          date: toISODate(r.date),
          checkInTime: r.checkInTime,
          checkOutTime: r.checkOutTime,
          status: r.status,
          workedMinutes: r.workedMinutes ?? 0,
          overtimeMinutes: otMin,
          overtimeHours: minutesToHours(otMin),
          // Reforma LFT 2027 — art. 66 (dobles) / art. 68 (triples)
          overtimeDoubleMinutes: doubleMin,
          overtimeTripleMinutes: tripleMin,
          overtimeDoubleHours: minutesToHours(doubleMin),
          overtimeTripleHours: minutesToHours(tripleMin),
          // Prima por descanso trabajado (art. 73 LFT)
          isRestDayWorked: r.isRestDayWorked,
          restDayWorkedMinutes: restWorkedMin,
          restDayPremiumMinutes: restPremiumMin,
          isSunday: r.isSunday,
        };
      });

    // byEmployee — fix #6
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
      }
    >();
    for (const r of enrichedRecords) {
      const key = r.employeeId;
      if (!byEmployeeMap.has(key)) {
        byEmployeeMap.set(key, {
          employeeId: r.employeeId,
          name: r.name,
          employeeNumber: r.employeeNumber,
          sucursalName: r.sucursalName,
          sucursalCodigoLocal: r.sucursalCodigoLocal,
          totalOvertimeMinutes: 0,
          totalWorkedMinutes: 0,
          totalDoubleMinutes: 0,
          totalTripleMinutes: 0,
          restDayWorkedCount: 0,
          totalRestDayWorkedMinutes: 0,
          totalRestDayPremiumMinutes: 0,
          days: 0,
        });
      }
      const e = byEmployeeMap.get(key)!;
      e.totalOvertimeMinutes += r.overtimeMinutes;
      e.totalWorkedMinutes += r.workedMinutes;
      e.totalDoubleMinutes += r.overtimeDoubleMinutes;
      e.totalTripleMinutes += r.overtimeTripleMinutes;
      if (r.isRestDayWorked) {
        e.restDayWorkedCount += 1;
        e.totalRestDayWorkedMinutes += r.restDayWorkedMinutes;
        e.totalRestDayPremiumMinutes += r.restDayPremiumMinutes;
      }
      e.days += 1;
    }
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

    // bySucursal — agregado por sucursal
    const bySucursalMap = new Map<
      string,
      {
        sucursalId: string;
        sucursalName: string;
        sucursalCodigoLocal: string | null;
        totalRecords: number;
        totalWorkedMinutes: number;
        totalOvertimeMinutes: number;
        totalDoubleMinutes: number;
        totalTripleMinutes: number;
        restDayWorkedCount: number;
        totalRestDayPremiumMinutes: number;
      }
    >();
    for (const r of enrichedRecords) {
      const key = r.sucursalId;
      if (!bySucursalMap.has(key)) {
        bySucursalMap.set(key, {
          sucursalId: r.sucursalId,
          sucursalName: r.sucursalName,
          sucursalCodigoLocal: r.sucursalCodigoLocal,
          totalRecords: 0,
          totalWorkedMinutes: 0,
          totalOvertimeMinutes: 0,
          totalDoubleMinutes: 0,
          totalTripleMinutes: 0,
          restDayWorkedCount: 0,
          totalRestDayPremiumMinutes: 0,
        });
      }
      const s = bySucursalMap.get(key)!;
      s.totalRecords += 1;
      s.totalWorkedMinutes += r.workedMinutes;
      s.totalOvertimeMinutes += r.overtimeMinutes;
      s.totalDoubleMinutes += r.overtimeDoubleMinutes;
      s.totalTripleMinutes += r.overtimeTripleMinutes;
      if (r.isRestDayWorked) {
        s.restDayWorkedCount += 1;
        s.totalRestDayPremiumMinutes += r.restDayPremiumMinutes;
      }
    }
    const bySucursal = Array.from(bySucursalMap.values()).map((s) => ({
      ...s,
      totalWorkedHours: minutesToHours(s.totalWorkedMinutes),
      totalOvertimeHours: minutesToHours(s.totalOvertimeMinutes),
      totalDoubleHours: minutesToHours(s.totalDoubleMinutes),
      totalTripleHours: minutesToHours(s.totalTripleMinutes),
      totalRestDayPremiumHours: minutesToHours(s.totalRestDayPremiumMinutes),
    }));

    const totalOvertimeMinutes = enrichedRecords.reduce(
      (sum, r) => sum + r.overtimeMinutes,
      0
    );
    const totalDoubleMinutes = enrichedRecords.reduce(
      (sum, r) => sum + r.overtimeDoubleMinutes,
      0
    );
    const totalTripleMinutes = enrichedRecords.reduce(
      (sum, r) => sum + r.overtimeTripleMinutes,
      0
    );
    const totalRestDayWorkedCount = enrichedRecords.filter(
      (r) => r.isRestDayWorked
    ).length;
    const totalRestDayPremiumMinutes = enrichedRecords.reduce(
      (sum, r) => sum + (r.isRestDayWorked ? r.restDayPremiumMinutes : 0),
      0
    );
    const totalEmployees = byEmployee.length;
    const totalOvertimeHours = minutesToHours(totalOvertimeMinutes);
    const avgPerEmployee =
      totalEmployees > 0
        ? minutesToHours(Math.round(totalOvertimeMinutes / totalEmployees))
        : 0;

    return NextResponse.json({
      records: enrichedRecords,
      bySucursal,
      byEmployee,
      summary: {
        totalEmployees,
        totalOvertimeHours,
        avgPerEmployee,
        totalRecords: enrichedRecords.length,
        totalDoubleHours: minutesToHours(totalDoubleMinutes),
        totalTripleHours: minutesToHours(totalTripleMinutes),
        totalRestDayWorkedCount,
        totalRestDayPremiumHours: minutesToHours(totalRestDayPremiumMinutes),
      },
      period: { start: startDateStr, end: endDateStr },
    });
  } catch (error) {
    console.error('GET /api/reports/overtime error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
