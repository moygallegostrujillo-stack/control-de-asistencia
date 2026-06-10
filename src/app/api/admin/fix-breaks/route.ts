import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { buildTodayDateRange } from '@/lib/timezone';

/**
 * Admin endpoint to fix stuck break records.
 * Converts old system (mealStart/restStart) to new system (breakStart/breakEnd)
 * for today's records where breaks are stuck.
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();

    // Only admins can run this fix
    if (currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Solo administradores pueden ejecutar esta corrección' }, { status: 403 });
    }

    const todayRange = buildTodayDateRange();
    const body = await request.json().catch(() => ({}));
    const { employeeId, action } = body;

    if (action === 'fix-stuck') {
      // Fix all stuck break records for today
      // "Stuck" means: mealStart or restStart exists but no corresponding end,
      // AND breakStart is null (old system)
      const records = await db.attendanceRecord.findMany({
        where: { date: todayRange },
      });

      let fixedCount = 0;
      const fixes: string[] = [];

      for (const record of (records as Record<string, unknown>[])) {
        const hasOldBreak = !!record.mealStart || !!record.restStart;
        const oldBreakEnded = !!record.mealEnd && !!record.restEnd;
        const hasNewBreak = !!record.breakStart;

        if (hasOldBreak && !oldBreakEnded && !hasNewBreak) {
          // This record has a stuck old-system break
          // Convert to new system: set breakStart from mealStart/restStart
          const effectiveStart = (record.mealStart || record.restStart) as string;

          try {
            await db.attendanceRecord.update({
              where: { id: record.id as string },
              data: {
                breakStart: effectiveStart,
              },
            });
            fixedCount++;
            fixes.push(`Record ${(record.id as string).slice(0, 8)}...: Set breakStart=${effectiveStart}`);
          } catch (err) {
            fixes.push(`Record ${(record.id as string).slice(0, 8)}...: FAILED - ${String(err)}`);
          }
        }
      }

      return NextResponse.json({
        message: `Se corrigieron ${fixedCount} registro(s) con descansos atascados.`,
        fixedCount,
        details: fixes,
      });
    }

    if (action === 'cancel-break' && employeeId) {
      // Cancel a specific employee's stuck break
      const records = await db.attendanceRecord.findMany({
        where: { employeeId, date: todayRange },
        take: 1,
      });

      if (!records.length) {
        return NextResponse.json({ error: 'No se encontró registro de asistencia hoy' }, { status: 404 });
      }

      const record = records[0] as Record<string, unknown>;
      const rec = record;

      // Clear all break fields
      const updateData: Record<string, unknown> = {};

      if (rec.breakStart && !rec.breakEnd) {
        updateData.breakStart = null;
      }
      if (rec.mealStart && !rec.mealEnd) {
        updateData.mealStart = null;
      }
      if (rec.restStart && !rec.restEnd) {
        updateData.restStart = null;
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ message: 'No hay descansos atascados para este empleado' });
      }

      await db.attendanceRecord.update({
        where: { id: rec.id as string },
        data: updateData,
      });

      return NextResponse.json({
        message: 'Descanso cancelado correctamente',
        clearedFields: Object.keys(updateData),
      });
    }

    if (action === 'end-break' && employeeId) {
      // End a specific employee's break (both old and new system)
      const records = await db.attendanceRecord.findMany({
        where: { employeeId, date: todayRange },
        take: 1,
      });

      if (!records.length) {
        return NextResponse.json({ error: 'No se encontró registro de asistencia hoy' }, { status: 404 });
      }

      const record = records[0] as Record<string, unknown>;
      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {};

      // Determine break start
      const breakStart = (record.breakStart || record.mealStart || record.restStart) as string | null;
      if (!breakStart) {
        return NextResponse.json({ error: 'No se ha iniciado un descanso' }, { status: 400 });
      }

      const breakDuration = Math.floor((Date.now() - new Date(breakStart).getTime()) / 60000);

      // New system
      if (record.breakStart && !record.breakEnd) {
        updateData.breakEnd = now;
        updateData.breakDuration = breakDuration;
        updateData.exceededBreak = breakDuration > 35; // 30 min + 5 min tolerance
      }

      // Old system
      if (record.mealStart && !record.mealEnd) {
        const mealDuration = Math.floor((Date.now() - new Date(record.mealStart as string).getTime()) / 60000);
        updateData.mealEnd = now;
        updateData.mealDuration = mealDuration;
        updateData.exceededMeal = mealDuration > 35;

        // Also set new system fields for consistency
        if (!record.breakStart) updateData.breakStart = record.mealStart;
        if (!record.breakEnd) {
          updateData.breakEnd = now;
          updateData.breakDuration = breakDuration;
          updateData.exceededBreak = breakDuration > 35;
        }
      }

      if (record.restStart && !record.restEnd) {
        const restDuration = Math.floor((Date.now() - new Date(record.restStart as string).getTime()) / 60000);
        updateData.restEnd = now;
        updateData.restDuration = restDuration;
        updateData.exceededRest = restDuration > 35;
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ message: 'No hay descansos activos para terminar' });
      }

      await db.attendanceRecord.update({
        where: { id: record.id as string },
        data: updateData,
      });

      return NextResponse.json({
        message: `Descanso terminado. Duración: ${breakDuration} min.`,
        breakDuration,
        updatedFields: Object.keys(updateData),
      });
    }

    return NextResponse.json({ error: 'Acción no válida. Use: fix-stuck, cancel-break, end-break' }, { status: 400 });
  } catch (error) {
    console.error('[fix-breaks] Error:', error);
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: String(error),
    }, { status: 500 });
  }
}
