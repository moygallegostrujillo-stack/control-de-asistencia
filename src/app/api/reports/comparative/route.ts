// ============================================================
// /api/reports/comparative — GET
//   Reporte comparativo entre sucursales.
//   Acceso: sólo GENERAL_ADMIN (middleware-enforced + verificación).
//   fix #11 — absentDays con isAbsentOnDate (schedule-aware).
//   fix #2  — overtimeHours con calculateOvertime (tolerancia).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isGeneralAdmin,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { toISODate, minutesToHours } from '@/lib/timezone';
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
    // Doble verificación — middleware ya filtra, pero revalidamos.
    if (!isGeneralAdmin(user)) return forbiddenResponse();

    const { searchParams } = new URL(req.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // Validar rango (sin tope máximo)
    const { range, errorResponse } = parseDateRange(startDateStr, endDateStr);
    if (!range) return errorResponse!;
    const { start, end } = range;

    // Limit end to today
    const effectiveEnd = getEffectiveEnd(end);

    // Días en el rango
    const days: Date[] = [];
    const cursor = new Date(start);
    while (cursor <= effectiveEnd) {
      days.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    // Todas las sucursales activas
    const sucursales = await db.sucursal.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        codigoLocal: true,
      },
    });

    // Holidays una sola vez
    const holidays = await loadHolidays(start, end);

    const sucursalResults: any[] = [];
    for (const suc of sucursales) {
      const employees = await loadActiveEmployees(suc.id);
      const employeeIds = employees.map((e) => e.id);

      const [schedulesByEmp, recordsByEmp, vacations] = await Promise.all([
        loadSchedules(employeeIds),
        loadRecords(start, end, suc.id),
        loadApprovedVacations(start, end, suc.id),
      ]);

      // Vacations por empleado
      const vacationsByEmp: Record<string, any[]> = {};
      for (const v of vacations as any[]) {
        if (!vacationsByEmp[v.employeeId]) vacationsByEmp[v.employeeId] = [];
        vacationsByEmp[v.employeeId].push(v);
      }

      let presentDays = 0;
      let absentDays = 0;
      let lateDays = 0;
      let earlyLeaveDays = 0;
      let overtimeMinutes = 0;
      let overtimeDoubleMinutes = 0;
      let overtimeTripleMinutes = 0;
      let restDayWorkedCount = 0;
      let restDayPremiumMinutes = 0;
      // --- LFT art. 60/61 (jornada nocturna/mixta — prima nocturna 25%) ---
      let minutosNocturnos = 0;
      let diasJornadaNocturna = 0;

      for (const emp of employees) {
        const empSchedules = schedulesByEmp[emp.id] || [];
        const empRecords = recordsByEmp[emp.id] || [];
        const empVacations = vacationsByEmp[emp.id] || [];

        const recordsByDate: Record<string, (typeof empRecords)[0]> = {};
        for (const r of empRecords) recordsByDate[toISODate(r.date)] = r;

        for (const day of days) {
          const dayISO = toISODate(day);

          const absenceResult = isAbsentOnDate(day, {
            employee: { id: emp.id, isActive: emp.isActive },
            schedules: empSchedules.map((s) => ({
              dayOfWeek: s.dayOfWeek,
              isWeeklyRest: s.isWeeklyRest,
            })),
            records: empRecords,
            vacations: empVacations as any,
            holidays,
          });

          if (absenceResult.absent) {
            absentDays += 1;
            continue;
          }

          const record = recordsByDate[dayISO];
          if (!record) continue;

          if (record.status === 'PRESENT') presentDays += 1;
          else if (record.status === 'LATE') {
            lateDays += 1;
            presentDays += 1; // contó como día laborado
          } else if (record.status === 'EARLY_LEAVE') {
            earlyLeaveDays += 1;
            presentDays += 1;
          }

          // Reforma LFT 2027 — dobles/triples y prima descanso persistidos
          // por check-out. Se leen directamente de la BD (no se recalcula).
          if (record.checkInTime && record.checkOutTime) {
            overtimeMinutes += record.overtimeMinutes ?? 0;
            overtimeDoubleMinutes += record.overtimeDoubleMinutes ?? 0;
            overtimeTripleMinutes += record.overtimeTripleMinutes ?? 0;
            if (record.isRestDayWorked) {
              restDayWorkedCount += 1;
              restDayPremiumMinutes += record.restDayPremiumMinutes ?? 0;
            }
            // --- LFT art. 60/61 — jornada nocturna/mixta (prima nocturna 25%) ---
            // Minutos en ventana 20:00-06:00 y conteo de jornadas NOCTURNA/MIXTA.
            minutosNocturnos += record.nightMinutes || 0;
            if (
              record.shiftType === 'NOCTURNA' ||
              record.shiftType === 'MIXTA'
            ) {
              diasJornadaNocturna += 1;
            }
          }
        }
      }

      const totalEvaluableDays = presentDays + absentDays + earlyLeaveDays;
      const attendanceRate =
        totalEvaluableDays > 0
          ? +(((presentDays) / totalEvaluableDays) * 100).toFixed(2)
          : 0;

      sucursalResults.push({
        sucursalId: suc.id,
        name: suc.name,
        codigoLocal: suc.codigoLocal,
        totalEmployees: employees.length,
        presentDays,
        absentDays,
        lateDays,
        earlyLeaveDays,
        overtimeMinutes,
        overtimeHours: minutesToHours(overtimeMinutes),
        // Reforma LFT 2027 — dobles (art. 66) / triples (art. 68)
        overtimeDoubleMinutes,
        overtimeDoubleHours: minutesToHours(overtimeDoubleMinutes),
        overtimeTripleMinutes,
        overtimeTripleHours: minutesToHours(overtimeTripleMinutes),
        // Prima por descanso trabajado (art. 73 LFT)
        restDayWorkedCount,
        restDayPremiumMinutes,
        restDayPremiumHours: minutesToHours(restDayPremiumMinutes),
        // --- LFT art. 60/61 — jornada nocturna/mixta (prima nocturna 25%) ---
        // Minutos totales en ventana nocturna (20:00-06:00) del periodo.
        minutosNocturnos,
        minutosNocturnosHoras: minutesToHours(minutosNocturnos),
        // Conteo de registros NOCTURNA o MIXTA en la sucursal (art. 60 LFT).
        diasJornadaNocturna,
        attendanceRate,
      });
    }

    // Summary comparativo
    const totalOvertimeMinutes = sucursalResults.reduce(
      (s, x) => s + x.overtimeMinutes,
      0
    );
    const totalDoubleMinutes = sucursalResults.reduce(
      (s, x) => s + x.overtimeDoubleMinutes,
      0
    );
    const totalTripleMinutes = sucursalResults.reduce(
      (s, x) => s + x.overtimeTripleMinutes,
      0
    );
    const totalRestDayWorkedCount = sucursalResults.reduce(
      (s, x) => s + x.restDayWorkedCount,
      0
    );
    const totalRestDayPremiumMinutes = sucursalResults.reduce(
      (s, x) => s + x.restDayPremiumMinutes,
      0
    );
    const totalMinutosNocturnos = sucursalResults.reduce(
      (s, x) => s + x.minutosNocturnos,
      0
    );
    const totalDiasJornadaNocturna = sucursalResults.reduce(
      (s, x) => s + x.diasJornadaNocturna,
      0
    );

    const summary = {
      totalSucursales: sucursalResults.length,
      totalEmployees: sucursalResults.reduce(
        (s, x) => s + x.totalEmployees,
        0
      ),
      totalPresentDays: sucursalResults.reduce(
        (s, x) => s + x.presentDays,
        0
      ),
      totalAbsentDays: sucursalResults.reduce(
        (s, x) => s + x.absentDays,
        0
      ),
      totalLateDays: sucursalResults.reduce((s, x) => s + x.lateDays, 0),
      totalEarlyLeaveDays: sucursalResults.reduce(
        (s, x) => s + x.earlyLeaveDays,
        0
      ),
      totalOvertimeHours: minutesToHours(totalOvertimeMinutes),
      // Reforma LFT 2027
      totalDoubleHours: minutesToHours(totalDoubleMinutes),
      totalTripleHours: minutesToHours(totalTripleMinutes),
      // Prima por descanso trabajado (art. 73 LFT)
      totalRestDayWorkedCount,
      totalRestDayPremiumHours: minutesToHours(totalRestDayPremiumMinutes),
      // --- LFT art. 60/61 — jornada nocturna/mixta (prima nocturna 25%) ---
      totalMinutosNocturnos,
      totalMinutosNocturnosHoras: minutesToHours(totalMinutosNocturnos),
      totalDiasJornadaNocturna,
      avgAttendanceRate:
        sucursalResults.length > 0
          ? +(
              sucursalResults.reduce((s, x) => s + x.attendanceRate, 0) /
              sucursalResults.length
            ).toFixed(2)
          : 0,
      bestSucursal: sucursalResults.length
        ? sucursalResults.reduce((best, x) =>
            x.attendanceRate > best.attendanceRate ? x : best
          )
        : null,
      worstSucursal: sucursalResults.length
        ? sucursalResults.reduce((worst, x) =>
            x.attendanceRate < worst.attendanceRate ? x : worst
          )
        : null,
    };

    // --- Auditoría (art. 132 fr. VII LFT — trazabilidad de reportes) ---
    // comparative es GA-only: agrega todas las sucursales (sucursalId = null)
    try {
      const { ip, ua } = getIpAndUA(req);
      await auditLog({
        userId: user.id,
        action: 'GENERATE_COMPARATIVE_REPORT',
        entityType: 'REPORT',
        entityId: null,
        sucursalId: null,
        ipAddress: ip,
        userAgent: ua,
        details: {
          tipo: 'COMPARATIVE',
          periodo: { start: range.startISO, end: range.endISO },
          sucursalId: null,
          registros: sucursalResults.length,
        },
      });
    } catch (auditErr) {
      console.error('auditLog (comparative) error:', auditErr);
    }

    return NextResponse.json({
      sucursales: sucursalResults,
      summary,
      period: buildPeriodResponseEffective(range, effectiveEnd),
    });
  } catch (error) {
    console.error('GET /api/reports/comparative error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
