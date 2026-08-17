// ============================================================
// POST /api/admin/recalc-vacations-holidays
//   Fix retroactivo (15-ago-2026): recalcula los `days` de TODOS los
//   Vacation con type=VACACIONES usando la nueva fórmula (días
//   laborables, excluyendo domingos art. 71 LFT y festivos oficiales
//   art. 74 LFT + feriados de BD).
//
//   Cuando el nuevo cálculo da menos días que el viejo, se:
//     1. Actualiza Vacation.days = newDays
//     2. Devuelve la diferencia al saldo del empleado:
//        Employee.vacationBalanceDays += (oldDays - newDays)
//
//   Cuando el nuevo cálculo da MÁS días (caso raro: si antes se
//   contaban mal por algún bug), se descuenta del saldo.
//
//   Reporte:
//     - dryRun=true  → solo reporta qué cambiaría, no modifica nada.
//     - dryRun=false → aplica cambios en transacción + audit log.
//
//   Auth: sesión GENERAL_ADMIN o token ?token=RECALC_HOLIDAYS_2026
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
import { formatDateInMexico } from '@/lib/timezone';
import { computeVacationDays } from '@/lib/vacation-calculator';

const RECALC_TOKEN = 'RECALC_HOLIDAYS_2026';

export async function POST(req: NextRequest) {
  try {
    // --- Auth dual: sesión admin O token de emergencia ---
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get('token');
    const dryRun = url.searchParams.get('dryRun') === 'true';

    let authorized = false;
    let adminUserId: string | null = null;

    if (tokenParam === RECALC_TOKEN) {
      authorized = true;
    } else {
      const user = await getAuthUser(req);
      if (user && isGeneralAdmin(user)) {
        authorized = true;
        adminUserId = user.id;
      }
    }

    if (!authorized) {
      if (tokenParam !== null) {
        return NextResponse.json(
          { error: 'Token de recálculo inválido' },
          { status: 403 }
        );
      }
      const user = await getAuthUser(req);
      if (!user) return unauthorizedResponse();
      return forbiddenResponse();
    }

    // --- Cargar todos los Vacation de tipo VACACIONES (no permisos/incapacidades) ---
    // Solo los que tengan isPartial=false (los parciales tienen days=0 por diseño).
    const vacations = await db.vacation.findMany({
      where: {
        type: 'VACACIONES',
        isPartial: false,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            vacationBalanceDays: true,
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });

    // --- Cargar TODOS los feriados de la BD de una vez (optimización) ---
    // Como los Vacation pueden abarcar años distintos, cargamos todos los
    // feriados y filtramos en memoria por registro.
    const allHolidays = await db.holiday.findMany({
      select: { date: true },
    });

    // --- Para cada vacation, calcular newDays y la diferencia ---
    interface VacationChange {
      vacationId: string;
      employeeName: string;
      employeeNumber: string;
      startDate: string;
      endDate: string;
      oldDays: number;
      newDays: number;
      diff: number; // oldDays - newDays (positivo = devolver al saldo)
    }

    interface EmployeeAdjustment {
      employeeId: string;
      employeeName: string;
      employeeNumber: string;
      oldBalance: number;
      totalDiff: number; // suma de diffs (positivo = aumentar saldo)
      changes: VacationChange[];
    }

    const adjustmentsByEmployee = new Map<string, EmployeeAdjustment>();
    let totalVacationsChanged = 0;
    let totalDaysReturned = 0;

    for (const vac of vacations) {
      // Filtrar feriados de la BD que caen en el rango de este vacation
      const holidaysInRange = allHolidays.filter((h) => {
        return h.date >= vac.startDate && h.date <= vac.endDate;
      });

      const newDays = computeVacationDays(vac.startDate, vac.endDate, holidaysInRange);
      const diff = vac.days - newDays;

      // Solo registrar si hay cambio
      if (diff !== 0) {
        const change: VacationChange = {
          vacationId: vac.id,
          employeeName: vac.employee.user.name,
          employeeNumber: vac.employee.employeeNumber,
          startDate: formatDateInMexico(vac.startDate),
          endDate: formatDateInMexico(vac.endDate),
          oldDays: vac.days,
          newDays,
          diff,
        };

        if (!adjustmentsByEmployee.has(vac.employeeId)) {
          adjustmentsByEmployee.set(vac.employeeId, {
            employeeId: vac.employeeId,
            employeeName: vac.employee.user.name,
            employeeNumber: vac.employee.employeeNumber,
            oldBalance: vac.employee.vacationBalanceDays,
            totalDiff: 0,
            changes: [],
          });
        }

        const emp = adjustmentsByEmployee.get(vac.employeeId)!;
        emp.totalDiff += diff;
        emp.changes.push(change);
        totalVacationsChanged++;
        totalDaysReturned += diff;
      }
    }

    const employeesAffected = adjustmentsByEmployee.size;
    const details = Array.from(adjustmentsByEmployee.values()).map((e) => ({
      employeeId: e.employeeId,
      employeeName: e.employeeName,
      employeeNumber: e.employeeNumber,
      oldBalance: e.oldBalance,
      balanceAdjustment: e.totalDiff,
      newBalance: e.oldBalance + e.totalDiff,
      vacationChanges: e.changes,
    }));

    // --- Dry run: solo reportar ---
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        totalVacationsScanned: vacations.length,
        employeesAffected,
        totalVacationsChanged,
        totalDaysReturned,
        legalReference:
          'LFT art. 71 (descanso semanal), art. 74 (días festivos oficiales)',
        details,
      });
    }

    // --- Aplicar cambios en transacción ---
    if (employeesAffected === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay vacaciones que requieran recálculo.',
        totalVacationsScanned: vacations.length,
        employeesAffected: 0,
        totalVacationsChanged: 0,
        totalDaysReturned: 0,
      });
    }

    await db.$transaction(async (tx) => {
      for (const [employeeId, emp] of adjustmentsByEmployee) {
        // Actualizar cada vacation
        for (const change of emp.changes) {
          await tx.vacation.update({
            where: { id: change.vacationId },
            data: { days: change.newDays },
          });
        }
        // Ajustar saldo del empleado (increment puede ser negativo)
        await tx.employee.update({
          where: { id: employeeId },
          data: {
            vacationBalanceDays: {
              increment: emp.totalDiff,
            },
          },
        });
      }
    });

    // --- Audit log ---
    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: adminUserId ?? undefined,
      action: 'RECALC_VACATIONS_HOLIDAYS',
      entityType: 'VACATION',
      entityId: null,
      sucursalId: null,
      ipAddress: ip,
      userAgent: ua,
      details: {
        legalReference:
          'LFT art. 71 (descanso semanal), art. 74 (días festivos oficiales)',
        totalVacationsScanned: vacations.length,
        employeesAffected,
        totalVacationsChanged,
        totalDaysReturned,
        triggeredBy: adminUserId ? 'MANUAL_ADMIN' : 'CRON_TOKEN',
        note:
          'Recálculo retroactivo de días de vacaciones: se excluyeron domingos ' +
          'y festivos oficiales (art. 71 y 74 LFT). Los días devueltos al saldo ' +
          'se acumulan en vacationBalanceDays de cada empleado.',
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Recálculo completado: ${totalVacationsChanged} vacaciones actualizadas, ${totalDaysReturned} día(s) devuelto(s) a ${employeesAffected} empleado(s).`,
      totalVacationsScanned: vacations.length,
      employeesAffected,
      totalVacationsChanged,
      totalDaysReturned,
      legalReference:
        'LFT art. 71 (descanso semanal), art. 74 (días festivos oficiales)',
      details,
    });
  } catch (error) {
    console.error('POST /api/admin/recalc-vacations-holidays error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error en recálculo de vacaciones',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
