// ============================================================
// /api/migrate/add-vacation-year-columns
//   POST — Migración manual: añade columnas vacationBalanceDays2026
//          y vacationBalanceDays2027 a la tabla Employee en producción.
//
//   Es idempotente: si las columnas ya existen, no hace nada.
//
//   Autenticación: sesión GENERAL_ADMIN o token de emergencia.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, unauthorizedResponse, forbiddenResponse, isGeneralAdmin } from '@/lib/auth';

const MIGRATION_TOKEN = 'MIGRATE_VAC_YEARS_2026';

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get('token');

    let authorized = false;

    if (tokenParam === MIGRATION_TOKEN) {
      authorized = true;
    } else {
      const user = await getAuthUser(req);
      if (user && isGeneralAdmin(user)) {
        authorized = true;
      }
    }

    if (!authorized) {
      if (tokenParam !== null) {
        return NextResponse.json(
          { error: 'Token de migración inválido' },
          { status: 403 }
        );
      }
      const user = await getAuthUser(req);
      if (!user) return unauthorizedResponse();
      return forbiddenResponse();
    }

    const results: string[] = [];

    // --- 1. vacationBalanceDays2026 ---
    const col2026Exists = await db.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Employee' AND column_name = 'vacationBalanceDays2026'
      ) AS exists
    `;

    if (!col2026Exists[0]?.exists) {
      await db.$executeRawUnsafe(
        `ALTER TABLE "Employee" ADD COLUMN "vacationBalanceDays2026" INTEGER`
      );
      results.push('✓ Columna vacationBalanceDays2026 añadida a Employee');
    } else {
      results.push('✓ Columna vacationBalanceDays2026 ya existe (omitido)');
    }

    // --- 2. vacationBalanceDays2027 ---
    const col2027Exists = await db.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Employee' AND column_name = 'vacationBalanceDays2027'
      ) AS exists
    `;

    if (!col2027Exists[0]?.exists) {
      await db.$executeRawUnsafe(
        `ALTER TABLE "Employee" ADD COLUMN "vacationBalanceDays2027" INTEGER`
      );
      results.push('✓ Columna vacationBalanceDays2027 añadida a Employee');
    } else {
      results.push('✓ Columna vacationBalanceDays2027 ya existe (omitido)');
    }

    return NextResponse.json({
      success: true,
      message: 'Migración completada',
      details: results,
    });
  } catch (error) {
    console.error('POST /api/migrate/add-vacation-year-columns error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error en migración',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
