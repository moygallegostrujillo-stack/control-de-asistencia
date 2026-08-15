// ============================================================
// /api/vacations/bulk-load
//   POST — Carga masiva de saldos de vacaciones por año.
//
//   Recibe un arreglo de { name, year, days } y hace match
//   con empleados existentes por nombre (case-insensitive,
//   ignorando acentos). Actualiza vacationBalanceDays<year>.
//
//   Si year === 2026, también actualiza vacationBalanceDays
//   (saldo actual activo) porque estamos en 2026.
//
//   Autenticación: sesión GENERAL_ADMIN o token de emergencia.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, unauthorizedResponse, forbiddenResponse, isGeneralAdmin } from '@/lib/auth';

const BULK_TOKEN = 'BULK_VACATIONS_2026';

// Normaliza un nombre para comparación: quita acentos, pasa a minúsculas,
// colapsa espacios múltiples, quita puntos y comas.
function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita acentos
    .toUpperCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface BulkItem {
  name: string;
  year: 2026 | 2027;
  days: number;
}

export async function POST(req: NextRequest) {
  try {
    // Autenticación dual: admin session O token secreto.
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get('token');

    let authorized = false;

    if (tokenParam === BULK_TOKEN) {
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
          { error: 'Token inválido' },
          { status: 403 }
        );
      }
      const user = await getAuthUser(req);
      if (!user) return unauthorizedResponse();
      return forbiddenResponse();
    }

    const body = await req.json().catch(() => ({}));
    const { items } = body as { items?: BulkItem[] };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un arreglo "items" con { name, year, days }' },
        { status: 400 }
      );
    }

    // Validar cada item.
    for (const item of items) {
      if (!item.name || typeof item.name !== 'string') {
        return NextResponse.json(
          { error: `Item inválido (name faltante): ${JSON.stringify(item)}` },
          { status: 400 }
        );
      }
      if (item.year !== 2026 && item.year !== 2027) {
        return NextResponse.json(
          { error: `Año inválido en "${item.name}": debe ser 2026 o 2027` },
          { status: 400 }
        );
      }
      if (typeof item.days !== 'number' || item.days < 0 || !Number.isInteger(item.days)) {
        return NextResponse.json(
          { error: `Días inválidos en "${item.name}": debe ser entero >= 0` },
          { status: 400 }
        );
      }
    }

    // Cargar todos los empleados con su user.name para hacer match.
    const employees = await db.employee.findMany({
      where: { isActive: true },
      include: { user: { select: { name: true } } },
    });

    // Construir mapa de normalización → employee.
    const byNormalizedName = new Map<string, typeof employees[number]>();
    for (const emp of employees) {
      const normalized = normalizeName(emp.user.name);
      if (normalized) {
        byNormalizedName.set(normalized, emp);
      }
    }

    const results: Array<{
      name: string;
      year: number;
      days: number;
      matched: boolean;
      employeeId?: string;
      employeeName?: string;
      error?: string;
    }> = [];

    // Procesar cada item.
    for (const item of items) {
      const normalized = normalizeName(item.name);
      const emp = byNormalizedName.get(normalized);

      if (!emp) {
        results.push({
          name: item.name,
          year: item.year,
          days: item.days,
          matched: false,
          error: 'Empleado no encontrado por nombre',
        });
        continue;
      }

      // Construir el update data según el año.
      const updateData: Record<string, unknown> = {};
      if (item.year === 2026) {
        updateData.vacationBalanceDays2026 = item.days;
        // También actualizamos el saldo activo porque estamos en 2026.
        updateData.vacationBalanceDays = item.days;
      } else if (item.year === 2027) {
        updateData.vacationBalanceDays2027 = item.days;
      }

      try {
        await db.employee.update({
          where: { id: emp.id },
          data: updateData,
        });
        results.push({
          name: item.name,
          year: item.year,
          days: item.days,
          matched: true,
          employeeId: emp.id,
          employeeName: emp.user.name,
        });
      } catch (e) {
        results.push({
          name: item.name,
          year: item.year,
          days: item.days,
          matched: true,
          employeeId: emp.id,
          employeeName: emp.user.name,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const summary = {
      total: results.length,
      matched: results.filter((r) => r.matched && !r.error).length,
      notFound: results.filter((r) => !r.matched).length,
      errors: results.filter((r) => r.error).length,
    };

    return NextResponse.json({
      success: true,
      summary,
      results,
    });
  } catch (error) {
    console.error('POST /api/vacations/bulk-load error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
