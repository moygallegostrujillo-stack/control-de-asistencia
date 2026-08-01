// ============================================================
// POST /api/admin/recalc-status
// Recalcula el campo `status` (PRESENT / LATE / EARLY_LEAVE) de los
// AttendanceRecords usando la lógica CORREGIDA de zona horaria.
//
// Causa del bug: calculateOvertime usaba `new Date(date).setHours()`
// que interpreta la hora en la TZ del servidor (UTC en Vercel). Esto
// hacía que TODO registro con check-out quedara marcado como LATE,
// ignorando la tolerancia configurada (toleranceMinutes).
//
// Este endpoint:
//   1. Requiere GENERAL_ADMIN.
//   2. Acepta { fromDate?, toDate?, dryRun? } — por defecto los
//      últimos 90 días.
//   3. Para cada registro con checkInTime + checkOutTime, recalcula
//      isLate / isEarlyLeave con buildDateTimeInMexico (America/Mexico_City)
//      y el toleranceMinutes del WorkSchedule del día.
//   4. Si dryRun=true, solo reporta qué cambiaría (no escribe).
//   5. Si dryRun=false, actualiza status en la BD y registra auditoría.
//
// Retorna: { scanned, changed, details: [{recordId, employeeName, date,
//           oldStatus, newStatus, checkInTime, expectedCheckIn, tolerance}] }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { DateTime } from 'luxon';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import {
  MEXICO_TZ,
  buildDateTimeInMexico,
  getDayOfWeek,
  toISODate,
  formatTimeInMexico,
} from '@/lib/timezone';
import { findScheduleForDate } from '@/lib/overtime-calculator';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (user.role !== 'GENERAL_ADMIN') return forbiddenResponse();

    const body = await req.json().catch(() => ({}));
    const {
      fromDate,
      toDate,
      dryRun = false,
    } = body as {
      fromDate?: string; // "YYYY-MM-DD"
      toDate?: string; // "YYYY-MM-DD"
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
      },
      include: {
        employee: {
          include: {
            user: { select: { name: true } },
            workSchedules: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    const changes: Array<{
      recordId: string;
      employeeName: string;
      date: string;
      checkInTime: string;
      expectedCheckIn: string;
      toleranceMinutes: number;
      oldStatus: string;
      newStatus: string;
    }> = [];

    for (const r of records) {
      if (!r.checkInTime || !r.checkOutTime) continue;

      const schedule = findScheduleForDate(r.employee.workSchedules, r.date);
      if (!schedule || schedule.isWeeklyRest) continue;

      // Verificar que el día de la semana coincida con el schedule
      const dow = getDayOfWeek(r.date);
      if (schedule.dayOfWeek !== dow) continue;

      // --- Lógica CORREGIDA (idéntica a calculateOvertime fix) ---
      const dateISO = toISODate(r.date);
      const tolMs = schedule.toleranceMinutes * 60_000;
      const expectedCheckIn = buildDateTimeInMexico(dateISO, schedule.startTime);

      let isLate = false;
      if (r.checkInTime.getTime() > expectedCheckIn.getTime() + tolMs) {
        isLate = true;
      }

      // Early leave check
      const [sh, sm] = schedule.startTime.split(':').map(Number);
      const [eh, em] = schedule.endTime.split(':').map(Number);
      let checkoutISO = dateISO;
      if (eh * 60 + em <= sh * 60 + sm) {
        // turno nocturno — salida al día siguiente
        const nextDay = DateTime.fromFormat(dateISO, 'yyyy-MM-dd', {
          zone: MEXICO_TZ,
        }).plus({ days: 1 });
        checkoutISO = nextDay.toFormat('yyyy-MM-dd');
      }
      const expectedCheckOut = buildDateTimeInMexico(checkoutISO, schedule.endTime);
      let isEarlyLeave = false;
      if (r.checkOutTime.getTime() < expectedCheckOut.getTime() - tolMs) {
        isEarlyLeave = true;
      }

      // Determinar nuevo status
      let newStatus: 'PRESENT' | 'LATE' | 'EARLY_LEAVE' = 'PRESENT';
      if (isLate) {
        newStatus = 'LATE';
      } else if (isEarlyLeave) {
        newStatus = 'EARLY_LEAVE';
      }

      // Si cambió, registrar / actualizar
      if (newStatus !== r.status) {
        changes.push({
          recordId: r.id,
          employeeName: r.employee.user.name,
          date: toISODate(r.date),
          checkInTime: formatTimeInMexico(r.checkInTime),
          expectedCheckIn: schedule.startTime,
          toleranceMinutes: schedule.toleranceMinutes,
          oldStatus: r.status,
          newStatus,
        });

        if (!dryRun) {
          await db.attendanceRecord.update({
            where: { id: r.id },
            data: { status: newStatus },
          });
        }
      }
    }

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'MANUAL_CORRECTION',
      entityType: 'ATTENDANCE_RECORD',
      entityId: 'bulk-recalc-status',
      ipAddress: ip,
      userAgent: ua,
      details: {
        performedBy: user.email,
        reason: dryRun
          ? 'Recálculo de status (dry-run) — bug TZ retardos falsos'
          : 'Recálculo de status — bug TZ retardos falsos corregido',
        dateRange: { from: toISODate(from), to: toISODate(to) },
        scanned: records.length,
        changed: changes.length,
        dryRun,
        sampleChanges: changes.slice(0, 20),
      },
    });

    return NextResponse.json({
      scanned: records.length,
      changed: changes.length,
      dryRun,
      details: changes,
    });
  } catch (error) {
    console.error('Recalc status error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
