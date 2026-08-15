// ============================================================
// Script standalone: dry-run del recálculo retroactivo de vacaciones.
//
// Replica EXACTAMENTE la lógica de POST /api/admin/recalc-vacations-holidays
// pero sin levantar Next.js (evita OOM en entorno de 4GB sin swap).
//
// Uso:
//   bun run scripts/recalc-vacations-dryrun.ts          # dry-run (no modifica)
//   DRY_RUN=false bun run scripts/recalc-vacations-dryrun.ts  # aplica cambios
//
// Conecta a la BD definida en .env (DATABASE_URL).
// ============================================================

import { PrismaClient } from '@prisma/client';
import { computeVacationDays } from '../src/lib/vacation-calculator';
import { formatDateInMexico } from '../src/lib/timezone';

const db = new PrismaClient({ log: ['error'] });
const APPLY = process.env.DRY_RUN === 'false';

interface VacationChange {
  vacationId: string;
  employeeName: string;
  employeeNumber: string;
  startDate: string;
  endDate: string;
  oldDays: number;
  newDays: number;
  diff: number;
}

interface EmployeeAdjustment {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  oldBalance: number;
  totalDiff: number;
  changes: VacationChange[];
}

async function main() {
  console.log('=== Recálculo retroactivo de vacaciones (fix domingos + festivos) ===');
  console.log(`Modo: ${APPLY ? 'APLICAR CAMBIOS' : 'DRY-RUN (no modifica)'}`);
  console.log(`Base de datos: ${process.env.DATABASE_URL ?? '(no DATABASE_URL)'}`);
  console.log('');

  // Cargar todas las vacaciones de tipo VACACIONES (no parciales)
  const vacations = await db.vacation.findMany({
    where: { type: 'VACACIONES', isPartial: false },
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

  const allHolidays = await db.holiday.findMany({ select: { date: true } });

  console.log(`Vacaciones escaneadas: ${vacations.length}`);
  console.log(`Feriados en BD: ${allHolidays.length}`);
  console.log('');

  const adjustmentsByEmployee = new Map<string, EmployeeAdjustment>();
  let totalChanged = 0;
  let totalDaysReturned = 0;

  for (const vac of vacations) {
    const holidaysInRange = allHolidays.filter(
      (h) => h.date >= vac.startDate && h.date <= vac.endDate
    );
    const newDays = computeVacationDays(vac.startDate, vac.endDate, holidaysInRange);
    const diff = vac.days - newDays;

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
      totalChanged++;
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

  // Reporte legible
  console.log('--- REPORTE ---');
  console.log(`Empleados afectados: ${employeesAffected}`);
  console.log(`Vacaciones cambiadas: ${totalChanged}`);
  console.log(`Días totales devueltos a saldos: ${totalDaysReturned}`);
  console.log(`Referencia legal: LFT art. 71 (descanso semanal), art. 74 (festivos oficiales)`);
  console.log('');

  if (details.length === 0) {
    console.log('No hay vacaciones que requieran recálculo. Todo está correcto.');
  } else {
    for (const e of details) {
      console.log(
        `  ${e.employeeName} (#${e.employeeNumber}) — saldo ${e.oldBalance} → ${e.newBalance} (${e.balanceAdjustment >= 0 ? '+' : ''}${e.balanceAdjustment})`
      );
      for (const c of e.vacationChanges) {
        console.log(
          `      ${c.startDate} → ${c.endDate}: ${c.oldDays} → ${c.newDays} días (diff ${c.diff >= 0 ? '+' : ''}${c.diff})`
        );
      }
    }
  }

  // Reporte JSON completo (para auditoría)
  console.log('');
  console.log('--- JSON ---');
  console.log(
    JSON.stringify(
      {
        dryRun: !APPLY,
        totalVacationsScanned: vacations.length,
        employeesAffected,
        totalVacationsChanged: totalChanged,
        totalDaysReturned,
        details,
      },
      null,
      2
    )
  );

  if (APPLY && employeesAffected > 0) {
    console.log('');
    console.log('>>> Aplicando cambios en transacción...');
    await db.$transaction(async (tx) => {
      for (const [employeeId, emp] of adjustmentsByEmployee) {
        for (const change of emp.changes) {
          await tx.vacation.update({
            where: { id: change.vacationId },
            data: { days: change.newDays },
          });
        }
        await tx.employee.update({
          where: { id: employeeId },
          data: { vacationBalanceDays: { increment: emp.totalDiff } },
        });
      }
    });
    console.log('>>> Cambios aplicados correctamente.');
  } else if (APPLY && employeesAffected === 0) {
    console.log('');
    console.log('>>> No hay cambios que aplicar.');
  } else {
    console.log('');
    console.log('>>> Dry-run: no se modificó la BD. Para aplicar: DRY_RUN=false bun run scripts/recalc-vacations-dryrun.ts');
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
