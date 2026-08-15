// ============================================================
// POST /api/admin/recalc-vacations
// Recalcula los campos `startDate` y `endDate` de los Vacation
// que quedaron desfasados -1 día por el bug de timezone anterior.
//
// Causa del bug: POST /api/vacations usaba `new Date("2026-08-03")`
// que por spec de JS se interpreta como UTC midnight. En hora de
// México (UTC-6) eso es el día anterior (2026-08-02T18:00). Cuando
// el frontend mostraba la fecha con formatDateInMexico(), se veía
// un día antes del que el admin seleccionó.
//
// Ejemplo real del bug:
//   Carolina Cruz Pérez — Maternidad
//   - Admin seleccionó:   03/08/2026 → 25/10/2026
//   - Sistema mostraba:   02/08/2026 → 24/10/2026  ❌
//
// El fix del código (Parte 1) usa buildDateTimeInMexico() para que
// las fechas nuevas se guarden correctamente. Este endpoint (Parte 2)
// repara los registros HISTÓRICOS sumando +6 horas a startDate y
// endDate de todos los Vacation que tengan el desfase.
//
// Estrategia de detección:
//   - Un Vacation "bien" guardado tiene startDate con hora 06:00 UTC
//     (medianoche México CDT, UTC-6). También puede tener otros
//     offsets si fue creado en horario de verano/invierno, pero el
//     bug siempre producía 00:00:00.000Z exacto.
//   - Un Vacation "mal" guardado tiene startDate con hora 00:00:00.000Z
//     (UTC midnight, el bug).
//   - Para cada Vacation con startDate o endDate a las 00:00:00Z,
//     sumamos +6 horas (offset de México estándar) para llevarlo a
//     06:00:00Z (medianoche México).
//
//   Nota: México abolió el DST en 2022, así que UTC-6 es fijo todo
//   el año. El offset +6 horas es correcto para cualquier fecha.
//
// Parámetros:
//   { dryRun?: boolean, employeeId?: string, fromDate?: string,
//     toDate?: string }
//
// Retorna:
//   { scanned, changed, dryRun, details: [{ id, employeeName, type,
//     oldStart, newStart, oldEnd, newEnd, days }] }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { toISODate, formatDateInMexico } from '@/lib/timezone';
import { computeVacationDays } from '@/lib/vacation-calculator';

/** Offset de México en minutos (UTC-6, sin DST desde 2022). */
const MEXICO_OFFSET_MINUTES = 6 * 60;

/**
 * Determina si un Date está "mal" guardado (a UTC midnight exacto).
 * Si el componente de hora del Date (en UTC) es 00:00:00.000,
 * asumimos que fue producido por el bug `new Date("YYYY-MM-DD")`.
 */
function isBuggyDate(d: Date): boolean {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}

/** Suma el offset de México a un Date buggy → medianoche México. */
function fixBuggyDate(d: Date): Date {
  return new Date(d.getTime() + MEXICO_OFFSET_MINUTES * 60_000);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (user.role !== 'GENERAL_ADMIN') return forbiddenResponse();

    const body = await req.json().catch(() => ({}));
    const {
      dryRun = false,
      employeeId,
      fromDate,
      toDate,
    } = body as {
      dryRun?: boolean;
      employeeId?: string;
      fromDate?: string; // "YYYY-MM-DD"
      toDate?: string; // "YYYY-MM-DD"
    };

    // Construir filtro de rango por startDate.
    // Si no se especifica rango, escanea TODOS los registros.
    const startFilter: Record<string, Date> = {};
    if (fromDate) {
      const d = new Date(fromDate + 'T00:00:00Z');
      if (!isNaN(d.getTime())) startFilter.gte = d;
    }
    if (toDate) {
      const d = new Date(toDate + 'T23:59:59Z');
      if (!isNaN(d.getTime())) startFilter.lte = d;
    }

    const records = await db.vacation.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(Object.keys(startFilter).length > 0
          ? { startDate: startFilter }
          : {}),
      },
      include: {
        employee: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });

    const changes: Array<{
      id: string;
      employeeName: string;
      employeeNumber: string;
      type: string;
      oldStart: string;
      newStart: string;
      oldEnd: string;
      newEnd: string;
      days: number;
    }> = [];

    for (const r of records) {
      const startBuggy = isBuggyDate(r.startDate);
      const endBuggy = isBuggyDate(r.endDate);

      // Solo tocar registros que tengan al menos una fecha buggy.
      if (!startBuggy && !endBuggy) continue;

      const newStart = startBuggy ? fixBuggyDate(r.startDate) : r.startDate;
      const newEnd = endBuggy ? fixBuggyDate(r.endDate) : r.endDate;

      // Recalcular días laborables (excluye domingos art. 71 LFT y
      // festivos oficiales art. 74 LFT + feriados de BD).
      // Fix 15-ago-2026.
      const dbHolidays = await db.holiday.findMany({
        where: { date: { gte: newStart, lte: newEnd } },
        select: { date: true },
      });
      const newDays = computeVacationDays(newStart, newEnd, dbHolidays);

      changes.push({
        id: r.id,
        employeeName: r.employee.user.name,
        employeeNumber: r.employee.employeeNumber,
        type: r.type,
        oldStart: formatDateInMexico(r.startDate),
        newStart: formatDateInMexico(newStart),
        oldEnd: formatDateInMexico(r.endDate),
        newEnd: formatDateInMexico(newEnd),
        days: newDays,
      });

      if (!dryRun) {
        await db.vacation.update({
          where: { id: r.id },
          data: {
            startDate: newStart,
            endDate: newEnd,
            // Solo actualizar days si cambió (puede pasar si antes
            // estaba mal calculado por el desfase).
            ...(newDays !== r.days ? { days: newDays } : {}),
            // También arreglar horas parciales si existen y están buggy.
            ...(r.startTime && isBuggyDate(r.startTime)
              ? { startTime: fixBuggyDate(r.startTime) }
              : {}),
            ...(r.endTime && isBuggyDate(r.endTime)
              ? { endTime: fixBuggyDate(r.endTime) }
              : {}),
          },
        });
      }
    }

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'MANUAL_CORRECTION',
      entityType: 'VACATION',
      entityId: 'bulk-recalc-vacations',
      ipAddress: ip,
      userAgent: ua,
      details: {
        performedBy: user.email,
        reason: dryRun
          ? 'Recálculo de fechas de vacaciones/permisos (dry-run) — bug TZ desfase -1 día'
          : 'Recálculo de fechas de vacaciones/permisos — bug TZ desfase -1 día corregido',
        dateRange: {
          from: fromDate || null,
          to: toDate || null,
        },
        employeeId: employeeId || null,
        scanned: records.length,
        changed: changes.length,
        dryRun,
        sampleChanges: changes.slice(0, 30),
      },
    });

    return NextResponse.json({
      scanned: records.length,
      changed: changes.length,
      dryRun,
      details: changes,
    });
  } catch (error) {
    console.error('Recalc vacations error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
