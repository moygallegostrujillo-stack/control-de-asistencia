// ============================================================
// POST /api/admin/recalc-overtime
// Recalcula horas extra (overtimeMinutes, dobles, triples, prima descanso,
// jornada nocturna) de los AttendanceRecords usando la lógica CORREGIDA
// de overtime-calculator.ts (fix #3 + fix #4).
//
// Bugs corregidos:
//   Fix #3 (tolerancia): antes se restaba checkoutToleranceMinutes del
//     overtime, subreportando ~10 min/día. Ahora NO se resta.
//   Fix #4 (jornada incluye comida, 20-ago-2026): la jornada de 8h
//     INCLUYE el descanso de 30min (LFT arts. 58/60/63). Por lo tanto:
//     - scheduledMinutes = rawScheduledMinutes (sin descontar comida).
//     - overtimeMinutes = workedMinutes(bruto) - scheduledMinutes.
//
// Este endpoint:
//   1. Requiere GENERAL_ADMIN.
//   2. Acepta { fromDate?, toDate?, sucursalId?, employeeId?, dryRun? } —
//      por defecto TODOS los registros con check-in y check-out.
//   3. Para cada registro, recalcula overtime con calculateOvertime (fix #3)
//      y weeklyAccumulated in-memory (orden cronológico por empleado).
//   4. Si dryRun=true, solo reporta qué cambiaría (no escribe).
//   5. Si dryRun=false, actualiza los campos de overtime en la BD y
//      registra auditoría (MANUAL_CORRECTION bulk-recalc-overtime).
//
// Campos actualizados: workedMinutes, overtimeMinutes, overtimeDoubleMinutes,
//   overtimeTripleMinutes, overtimeWeeklyAccumulated, status (PRESENT/LATE/
//   EARLY_LEAVE), isRestDayWorked, restDayWorkedMinutes, restDayPremiumMinutes,
//   isSunday, shiftType, nightMinutes.
// NO se tocan: checkInTime, checkOutTime, mealStart, mealEnd, correcciones
//   manuales, firma del empleado, isLocked, etc.
//
// Retorna: { scanned, changed, bySucursal, dryRun, details: [...] }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { toISODate, getDayOfWeek } from '@/lib/timezone';
import {
  calculateOvertime,
  findScheduleForDate,
  findRestScheduleForDate,
} from '@/lib/overtime-calculator';
import type { AttendanceRecord, Sucursal, WorkSchedule } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (user.role !== 'GENERAL_ADMIN') return forbiddenResponse();

    const body = await req.json().catch(() => ({}));
    const {
      fromDate,
      toDate,
      sucursalId,
      employeeId,
      dryRun = false,
    } = body as {
      fromDate?: string; // "YYYY-MM-DD"
      toDate?: string; // "YYYY-MM-DD"
      sucursalId?: string;
      employeeId?: string;
      dryRun?: boolean;
    };

    // Construir filtro where
    const where: {
      checkInTime: { not: null };
      checkOutTime: { not: null };
      date?: { gte?: Date; lte?: Date };
      sucursalId?: string;
      employeeId?: string;
    } = {
      checkInTime: { not: null },
      checkOutTime: { not: null },
    };
    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate + 'T00:00:00');
      if (toDate) where.date.lte = new Date(toDate + 'T23:59:59');
    }
    if (sucursalId) where.sucursalId = sucursalId;
    if (employeeId) where.employeeId = employeeId;

    // Cargar registros ordenados por empleado y fecha ASC (para acumular
    // weeklyAccumulated in-memory en orden cronológico).
    const records = await db.attendanceRecord.findMany({
      where,
      include: {
        employee: {
          include: {
            user: { select: { name: true } },
            workSchedules: true,
            sucursal: true,
          },
        },
        sucursal: true,
      },
      orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
    });

    // Helper: monday de la semana de una fecha (ISO, lun-dom).
    function mondayOfWeek(date: Date): string {
      const dow = getDayOfWeek(date); // 0=dom..6=sáb
      const daysFromMonday = (dow + 6) % 7; // lun=0..dom=6
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - daysFromMonday);
      return toISODate(d);
    }

    // Acumulador in-memory: employeeId -> { mondayISO -> acumuladoOvertime }
    // Acumulado = suma de overtimeDoubleMinutes + overtimeTripleMinutes de
    // registros PREVIOS de la misma semana (orden cronológico ASC).
    const weeklyAcc: Record<string, Record<string, number>> = {};

    interface ChangeDetail {
      recordId: string;
      employeeName: string;
      sucursalName: string;
      date: string;
      oldOvertimeMinutes: number | null;
      newOvertimeMinutes: number;
      oldDoubleMinutes: number | null;
      newDoubleMinutes: number;
      oldTripleMinutes: number | null;
      newTripleMinutes: number;
      oldStatus: string;
      newStatus: string;
      deltaOvertime: number; // new - old (para ver si sube o baja)
    }

    const changes: ChangeDetail[] = [];
    const bySucursal: Record<string, { scanned: number; changed: number }> = {};

    for (const r of records) {
      if (!r.checkInTime || !r.checkOutTime) continue;

      const empId = r.employeeId;
      const sucName = r.sucursal.name;
      if (!bySucursal[sucName]) bySucursal[sucName] = { scanned: 0, changed: 0 };
      bySucursal[sucName].scanned++;

      const schedules = r.employee.workSchedules;
      // Si existe un schedule de descanso semanal para esta fecha, es descanso trabajado.
      const restSchedule = findRestScheduleForDate(schedules, r.date);
      const workSchedule = findScheduleForDate(schedules, r.date);
      const schedule: WorkSchedule | null = restSchedule || workSchedule;

      // Calcular weeklyAccumulated para este registro
      if (!weeklyAcc[empId]) weeklyAcc[empId] = {};
      const monday = mondayOfWeek(r.date);
      const accumulated = weeklyAcc[empId][monday] || 0;

      const sucursalPick: Pick<Sucursal, 'checkoutToleranceMinutes' | 'mealDurationMinutes'> = {
        checkoutToleranceMinutes: r.sucursal.checkoutToleranceMinutes,
        mealDurationMinutes: r.sucursal.mealDurationMinutes,
      };

      // El registro de Prisma incluye relaciones; lo casteamos al tipo plano
      // que espera calculateOvertime (solo usa campos escalares).
      const recordForCalc = r as unknown as AttendanceRecord;

      const calc = calculateOvertime({
        record: recordForCalc,
        schedule,
        sucursal: sucursalPick,
        weeklyAccumulatedMinutes: accumulated,
      });

      // Comparar valores viejos vs nuevos
      const oldOt = r.overtimeMinutes ?? 0;
      const oldDouble = r.overtimeDoubleMinutes ?? 0;
      const oldTriple = r.overtimeTripleMinutes ?? 0;
      const oldStatus = r.status;

      const newOt = calc.overtimeMinutes;
      const newDouble = calc.overtimeDoubleMinutes;
      const newTriple = calc.overtimeTripleMinutes;
      const newStatus = calc.status;

      const changed =
        oldOt !== newOt ||
        oldDouble !== newDouble ||
        oldTriple !== newTriple ||
        oldStatus !== newStatus;

      if (changed) {
        changes.push({
          recordId: r.id,
          employeeName: r.employee.user.name,
          sucursalName: sucName,
          date: toISODate(r.date),
          oldOvertimeMinutes: r.overtimeMinutes,
          newOvertimeMinutes: newOt,
          oldDoubleMinutes: r.overtimeDoubleMinutes,
          newDoubleMinutes: newDouble,
          oldTripleMinutes: r.overtimeTripleMinutes,
          newTripleMinutes: newTriple,
          oldStatus,
          newStatus,
          deltaOvertime: newOt - oldOt,
        });
        bySucursal[sucName].changed++;

        if (!dryRun) {
          await db.attendanceRecord.update({
            where: { id: r.id },
            data: {
              workedMinutes: calc.workedMinutes,
              overtimeMinutes: newOt,
              overtimeDoubleMinutes: newDouble,
              overtimeTripleMinutes: newTriple,
              overtimeWeeklyAccumulated: accumulated,
              status: newStatus,
              isRestDayWorked: calc.isRestDayWorked,
              restDayWorkedMinutes: calc.restDayWorkedMinutes,
              restDayPremiumMinutes: calc.restDayPremiumMinutes,
              isSunday: calc.isSunday,
              shiftType: calc.shiftType,
              nightMinutes: calc.nightMinutes,
            },
          });
        }
      }

      // Actualizar acumulador in-memory con el overtime del día (dobles+triples).
      // Solo sumamos si NO es descanso trabajado (el descanso no acumula tope semanal).
      if (!calc.isRestDayWorked) {
        weeklyAcc[empId][monday] = accumulated + newDouble + newTriple;
      }
    }

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'MANUAL_CORRECTION',
      entityType: 'ATTENDANCE_RECORD',
      entityId: 'bulk-recalc-overtime',
      ipAddress: ip,
      userAgent: ua,
      details: {
        performedBy: user.email,
        reason: dryRun
          ? 'Recálculo de overtime (dry-run) — fix #3 bug tolerancia + bug comida'
          : 'Recálculo de overtime — fix #3 bug tolerancia + bug comida corregido',
        dateRange: {
          from: fromDate || '(todos)',
          to: toDate || '(todos)',
        },
        filters: { sucursalId: sucursalId || null, employeeId: employeeId || null },
        scanned: records.length,
        changed: changes.length,
        bySucursal,
        dryRun,
        sampleChanges: changes.slice(0, 50),
      },
    });

    return NextResponse.json({
      scanned: records.length,
      changed: changes.length,
      bySucursal,
      dryRun,
      details: changes,
    });
  } catch (error) {
    console.error('Recalc overtime error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
