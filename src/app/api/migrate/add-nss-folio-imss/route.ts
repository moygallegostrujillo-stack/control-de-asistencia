// ============================================================
// /api/migrate/add-nss-folio-imss
//   POST — Migración manual: añade columnas nss y folioIMSS a la
//          base de datos de producción si prisma db push falla en
//          el build de Vercel (p.ej. por DIRECT_URL no configurado).
//
//   Es idempotente: si las columnas ya existen, no hace nada.
//   Requiere GENERAL_ADMIN para evitar que cualquiera lo ejecute.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, unauthorizedResponse, forbiddenResponse, isGeneralAdmin } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isGeneralAdmin(user)) return forbiddenResponse();

    const results: string[] = [];

    // --- 1. Verificar y añadir columna nss en Employee ---
    // PostgreSQL: information_schema.columns permite verificar si existe.
    const nssExists = await db.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Employee' AND column_name = 'nss'
      ) AS exists
    `;

    if (!nssExists[0]?.exists) {
      // Añadir columna nss como nullable (no rompe filas existentes).
      // UNIQUE constraint se añade por separado para permitir NULLs múltiples.
      await db.$executeRawUnsafe(
        `ALTER TABLE "Employee" ADD COLUMN "nss" TEXT`
      );
      await db.$executeRawUnsafe(
        `CREATE UNIQUE INDEX "Employee_nss_key" ON "Employee" ("nss") WHERE "nss" IS NOT NULL`
      );
      results.push('✓ Columna nss añadida a Employee (con índice unique parcial)');
    } else {
      results.push('✓ Columna nss ya existe en Employee (omitido)');
    }

    // --- 2. Verificar y añadir columna folioIMSS en Vacation ---
    const folioExists = await db.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Vacation' AND column_name = 'folioIMSS'
      ) AS exists
    `;

    if (!folioExists[0]?.exists) {
      await db.$executeRawUnsafe(
        `ALTER TABLE "Vacation" ADD COLUMN "folioIMSS" TEXT`
      );
      results.push('✓ Columna folioIMSS añadida a Vacation');
    } else {
      results.push('✓ Columna folioIMSS ya existe en Vacation (omitido)');
    }

    return NextResponse.json({
      success: true,
      message: 'Migración completada',
      details: results,
    });
  } catch (error) {
    console.error('POST /api/migrate/add-nss-folio-imss error:', error);
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
