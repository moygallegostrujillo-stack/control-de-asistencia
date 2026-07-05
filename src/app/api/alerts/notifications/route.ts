// ============================================================
// /api/alerts/notifications — GET
//   Endpoint liviano que devuelve un resumen de alertas NOM-035
//   activas (últimas 24h) para alimentar el badge + dropdown de
//   notificaciones del admin (polling cada 60s desde el cliente).
//
//   Fuente de datos: entradas del AuditLog con
//   action='NOM035_ALERT_WEEKLY_OVERTIME' creadas automáticamente
//   por el endpoint /api/attendance/check-out cuando un empleado
//   cruza el tope semanal de horas extra (9h en 2027 → 12h en 2030).
//
//   Acceso: ADMIN (cualquier rol). SUCURSAL_ADMIN ve solo su sucursal.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  getSucursalFilter,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
} from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const sucursalFilter = getSucursalFilter(user);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentAlerts = await db.auditLog.findMany({
      where: {
        action: 'NOM035_ALERT_WEEKLY_OVERTIME',
        createdAt: { gte: since },
        ...sucursalFilter,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Deduplicar por employeeId (quedarnos con el más reciente)
    const seenEmployees = new Set<string>();
    const deduped = recentAlerts.filter((a) => {
      let empId: string | null = null;
      try {
        const d = JSON.parse(a.details || '{}');
        empId = d.employeeId || null;
      } catch {}
      if (!empId || seenEmployees.has(empId)) return false;
      seenEmployees.add(empId);
      return true;
    });

    // Mapear a formato de notificación
    const alerts = deduped.map((a) => {
      let d: any = {};
      try { d = JSON.parse(a.details || '{}'); } catch {}
      const excessMinutes = d.excessMinutes || 0;
      const weeklyTotal = d.weeklyOvertimeMinutes || 0;
      const cap = d.weeklyOvertimeCapMinutes || 540;
      return {
        id: a.id,
        employeeId: d.employeeId,
        employeeName: d.employeeName || 'Empleado',
        employeeNumber: d.employeeNumber || '',
        type: 'WEEKLY_OVERTIME_EXCEEDED' as const,
        level: (d.alertLevel || (excessMinutes > 180 ? 'HIGH' : 'MEDIUM')) as 'HIGH' | 'MEDIUM',
        title: `Exceso de horas extra semanales (${d.employeeName || 'Empleado'})`,
        description: `${(weeklyTotal / 60).toFixed(1)}h extra esta semana (tope ${(cap / 60).toFixed(0)}h). Excedente: ${(excessMinutes / 60).toFixed(1)}h.`,
        createdAt: a.createdAt.toISOString(),
        sucursalId: a.sucursalId,
      };
    });

    const summary = {
      total: alerts.length,
      high: alerts.filter((a) => a.level === 'HIGH').length,
      medium: alerts.filter((a) => a.level === 'MEDIUM').length,
      lastCheckedAt: new Date().toISOString(),
    };

    return NextResponse.json({ summary, alerts });
  } catch (error) {
    console.error('GET /api/alerts/notifications error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
