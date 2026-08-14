// ============================================================
// /api/diagnose-db
//   GET — Diagnóstico de schema de la DB de producción.
//          Verifica si las columnas críticas existen.
//          Público (no expone datos sensibles, solo metadatos de schema).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const DIAGNOSE_TOKEN = 'DIAGNOSE_2026';

  if (token !== DIAGNOSE_TOKEN) {
    return NextResponse.json(
      { error: 'Token requerido. Usa ?token=DIAGNOSE_2026' },
      { status: 403 }
    );
  }

  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    checks: {},
  };

  try {
    // 1. Verificar si la tabla Employee tiene la columna nss
    const employeeCols = await db.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Employee'
      ORDER BY ordinal_position
    `;
    result.checks.employeeColumns = employeeCols.map((c) => c.column_name);
    result.checks.employeeHasNss = employeeCols.some((c) => c.column_name === 'nss');
  } catch (e) {
    result.checks.employeeColumnsError = e instanceof Error ? e.message : String(e);
  }

  try {
    // 2. Verificar si la tabla Vacation tiene la columna folioIMSS
    const vacationCols = await db.$queryRaw<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Vacation'
      ORDER BY ordinal_position
    `;
    result.checks.vacationColumns = vacationCols.map((c) => c.column_name);
    result.checks.vacationHasFolioIMSS = vacationCols.some((c) => c.column_name === 'folioIMSS');
  } catch (e) {
    result.checks.vacationColumnsError = e instanceof Error ? e.message : String(e);
  }

  try {
    // 3. Contar usuarios por rol (para saber qué usuarios existen)
    const userCount = await db.$queryRaw<{ role: string; count: bigint }[]>`
      SELECT role, COUNT(*)::bigint as count
      FROM "User"
      GROUP BY role
      ORDER BY role
    `;
    result.checks.usersByRole = userCount.map((r) => ({
      role: r.role,
      count: Number(r.count),
    }));
  } catch (e) {
    result.checks.usersByRoleError = e instanceof Error ? e.message : String(e);
  }

  try {
    // 4. Intentar la consulta exacta que hace login (include employee)
    const testUser = await db.user.findFirst({
      where: { role: 'GENERAL_ADMIN' },
      include: { sucursal: true, employee: true },
    });
    result.checks.loginQueryWorks = true;
    result.checks.loginQuerySampleUserId = testUser?.id ?? null;
    result.checks.loginQuerySampleEmail = testUser?.email ?? null;
  } catch (e) {
    result.checks.loginQueryWorks = false;
    result.checks.loginQueryError = e instanceof Error ? e.message : String(e);
  }

  try {
    // 5. Verificar saldos de vacaciones cargados (2026/2027)
    const vacBalances = await db.$queryRaw<
      {
        name: string;
        vacationBalanceDays: number | null;
        vacationBalanceDays2026: number | null;
        vacationBalanceDays2027: number | null;
      }[]
    >`
      SELECT u.name,
             e."vacationBalanceDays",
             e."vacationBalanceDays2026",
             e."vacationBalanceDays2027"
      FROM "Employee" e
      JOIN "User" u ON u."employeeId" = e.id
      WHERE e."vacationBalanceDays2026" IS NOT NULL
         OR e."vacationBalanceDays2027" IS NOT NULL
      ORDER BY u.name
    `;
    result.checks.vacationBalances = vacBalances.map((r) => ({
      name: r.name,
      active: r.vacationBalanceDays,
      year2026: r.vacationBalanceDays2026,
      year2027: r.vacationBalanceDays2027,
    }));
    result.checks.vacationBalancesCount = vacBalances.length;
  } catch (e) {
    result.checks.vacationBalancesError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(result);
}
