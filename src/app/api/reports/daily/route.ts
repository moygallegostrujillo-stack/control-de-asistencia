// ============================================================
// /api/reports/daily — GET
//   Reporte diario de asistencia. Acepta:
//     ?date=YYYY-MM-DD                  — un solo día (retrocompat)
//     ?startDate=&endDate=YYYY-MM-DD    — rango libre (sin tope máximo)
//     ?sucursalId=...                   — filtra por sucursal
//
//   Para rangos multi-día:
//     - records: unión de todos los días (orden: fecha asc, luego
//       sucursalId, luego employeeNumber).
//     - bySucursal: totales consolidados sumando cada día.
//       Ausentes se calculan llamando a computeAbsentsForDate por
//       cada día del rango (acumula).
//     - summary: suma de los totales de bySucursal.
//     - Respuesta: `period: { start, end }` en lugar de `date`.
//
//   fix #2 — horas extra con tolerancia (calculateOvertime).
//   fix #3 — incluye datos de la empresa (Company) para headers.
//   fix #12 — desglose por sucursal usando computeAbsentsForDate
//             para coincidir exactamente con el dashboard.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
  isGeneralAdmin,
} from '@/lib/auth';
import {
  toISODate,
  minutesToHours,
} from '@/lib/timezone';
import { computeAbsentsForDate } from '@/lib/absence-calculator';
import { calculateOvertime, findScheduleForDate } from '@/lib/overtime-calculator';
import type { WorkSchedule } from '@prisma/client';
import { parseDateRange, buildPeriodResponse } from '@/lib/reports';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const requestedSucursalId = searchParams.get('sucursalId');

    // Retrocompat: si llega `date`, úsalo como start=end=date.
    let effectiveStart = startDateParam;
    let effectiveEnd = endDateParam;
    if (dateParam) {
      effectiveStart = dateParam;
      effectiveEnd = dateParam;
    }

    // SUCURSAL_ADMIN / SUPERVISOR: sólo puede ver su propia sucursal.
    const sucursalId =
      user.role === 'SUCURSAL_ADMIN' || user.role === 'SUPERVISOR'
        ? user.sucursalId
        : requestedSucursalId;

    // Validar rango (sin tope máximo).
    const { range, errorResponse } = parseDateRange(effectiveStart, effectiveEnd);
    if (!range) return errorResponse!;
    const { start, end } = range;

    // Sucursales visibles al usuario
    const sucursalWhere = isGeneralAdmin(user)
      ? { isActive: true }
      : { id: user.sucursalId || '__NONE__' };
    const sucursales = await db.sucursal.findMany({
      where: sucursalWhere,
      orderBy: { name: 'asc' },
    });

    // Registros de TODO el rango, filtrados por sucursal si aplica.
    const recordWhere: any = { date: { gte: start, lte: end } };
    if (sucursalId) recordWhere.sucursalId = sucursalId;

    const records = await db.attendanceRecord.findMany({
      where: recordWhere,
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
      orderBy: [
        { date: 'asc' },
        { sucursalId: 'asc' },
        { employee: { employeeNumber: 'asc' } },
      ],
    });

    // Cargar schedules de los empleados involucrados (para calculateOvertime)
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

    // Enriquecer registros con overtime (fix #2) + dobles/triples y prima descanso
    // (leídos directamente de la BD — ya persistidos por check-out, reforma LFT 2027).
    const enrichedRecords = records.map((r) => {
      const suc = r.sucursal;
      const sched = findScheduleForDate(
        schedulesByEmp[r.employeeId] || [],
        r.date
      );
      const ot = calculateOvertime({
        record: r,
        schedule: sched,
        sucursal: { checkoutToleranceMinutes: suc.checkoutToleranceMinutes },
      });
      // dobles/triples y prima descanso vienen persistidos por check-out
      // (calculateOvertime no recibe weeklyAccumulatedMinutes aquí → no debe usarse
      //  para dobles/triples; se leen directamente de la BD).
      const doubleMin = r.overtimeDoubleMinutes ?? 0;
      const tripleMin = r.overtimeTripleMinutes ?? 0;
      const restWorkedMin = r.restDayWorkedMinutes ?? 0;
      const restPremiumMin = r.restDayPremiumMinutes ?? 0;
      return {
        id: r.id,
        employeeId: r.employeeId,
        employeeNumber: r.employee.employeeNumber,
        name: r.employee.user.name,
        sucursalId: r.sucursalId,
        sucursalName: suc.name,
        sucursalCodigoLocal: suc.codigoLocal,
        date: toISODate(r.date),
        checkInTime: r.checkInTime,
        checkOutTime: r.checkOutTime,
        mealStart: r.mealStart,
        mealEnd: r.mealEnd,
        mealDurationMinutes: r.mealDurationMinutes,
        mealExceeded: r.mealExceeded,
        restStart: r.restStart,
        restEnd: r.restEnd,
        restDurationMinutes: r.restDurationMinutes,
        restExceeded: r.restExceeded,
        status: r.status,
        workedMinutes: ot.workedMinutes,
        overtimeMinutes: ot.overtimeMinutes,
        overtimeHours: ot.overtimeHours,
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
        justificationStatus: r.justificationStatus,
      };
    });

    // Enumerar días del rango (UTC 00:00 de cada día — mismo patrón
    // que usa computeAbsentsForDate internamente para el filtrado).
    const days: Date[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      days.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    // Desglose por sucursal — fix #12: usar computeAbsentsForDate.
    // Para rangos multi-día, acumulamos ausentes día por día.
    const bySucursal: {
      sucursalId: string;
      name: string;
      codigoLocal: string | null;
      total: number;
      present: number;
      late: number;
      absent: number;
      earlyLeave: number;
      onBreak: number;
      breakExceeded: number;
      totalOvertimeMinutes: number;
      totalOvertimeHours: number;
      // Reforma LFT 2027 — dobles/triples y prima descanso (art. 66/68/73)
      totalOvertimeDoubleMinutes: number;
      totalOvertimeTripleMinutes: number;
      totalOvertimeDoubleHours: number;
      totalOvertimeTripleHours: number;
      restDayWorkedCount: number;
      totalRestDayWorkedMinutes: number;
      totalRestDayPremiumMinutes: number;
      totalRestDayPremiumHours: number;
    }[] = [];
    for (const suc of sucursales) {
      const sucRecords = enrichedRecords.filter((r) => r.sucursalId === suc.id);
      // Acumular ausentes en todos los días del rango.
      let totalAbsents = 0;
      for (const day of days) {
        const absents = await computeAbsentsForDate(day, suc.id);
        totalAbsents += absents.length;
      }
      const sucDoubleMin = sucRecords.reduce((s, r) => s + (r.overtimeDoubleMinutes || 0), 0);
      const sucTripleMin = sucRecords.reduce((s, r) => s + (r.overtimeTripleMinutes || 0), 0);
      const sucRestWorkedMin = sucRecords.reduce((s, r) => s + (r.restDayWorkedMinutes || 0), 0);
      const sucRestPremiumMin = sucRecords.reduce((s, r) => s + (r.restDayPremiumMinutes || 0), 0);
      bySucursal.push({
        sucursalId: suc.id,
        name: suc.name,
        codigoLocal: suc.codigoLocal,
        total: sucRecords.length + totalAbsents,
        present: sucRecords.filter((r) => r.status === 'PRESENT').length,
        late: sucRecords.filter((r) => r.status === 'LATE').length,
        absent: totalAbsents, // fix #12 — coincidente con dashboard
        earlyLeave: sucRecords.filter((r) => r.status === 'EARLY_LEAVE').length,
        onBreak: sucRecords.filter(
          (r) => (r.mealStart && !r.mealEnd) || (r.restStart && !r.restEnd)
        ).length,
        breakExceeded: sucRecords.filter(
          (r) => r.mealExceeded || r.restExceeded
        ).length,
        totalOvertimeMinutes: sucRecords.reduce(
          (sum, r) => sum + (r.overtimeMinutes || 0),
          0
        ),
        totalOvertimeHours: minutesToHours(
          sucRecords.reduce((sum, r) => sum + (r.overtimeMinutes || 0), 0)
        ),
        totalOvertimeDoubleMinutes: sucDoubleMin,
        totalOvertimeTripleMinutes: sucTripleMin,
        totalOvertimeDoubleHours: minutesToHours(sucDoubleMin),
        totalOvertimeTripleHours: minutesToHours(sucTripleMin),
        restDayWorkedCount: sucRecords.filter((r) => r.isRestDayWorked).length,
        totalRestDayWorkedMinutes: sucRestWorkedMin,
        totalRestDayPremiumMinutes: sucRestPremiumMin,
        totalRestDayPremiumHours: minutesToHours(sucRestPremiumMin),
      });
    }

    // Resumen total
    const totalDoubleMinutes = bySucursal.reduce((s, x) => s + x.totalOvertimeDoubleMinutes, 0);
    const totalTripleMinutes = bySucursal.reduce((s, x) => s + x.totalOvertimeTripleMinutes, 0);
    const totalRestPremiumMin = bySucursal.reduce((s, x) => s + x.totalRestDayPremiumMinutes, 0);
    const summary = {
      total: bySucursal.reduce((s, x) => s + x.total, 0),
      present: bySucursal.reduce((s, x) => s + x.present, 0),
      late: bySucursal.reduce((s, x) => s + x.late, 0),
      absent: bySucursal.reduce((s, x) => s + x.absent, 0),
      earlyLeave: bySucursal.reduce((s, x) => s + x.earlyLeave, 0),
      onBreak: bySucursal.reduce((s, x) => s + x.onBreak, 0),
      breakExceeded: bySucursal.reduce((s, x) => s + x.breakExceeded, 0),
      totalOvertimeMinutes: bySucursal.reduce(
        (s, x) => s + x.totalOvertimeMinutes,
        0
      ),
      totalOvertimeHours: minutesToHours(
        bySucursal.reduce((s, x) => s + x.totalOvertimeMinutes, 0)
      ),
      // Reforma LFT 2027 — art. 66 (dobles) / art. 68 (triples) / art. 73 (prima descanso)
      totalOvertimeDoubleMinutes: totalDoubleMinutes,
      totalOvertimeTripleMinutes: totalTripleMinutes,
      totalOvertimeDoubleHours: minutesToHours(totalDoubleMinutes),
      totalOvertimeTripleHours: minutesToHours(totalTripleMinutes),
      totalRestDayWorkedCount: bySucursal.reduce((s, x) => s + x.restDayWorkedCount, 0),
      totalRestDayWorkedMinutes: bySucursal.reduce((s, x) => s + x.totalRestDayWorkedMinutes, 0),
      totalRestDayPremiumMinutes: totalRestPremiumMin,
      totalRestDayPremiumHours: minutesToHours(totalRestPremiumMin),
    };

    // Datos de la empresa — fix #3
    const company = await db.company.findUnique({
      where: { id: 'singleton' },
    });

    return NextResponse.json({
      period: buildPeriodResponse(range),
      records: enrichedRecords,
      bySucursal,
      summary,
      company,
    });
  } catch (error) {
    console.error('GET /api/reports/daily error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
