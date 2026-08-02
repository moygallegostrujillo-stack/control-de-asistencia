// ============================================================
// GET /api/alerts/supervisor-alerts
// Detecta patrones críticos de asistencia que requieren
// atención del supervisor/administrador.
//
// Alertas que genera:
// 1. RETARDOS_RECURRENTES — empleado con 3+ retardos en la semana
// 2. AUSENCIA_CONSECUTIVA — empleado con 3+ días consecutivos ausente
// 3. EXCESO_DESCANSO — empleado que excedió descanso 2+ veces en la semana
// 4. SALIDAS_TEMPRANO — empleado con 3+ salidas temprano en la semana
// 5. SIN_CHECKOUT — registros de hoy sin checkout (empleado se fue sin registrar)
//
// Query params:
//   ?days=N (default: 7 — ventana de análisis)
//   ?sucursalId=X (GA puede elegir; SUCURSAL_ADMIN forzado al propio)
//
// Respuesta: { alerts: [...], summary: { total, byType, bySeverity } }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  isGeneralAdmin,
} from '@/lib/auth';
import { getMexicoNow, getMexicoTodayDate, toISODate } from '@/lib/timezone';
import { computeAbsentsForDate } from '@/lib/absence-calculator';

type AlertType = 'RETARDOS_RECURRENTES' | 'AUSENCIA_CONSECUTIVA' | 'EXCESO_DESCANSO' | 'SALIDAS_TEMPRANO' | 'SIN_CHECKOUT';
type Severity = 'critical' | 'warning' | 'info';

interface Alert {
  id: string;
  type: AlertType;
  severity: Severity;
  title: string;
  description: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  sucursalName: string;
  sucursalId: string | null;
  count: number;
  meta: Record<string, any>;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    // Solo admin/supervisor pueden ver alertas
    if (user.role === 'EMPLOYEE') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get('days');
    const days = daysParam ? Math.min(Math.max(parseInt(daysParam, 10) || 7, 1), 30) : 7;
    const querySucursalId = searchParams.get('sucursalId');

    // Determinar sucursal
    let sucursalId: string | undefined;
    if (isGeneralAdmin(user)) {
      sucursalId = querySucursalId || undefined;
    } else {
      sucursalId = user.sucursalId || undefined;
    }

    // Ventana de análisis: últimos N días
    const now = getMexicoNow();
    const startDate = now.minus({ days }).toJSDate();
    const todayDate = getMexicoTodayDate();

    // Cargar registros de la ventana
    const records = await db.attendanceRecord.findMany({
      where: {
        date: { gte: startDate, lte: todayDate },
        ...(sucursalId ? { sucursalId } : {}),
      },
      include: {
        employee: {
          include: {
            user: { select: { name: true } },
            sucursal: { select: { name: true, codigoLocal: true } },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Agrupar registros por empleado
    const byEmployee = new Map<string, any[]>();
    for (const r of records) {
      const empId = r.employeeId;
      if (!byEmployee.has(empId)) byEmployee.set(empId, []);
      byEmployee.get(empId)!.push(r);
    }

    const alerts: Alert[] = [];

    // --- 1. RETARDOS_RECURRENTES ---
    for (const [empId, recs] of byEmployee) {
      const lateCount = recs.filter((r) => r.status === 'LATE').length;
      if (lateCount >= 3) {
        const emp = recs[0].employee;
        alerts.push({
          id: `retardos-${empId}`,
          type: 'RETARDOS_RECURRENTES',
          severity: lateCount >= 5 ? 'critical' : 'warning',
          title: `${lateCount} retardos en ${days} días`,
          description: `${emp.user.name} ha llegado tarde ${lateCount} veces en los últimos ${days} días.`,
          employeeId: empId,
          employeeName: emp.user.name,
          employeeNumber: emp.employeeNumber,
          sucursalName: emp.sucursal?.name || '—',
          sucursalId: emp.sucursalId,
          count: lateCount,
          meta: { days },
        });
      }
    }

    // --- 2. AUSENCIA_CONSECUTIVA ---
    // Calcular ausentes de hoy y ayer
    const todayAbsents = await computeAbsentsForDate(todayDate, sucursalId);
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayAbsents = await computeAbsentsForDate(yesterdayDate, sucursalId);
    const dayBeforeYesterday = new Date(todayDate);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
    const dayBeforeAbsents = await computeAbsentsForDate(dayBeforeYesterday, sucursalId);

    // Mapear ausentes por empleado
    const absentMap = new Map<string, string[]>();
    for (const a of todayAbsents) {
      if (!absentMap.has(a.id)) absentMap.set(a.id, []);
      absentMap.get(a.id)!.push(toISODate(todayDate));
    }
    for (const a of yesterdayAbsents) {
      if (!absentMap.has(a.id)) absentMap.set(a.id, []);
      absentMap.get(a.id)!.push(toISODate(yesterdayDate));
    }
    for (const a of dayBeforeAbsents) {
      if (!absentMap.has(a.id)) absentMap.set(a.id, []);
      absentMap.get(a.id)!.push(toISODate(dayBeforeYesterday));
    }

    for (const [empId, dates] of absentMap) {
      if (dates.length >= 3) {
        // Encontrar el empleado en los absents
        const emp = todayAbsents.find((a) => a.id === empId)
          || yesterdayAbsents.find((a) => a.id === empId)
          || dayBeforeAbsents.find((a) => a.id === empId);
        if (emp) {
          alerts.push({
            id: `ausencia-${empId}`,
            type: 'AUSENCIA_CONSECUTIVA',
            severity: 'critical',
            title: `${dates.length} días consecutivos ausente`,
            description: `${emp.name} no ha registrado asistencia en los últimos ${dates.length} días consecutivos.`,
            employeeId: empId,
            employeeName: emp.name,
            employeeNumber: emp.employeeNumber,
            sucursalName: emp.sucursalName || '—',
            sucursalId: null,
            count: dates.length,
            meta: { dates },
          });
        }
      }
    }

    // --- 3. EXCESO_DESCANSO ---
    for (const [empId, recs] of byEmployee) {
      const exceededCount = recs.filter((r) => r.mealExceeded || r.restExceeded).length;
      if (exceededCount >= 2) {
        const emp = recs[0].employee;
        alerts.push({
          id: `descanso-${empId}`,
          type: 'EXCESO_DESCANSO',
          severity: exceededCount >= 4 ? 'warning' : 'info',
          title: `${exceededCount} excesos de descanso`,
          description: `${emp.user.name} ha excedido el tiempo de descanso ${exceededCount} veces en los últimos ${days} días.`,
          employeeId: empId,
          employeeName: emp.user.name,
          employeeNumber: emp.employeeNumber,
          sucursalName: emp.sucursal?.name || '—',
          sucursalId: emp.sucursalId,
          count: exceededCount,
          meta: { days },
        });
      }
    }

    // --- 4. SALIDAS_TEMPRANO ---
    for (const [empId, recs] of byEmployee) {
      const earlyLeaveCount = recs.filter((r) => r.status === 'EARLY_LEAVE').length;
      if (earlyLeaveCount >= 3) {
        const emp = recs[0].employee;
        alerts.push({
          id: `salidas-${empId}`,
          type: 'SALIDAS_TEMPRANO',
          severity: earlyLeaveCount >= 5 ? 'warning' : 'info',
          title: `${earlyLeaveCount} salidas temprano`,
          description: `${emp.user.name} ha salido antes de tiempo ${earlyLeaveCount} veces en los últimos ${days} días.`,
          employeeId: empId,
          employeeName: emp.user.name,
          employeeNumber: emp.employeeNumber,
          sucursalName: emp.sucursal?.name || '—',
          sucursalId: emp.sucursalId,
          count: earlyLeaveCount,
          meta: { days },
        });
      }
    }

    // --- 5. SIN_CHECKOUT (hoy) ---
    const todayRecords = records.filter((r) => toISODate(r.date) === toISODate(todayDate));
    for (const r of todayRecords) {
      if (r.checkInTime && !r.checkOutTime) {
        // Solo alertar si ya pasaron al menos 8 horas desde el check-in
        const checkInTime = r.checkInTime instanceof Date ? r.checkInTime.getTime() : 0;
        const hoursSinceCheckIn = (Date.now() - checkInTime) / 3600000;
        if (hoursSinceCheckIn >= 8) {
          const emp = r.employee;
          alerts.push({
            id: `no-checkout-${r.id}`,
            type: 'SIN_CHECKOUT',
            severity: 'warning',
            title: 'Sin registro de salida',
            description: `${emp.user.name} registró entrada hace ${Math.round(hoursSinceCheckIn)}h pero no ha registrado salida.`,
            employeeId: r.employeeId,
            employeeName: emp.user.name,
            employeeNumber: emp.employeeNumber,
            sucursalName: emp.sucursal?.name || '—',
            sucursalId: emp.sucursalId,
            count: 1,
            meta: { hoursSinceCheckIn: Math.round(hoursSinceCheckIn) },
          });
        }
      }
    }

    // Ordenar por severidad (critical primero)
    const severityOrder: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Summary
    const summary = {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
      info: alerts.filter((a) => a.severity === 'info').length,
      byType: {
        RETARDOS_RECURRENTES: alerts.filter((a) => a.type === 'RETARDOS_RECURRENTES').length,
        AUSENCIA_CONSECUTIVA: alerts.filter((a) => a.type === 'AUSENCIA_CONSECUTIVA').length,
        EXCESO_DESCANSO: alerts.filter((a) => a.type === 'EXCESO_DESCANSO').length,
        SALIDAS_TEMPRANO: alerts.filter((a) => a.type === 'SALIDAS_TEMPRANO').length,
        SIN_CHECKOUT: alerts.filter((a) => a.type === 'SIN_CHECKOUT').length,
      },
    };

    return NextResponse.json({ alerts, summary, days });
  } catch (error) {
    console.error('[supervisor-alerts] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
