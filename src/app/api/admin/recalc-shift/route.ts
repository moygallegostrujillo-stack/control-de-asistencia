// ============================================================
// POST /api/admin/recalc-shift
// Recalcula los campos `shiftType` (DIURNA/NOCTURNA/MIXTA) y
// `nightMinutes` de los AttendanceRecords usando la lógica
// CORREGIDA de zona horaria (Luxon + America/Mexico_City).
//
// Causa del bug: nightMinutesBetween usaba `new Date().setHours(20,0,0,0)`
// que interpreta la hora en la TZ del servidor (UTC en Vercel/sandbox).
// Esto hacía que una jornada de 09:00-17:00 hora México se calculara
// con minutos nocturnos falsos (las horas entre 20:00 UTC y el checkout
// en UTC), marcándola erróneamente como NOCTURNA.
//
// Ejemplo real del bug:
//   Empleado EMP#010, 2026-07-30, entrada 09:01 CDT, salida 17:34 CDT
//   - Bug:    214 min nocturnos, jornada NOCTURNA ❌
//   - Fix:    0 min nocturnos, jornada DIURNA ✅
//
// Este endpoint:
//   1. Requiere GENERAL_ADMIN.
//   2. Acepta { fromDate?, toDate?, employeeId?, dryRun? } — por defecto
//      los últimos 90 días.
//   3. Para cada registro con checkInTime + checkOutTime, recalcula
//      shiftType y nightMinutes con classifyShift() (que ahora usa Luxon).
//   4. Si dryRun=true, solo reporta qué cambiaría (no escribe).
//   5. Si dryRun=false, actualiza shiftType y nightMinutes en la BD y
//      registra auditoría.
//
// Retorna: { scanned, changed, details: [{recordId, employeeName, date,
//           checkIn, checkOut, oldShiftType, newShiftType,
//           oldNightMin, newNightMin}] }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { toISODate, formatTimeInMexico } from '@/lib/timezone';
import { classifyShift } from '@/lib/shift-classifier';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (user.role !== 'GENERAL_ADMIN') return forbiddenResponse();

    const body = await req.json().catch(() => ({}));
    const {
      fromDate,
      toDate,
      employeeId,
      dryRun = false,
    } = body as {
      fromDate?: string; // "YYYY-MM-DD"
      toDate?: string; // "YYYY-MM-DD"
      employeeId?: string;
      dryRun?: boolean;
    };

    // Rango por defecto: últimos 90 días
    const now = new Date();
    const from = fromDate
      ? new Date(fromDate + 'T00:00:00')
      : new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate + 'T23:59:59') : now;

    // Cargar registros con check-in y check-out en el rango
    const records = await db.attendanceRecord.findMany({
      where: {
        checkInTime: { not: null },
        checkOutTime: { not: null },
        date: { gte: from, lte: to },
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: {
          include: {
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    const changes: Array<{
      recordId: string;
      employeeName: string;
      employeeNumber: string;
      date: string;
      checkIn: string;
      checkOut: string;
      oldShiftType: string;
      newShiftType: string;
      oldNightMin: number;
      newNightMin: number;
    }> = [];

    for (const r of records) {
      if (!r.checkInTime || !r.checkOutTime) continue;

      // Recalcular con la lógica CORREGIDA (Luxon + America/Mexico_City)
      const { shiftType: newShiftType, nightMinutes: newNightMin } = classifyShift(
        r.checkInTime,
        r.checkOutTime
      );

      const oldShiftType = r.shiftType ?? 'DIURNA';
      const oldNightMin = r.nightMinutes ?? 0;

      // Si cambió shiftType o nightMinutes (con tolerancia de 1 min por redondeo), registrar
      const nightMinChanged = Math.abs(newNightMin - oldNightMin) > 1;
      const shiftTypeChanged = newShiftType !== oldShiftType;

      if (shiftTypeChanged || nightMinChanged) {
        changes.push({
          recordId: r.id,
          employeeName: r.employee.user.name,
          employeeNumber: r.employee.employeeNumber,
          date: toISODate(r.date),
          checkIn: formatTimeInMexico(r.checkInTime),
          checkOut: formatTimeInMexico(r.checkOutTime),
          oldShiftType,
          newShiftType,
          oldNightMin: Math.round(oldNightMin),
          newNightMin: Math.round(newNightMin),
        });

        if (!dryRun) {
          await db.attendanceRecord.update({
            where: { id: r.id },
            data: {
              shiftType: newShiftType,
              nightMinutes: Math.round(newNightMin),
            },
          });
        }
      }
    }

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'MANUAL_CORRECTION',
      entityType: 'ATTENDANCE_RECORD',
      entityId: 'bulk-recalc-shift',
      ipAddress: ip,
      userAgent: ua,
      details: {
        performedBy: user.email,
        reason: dryRun
          ? 'Recálculo de shiftType/nightMinutes (dry-run) — bug TZ jornada nocturna falsa'
          : 'Recálculo de shiftType/nightMinutes — bug TZ jornada nocturna falsa corregido',
        dateRange: { from: toISODate(from), to: toISODate(to) },
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
    console.error('Recalc shift error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
