// ============================================================
// POST /api/admin/fix-schedule-endtime
// Migración: corrige WorkSchedule.endTime de 18:00 a 17:00.
//
// Contexto (fix #4, 20-ago-2026):
//   La jornada de 8h diurna INCLUYE el descanso de 30min (LFT arts. 58/60/63).
//   El seed original puso endTime='18:00' (9h), cuando debería ser '17:00' (8h).
//   Este endpoint corrige los horarios afectados y recalcula overtime.
//
// Parámetros (body JSON):
//   dryRun (bool, default true): si true, solo reporta cambios sin ejecutar.
//   sucursalId (string, opcional): filtrar por sucursal.
//   confirm (bool, default false): debe ser true para ejecutar (seguridad).
//
// NOTA: después de ejecutar este endpoint, correr POST /api/admin/recalc-overtime
// para que los registros históricos de asistencia se recalcule con los nuevos horarios.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (user.role !== 'GENERAL_ADMIN') return forbiddenResponse();

    const body = await req.json().catch(() => ({}));
    const { dryRun = true, sucursalId, confirm = false } = body as {
      dryRun?: boolean;
      sucursalId?: string;
      confirm?: boolean;
    };

    // Buscar schedules laborales con endTime='18:00' y startTime='09:00'
    // (duración de 9h = 540 min, cuando debería ser 8h = 480 min).
    const where: any = {
      endTime: '18:00',
      startTime: '09:00',
      isWeeklyRest: false,
    };
    if (sucursalId) {
      where.employee = { sucursalId };
    }

    const schedules = await db.workSchedule.findMany({
      where,
      include: {
        employee: {
          include: {
            user: { select: { name: true, email: true } },
            sucursal: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (schedules.length === 0) {
      return NextResponse.json({
        message: 'No se encontraron schedules con startTime=09:00 y endTime=18:00.',
        scanned: 0,
        toFix: 0,
      });
    }

    // Preparar detalle
    const details = schedules.map(s => ({
      scheduleId: s.id,
      employeeName: s.employee.user.name,
      sucursalName: s.employee.sucursal.name,
      dayOfWeek: s.dayOfWeek,
      oldStart: s.startTime,
      oldEnd: s.endTime,
      oldDuration: '9h (540 min)',
      newStart: s.startTime,
      newEnd: '17:00',
      newDuration: '8h (480 min)',
    }));

    const { ip, ua } = getIpAndUA(req);

    if (!confirm || dryRun) {
      // Solo reporte, no ejecutar
      await auditLog({
        userId: user.id,
        action: 'MANUAL_CORRECTION',
        entityType: 'WORK_SCHEDULE',
        entityId: 'fix-schedule-endtime-dryrun',
        ipAddress: ip,
        userAgent: ua,
        details: {
          performedBy: user.email,
          reason: `fix #4 — revisión de schedules 9h→8h (dryRun). Encontrados ${schedules.length} schedules con endTime='18:00'.`,
          schedulesFound: details,
        },
      });

      return NextResponse.json({
        message: `Se encontraron ${schedules.length} schedules con duración de 9h (09:00-18:00). Deben cambiarse a 8h (09:00-17:00). Ejecuta con { confirm: true, dryRun: false } para aplicar.`,
        scanned: schedules.length,
        toFix: schedules.length,
        dryRun: true,
        details,
      });
    }

    // ---- EJECUTAR CAMBIOS ----
    const ids = schedules.map(s => s.id);

    const result = await db.workSchedule.updateMany({
      where: { id: { in: ids } },
      data: { endTime: '17:00' },
    });

    await auditLog({
      userId: user.id,
      action: 'MANUAL_CORRECTION',
      entityType: 'WORK_SCHEDULE',
      entityId: 'fix-schedule-endtime-applied',
      ipAddress: ip,
      userAgent: ua,
      details: {
        performedBy: user.email,
        reason: `fix #4 — schedules corregidos de endTime='18:00' a endTime='17:00'. Jornada de 8h incluyendo 30min comida (LFT arts. 58/60/63).`,
        schedulesUpdated: details,
        count: result.count,
      },
    });

    return NextResponse.json({
      message: `Se actualizaron ${result.count} schedules de endTime='18:00' a endTime='17:00'.`,
      scanned: schedules.length,
      updated: result.count,
      dryRun: false,
      details,
      nextStep: 'Ejecuta POST /api/admin/recalc-overtime para recalcular los registros de asistencia afectados.',
    });
  } catch (error) {
    console.error('fix-schedule-endtime error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
