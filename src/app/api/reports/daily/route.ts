// ============================================================
// /api/reports/daily — GET
//   Reporte diario de asistencia.
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
  getMexicoTodayISO,
  minutesToHours,
} from '@/lib/timezone';
import { computeAbsentsForDate } from '@/lib/absence-calculator';
import { calculateOvertime, findScheduleForDate } from '@/lib/overtime-calculator';
import type { WorkSchedule } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date') || getMexicoTodayISO();
    const requestedSucursalId = searchParams.get('sucursalId');

    // SUCURSAL_ADMIN: sólo puede ver su propia sucursal.
    const sucursalId =
      user.role === 'SUCURSAL_ADMIN' ? user.sucursalId : requestedSucursalId;

    // Rango del día (UTC midnight a UTC 23:59:59) para el @db.Date
    const dateStart = new Date(`${dateStr}T00:00:00.000Z`);
    const dateEnd = new Date(`${dateStr}T23:59:59.999Z`);

    // Sucursales visibles al usuario
    const sucursalWhere = isGeneralAdmin(user)
      ? { isActive: true }
      : { id: user.sucursalId || '__NONE__' };
    const sucursales = await db.sucursal.findMany({
      where: sucursalWhere,
      orderBy: { name: 'asc' },
    });

    // Registros del día, filtrados por sucursal si aplica
    const recordWhere: any = { date: { gte: dateStart, lte: dateEnd } };
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

    // Enriquecer registros con overtime (fix #2)
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
        justificationStatus: r.justificationStatus,
      };
    });

    // Desglose por sucursal — fix #12: usar computeAbsentsForDate
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
    }[] = [];
    for (const suc of sucursales) {
      const sucRecords = enrichedRecords.filter((r) => r.sucursalId === suc.id);
      const absents = await computeAbsentsForDate(dateStart, suc.id);
      bySucursal.push({
        sucursalId: suc.id,
        name: suc.name,
        codigoLocal: suc.codigoLocal,
        total: sucRecords.length + absents.length,
        present: sucRecords.filter((r) => r.status === 'PRESENT').length,
        late: sucRecords.filter((r) => r.status === 'LATE').length,
        absent: absents.length, // fix #12 — coincidente con dashboard
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
      });
    }

    // Resumen total
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
    };

    // Datos de la empresa — fix #3
    const company = await db.company.findUnique({
      where: { id: 'singleton' },
    });

    return NextResponse.json({
      date: dateStr,
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
