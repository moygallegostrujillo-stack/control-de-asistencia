// ============================================================
// /api/reports/nom-035 — GET
//   Reporte server-side de alertas NOM-035 (categoría A.5 — Jornadas
//   de trabajo excesivas) en formato XLSX o PDF.
//
//   Este endpoint reutiliza la MISMA lógica de /api/alerts/nom-035
//   para detectar alertas, pero las exporta en un formato adecuado
//   para inspección STPS o evidencia documental.
//
//   Query params:
//     ?format=xlsx (default) | pdf
//     ?week=current (default) | last
//     ?sucursalId=... (opcional, solo GENERAL_ADMIN)
//
//   Acceso: ADMIN (cualquier rol). SUCURSAL_ADMIN ve solo su sucursal.
//
//   Fix histórico (26-ago-2026): antes solo existía CSV client-side
//   dentro de NOM035View. Ahora hay reporte server-side para mayor
//   trazabilidad y formato profesional.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import {
  getAuthUser,
  getSucursalFilter,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import {
  getDayOfWeek,
  toISODate,
} from '@/lib/timezone';
import { getWeeklyOvertimeCapMinutes } from '@/lib/overtime-calculator';

type AlertLevel = 'HIGH' | 'MEDIUM' | 'LOW';
type AlertType = 'WEEKLY_OVERTIME_EXCEEDED' | 'DAILY_OVERTIME_EXCEEDED' | 'CONSECUTIVE_LONG_DAYS' | 'NO_WEEKLY_REST' | 'REST_DAY_WORKED';

interface NOM035Alert {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  sucursalId: string;
  sucursalName: string;
  sucursalCodigoLocal: string | null;
  date?: string; // solo para REST_DAY_WORKED
  type: AlertType;
  level: AlertLevel;
  title: string;
  description: string;
  metric: {
    weeklyOvertimeMinutes: number;
    weeklyOvertimeCapMinutes: number;
    maxDailyOvertimeMinutes: number;
    consecutiveLongDays: number;
  };
  recommendation: string;
  legalReference: string;
}

const TYPE_LABELS: Record<AlertType, string> = {
  WEEKLY_OVERTIME_EXCEEDED: 'Exceso de horas extra semanales',
  DAILY_OVERTIME_EXCEEDED: 'Jornada diaria excesiva',
  CONSECUTIVE_LONG_DAYS: 'Sobrecarga sostenida',
  NO_WEEKLY_REST: 'Sin día de descanso',
  REST_DAY_WORKED: 'Día de descanso trabajado',
};

const LEVEL_LABELS: Record<AlertLevel, string> = {
  HIGH: 'ALTA',
  MEDIUM: 'MEDIA',
  LOW: 'BAJA',
};

async function computeAlerts(weekParam: string, sucursalFilter: any) {
  const today = new Date();
  const todayDow = getDayOfWeek(today);
  const daysFromMonday = (todayDow + 6) % 7;

  let monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - daysFromMonday);

  if (weekParam === 'last') {
    monday.setDate(monday.getDate() - 7);
  }

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 7);
  sunday.setMilliseconds(-1);

  const employees = await db.employee.findMany({
    where: {
      isActive: true,
      ...sucursalFilter,
    },
    include: {
      user: { select: { id: true, name: true } },
      sucursal: { select: { id: true, name: true, codigoLocal: true } },
      workSchedules: { select: { dayOfWeek: true, isWeeklyRest: true } },
    },
  });

  if (employees.length === 0) {
    return { alerts: [] as NOM035Alert[], monday, sunday, employeesCount: 0 };
  }

  const records = await db.attendanceRecord.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      date: { gte: monday, lte: sunday },
    },
    orderBy: { date: 'asc' },
  });

  const recordsByEmployee = new Map<string, typeof records>();
  for (const r of records) {
    const list = recordsByEmployee.get(r.employeeId) || [];
    list.push(r);
    recordsByEmployee.set(r.employeeId, list);
  }

  const alerts: NOM035Alert[] = [];
  const year = monday.getFullYear();
  const weeklyCap = getWeeklyOvertimeCapMinutes(year);

  for (const emp of employees) {
    const empRecords = recordsByEmployee.get(emp.id) || [];

    const weeklyOvertimeMinutes = empRecords.reduce(
      (sum, r) => sum + (r.overtimeDoubleMinutes || 0) + (r.overtimeTripleMinutes || 0),
      0
    );

    const maxDailyOvertimeMinutes = empRecords.reduce(
      (max, r) => Math.max(max, (r.overtimeDoubleMinutes || 0) + (r.overtimeTripleMinutes || 0)),
      0
    );

    let consecutiveLongDays = 0;
    let maxStreak = 0;
    for (const r of empRecords) {
      const ot = (r.overtimeDoubleMinutes || 0) + (r.overtimeTripleMinutes || 0);
      if (ot > 0) {
        consecutiveLongDays++;
        maxStreak = Math.max(maxStreak, consecutiveLongDays);
      } else {
        consecutiveLongDays = 0;
      }
    }
    consecutiveLongDays = maxStreak;

    const hasWeeklyRest = emp.workSchedules.some((s) => s.isWeeklyRest);

    const baseInfo = {
      employeeId: emp.id,
      employeeName: emp.user.name,
      employeeNumber: emp.employeeNumber,
      sucursalId: emp.sucursalId,
      sucursalName: emp.sucursal.name,
      sucursalCodigoLocal: emp.sucursal.codigoLocal,
    };

    const metric = {
      weeklyOvertimeMinutes,
      weeklyOvertimeCapMinutes: weeklyCap,
      maxDailyOvertimeMinutes,
      consecutiveLongDays,
    };

    if (weeklyOvertimeMinutes > weeklyCap) {
      const excess = weeklyOvertimeMinutes - weeklyCap;
      alerts.push({
        ...baseInfo,
        type: 'WEEKLY_OVERTIME_EXCEEDED',
        level: excess > 180 ? 'HIGH' : 'MEDIUM',
        title: `Exceso de horas extra semanales`,
        description: `${(weeklyOvertimeMinutes / 60).toFixed(1)}h extra esta semana (tope ${(weeklyCap / 60).toFixed(0)}h). Excedente: ${(excess / 60).toFixed(1)}h.`,
        metric,
        recommendation: 'Redistribuir carga, contratar personal, o autorizar expresamente las horas triple. Documentar la causa.',
        legalReference: 'LFT art. 66/68 (tope semanal 9h, triple)',
      });
    }

    if (maxDailyOvertimeMinutes > 240) {
      alerts.push({
        ...baseInfo,
        type: 'DAILY_OVERTIME_EXCEEDED',
        level: 'HIGH',
        title: `Jornada diaria excesiva`,
        description: `Un día con ${(maxDailyOvertimeMinutes / 60).toFixed(1)}h extra (tope diario 4h, art. 66 LFT).`,
        metric,
        recommendation: 'Evitar asignar >4h extra en un solo día. Si fue emergencia, documentarla.',
        legalReference: 'LFT art. 66 (tope diario 4h)',
      });
    }

    if (consecutiveLongDays >= 3) {
      alerts.push({
        ...baseInfo,
        type: 'CONSECUTIVE_LONG_DAYS',
        level: consecutiveLongDays >= 5 ? 'HIGH' : 'MEDIUM',
        title: `Sobrecarga sostenida`,
        description: `${consecutiveLongDays} días consecutivos con horas extra esta semana.`,
        metric,
        recommendation: 'Revisar carga laboral y organizar turnos. Aplicar NOM-035 identificación de riesgos.',
        legalReference: 'LFT arts. 66/68; identificación de sobrecarga sostenida',
      });
    }

    if (!hasWeeklyRest) {
      alerts.push({
        ...baseInfo,
        type: 'NO_WEEKLY_REST',
        level: 'HIGH',
        title: `Sin día de descanso configurado`,
        description: 'El empleado no tiene ningún día marcado como descanso semanal en su horario.',
        metric,
        recommendation: 'Editar el empleado y marcar al menos 1 día como "Descanso" en su horario.',
        legalReference: 'LFT art. 71 (descanso semanal obligatorio)',
      });
    }

    for (const r of empRecords) {
      if (!r.isRestDayWorked) continue;
      const workedMin = r.restDayWorkedMinutes ?? 0;
      const level: AlertLevel = r.isSunday ? 'HIGH' : 'MEDIUM';
      const dayLabel = r.isSunday ? 'domingo' : 'día de descanso';
      alerts.push({
        ...baseInfo,
        date: toISODate(r.date),
        type: 'REST_DAY_WORKED',
        level,
        title: `Día de descanso trabajado`,
        description: `El empleado trabajó en su ${dayLabel} el ${toISODate(r.date)}. Minutos trabajados: ${workedMin} (${(workedMin / 60).toFixed(1)}h). Aplica prima del 100% adicional (art. 73 LFT).${r.isSunday ? ' También aplica prima dominical (art. 71 LFT).' : ''}`,
        metric,
        recommendation: 'Pagar jornada completa con prima del 100% adicional. Si fue domingo, también prima dominical.',
        legalReference: 'LFT art. 73; art. 71 (prima dominical)',
      });
    }
  }

  const levelOrder: Record<AlertLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  return { alerts, monday, sunday, employeesCount: employees.length, weeklyCap };
}

async function generateXLSX(
  alerts: NOM035Alert[],
  monday: Date,
  sunday: Date,
  employeesCount: number,
  weeklyCap: number,
  sucursalFilter: any
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Control de Asistencia — Sistema NOM-035';
  wb.created = new Date();

  // ---- Hoja 1: Resumen ----
  const ws1 = wb.addWorksheet('Resumen', {
    properties: { defaultColWidth: 30 },
  });

  ws1.getCell('A1').value = 'REPORTE DE ALERTAS NOM-035';
  ws1.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF1F2937' } };
  ws1.getCell('A1').alignment = { vertical: 'middle' };
  ws1.getRow(1).height = 28;

  ws1.getCell('A3').value = 'Periodo:';
  ws1.getCell('B3').value = `${toISODate(monday)} a ${toISODate(sunday)}`;
  ws1.getCell('A4').value = 'Empleados revisados:';
  ws1.getCell('B4').value = employeesCount;
  ws1.getCell('A5').value = 'Tope semanal LFT (art. 66):';
  ws1.getCell('B5').value = `${(weeklyCap / 60).toFixed(0)}h (${weeklyCap} min)`;
  ws1.getCell('A6').value = 'Total de alertas:';
  ws1.getCell('B6').value = alerts.length;
  ws1.getCell('A7').value = 'Alertas ALTAS (HIGH):';
  ws1.getCell('B7').value = alerts.filter(a => a.level === 'HIGH').length;
  ws1.getCell('A8').value = 'Alertas MEDIAS (MEDIUM):';
  ws1.getCell('B8').value = alerts.filter(a => a.level === 'MEDIUM').length;
  ws1.getCell('A9').value = 'Alertas BAJAS (LOW):';
  ws1.getCell('B9').value = alerts.filter(a => a.level === 'LOW').length;
  ws1.getCell('A10').value = 'Generado el:';
  ws1.getCell('B10').value = new Date().toISOString();
  ws1.getCell('A11').value = 'Filtro sucursal:';
  ws1.getCell('B11').value = sucursalFilter?.sucursalId ? 'Filtrado por sucursal' : 'Todas las sucursales';

  for (let i = 3; i <= 11; i++) {
    ws1.getCell(`A${i}`).font = { bold: true };
  }

  ws1.getCell('A13').value = 'Marco legal';
  ws1.getCell('A13').font = { bold: true, size: 12 };
  ws1.getCell('A14').value = 'LFT arts. 66, 68, 71, 73 — control de jornada y horas extra';
  ws1.getCell('A15').value = 'LFT art. 66 (tope semanal 9h y diario 4h)';
  ws1.getCell('A16').value = 'LFT art. 68 (horas triple)';
  ws1.getCell('A17').value = 'LFT art. 71 (descanso semanal)';
  ws1.getCell('A18').value = 'LFT art. 73 (prima del 100% por descanso trabajado)';

  // ---- Hoja 2: Detalle de alertas ----
  const ws2 = wb.addWorksheet('Alertas', {
    properties: { defaultColWidth: 25 },
  });

  const headers = [
    'Severidad', 'Tipo de alerta', 'Empleado', 'Número', 'Sucursal',
    'Local', 'Fecha', 'Título', 'Descripción',
    'Horas extra semanales (min)', 'Tope semanal (min)',
    'Máximo diario (min)', 'Días consecutivos',
    'Recomendación', 'Referencia legal',
  ];

  const headerRow = ws2.getRow(1);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });
  ws2.getRow(1).height = 32;

  // Color por severidad
  const severityColors: Record<AlertLevel, string> = {
    HIGH: 'FFE5E7EB', // rojo claro
    MEDIUM: 'FFFEF3C7', // ámbar claro
    LOW: 'FFF3F4F6', // gris claro
  };

  alerts.forEach((a, idx) => {
    const row = ws2.getRow(idx + 2);
    const values = [
      LEVEL_LABELS[a.level],
      TYPE_LABELS[a.type],
      a.employeeName,
      a.employeeNumber,
      a.sucursalName,
      a.sucursalCodigoLocal || '—',
      a.date || '—',
      a.title,
      a.description,
      a.metric.weeklyOvertimeMinutes,
      a.metric.weeklyOvertimeCapMinutes,
      a.metric.maxDailyOvertimeMinutes,
      a.metric.consecutiveLongDays,
      a.recommendation,
      a.legalReference,
    ];
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      cell.alignment = { vertical: 'top', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
    // Highlight severidad
    const sevCell = row.getCell(1);
    sevCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: severityColors[a.level] },
    };
    sevCell.font = { bold: true };
  });

  // Auto-width
  ws2.columns.forEach((col, i) => {
    if (i === 0) col.width = 10;
    else if (i === 1) col.width = 28;
    else if (i === 2) col.width = 32;
    else if (i === 3) col.width = 14;
    else if (i === 4) col.width = 22;
    else if (i === 5) col.width = 12;
    else if (i === 6) col.width = 12;
    else if (i === 7) col.width = 32;
    else if (i === 8) col.width = 60;
    else if (i === 9 || i === 10 || i === 11) col.width = 18;
    else if (i === 12) col.width = 14;
    else if (i === 13) col.width = 50;
    else if (i === 14) col.width = 40;
  });

  // Freeze panes
  ws2.views = [{ state: 'frozen', ySplit: 1 }];

  // Auto-filter
  ws2.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: alerts.length + 1, column: headers.length },
  };

  // ---- Hoja 3: Desglose por tipo ----
  const ws3 = wb.addWorksheet('Desglose por tipo', {
    properties: { defaultColWidth: 35 },
  });

  ws3.getCell('A1').value = 'Desglose de alertas por tipo';
  ws3.getCell('A1').font = { bold: true, size: 14 };

  ws3.getCell('A3').value = 'Tipo';
  ws3.getCell('B3').value = 'HIGH';
  ws3.getCell('C3').value = 'MEDIUM';
  ws3.getCell('D3').value = 'LOW';
  ws3.getCell('E3').value = 'Total';
  for (let i = 1; i <= 5; i++) {
    ws3.getCell(i + 0, 1).font = { bold: true };
    const c = ws3.getRow(3).getCell(i);
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };
  }

  const tipos: AlertType[] = [
    'WEEKLY_OVERTIME_EXCEEDED',
    'DAILY_OVERTIME_EXCEEDED',
    'CONSECUTIVE_LONG_DAYS',
    'NO_WEEKLY_REST',
    'REST_DAY_WORKED',
  ];
  tipos.forEach((t, idx) => {
    const row = ws3.getRow(idx + 4);
    const filtered = alerts.filter(a => a.type === t);
    row.getCell(1).value = TYPE_LABELS[t];
    row.getCell(2).value = filtered.filter(a => a.level === 'HIGH').length;
    row.getCell(3).value = filtered.filter(a => a.level === 'MEDIUM').length;
    row.getCell(4).value = filtered.filter(a => a.level === 'LOW').length;
    row.getCell(5).value = filtered.length;
  });

  return wb;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'xlsx';
    const weekParam = searchParams.get('week') || 'current';

    if (!['xlsx', 'pdf'].includes(format)) {
      return NextResponse.json(
        { error: 'format inválido (xlsx o pdf)' },
        { status: 400 }
      );
    }

    if (!['current', 'last'].includes(weekParam)) {
      return NextResponse.json(
        { error: 'week inválido (current o last)' },
        { status: 400 }
      );
    }

    const sucursalFilter = getSucursalFilter(user);

    const { alerts, monday, sunday, employeesCount, weeklyCap } = await computeAlerts(weekParam, sucursalFilter);

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'MANUAL_CORRECTION',
      entityType: 'NOM035_REPORT',
      entityId: 'nom-035-export',
      sucursalId: sucursalFilter?.sucursalId || undefined,
      ipAddress: ip,
      userAgent: ua,
      details: {
        performedBy: user.email,
        reason: `Exportación reporte NOM-035 (${format})`,
        week: weekParam,
        weekStart: toISODate(monday),
        weekEnd: toISODate(sunday),
        alertsCount: alerts.length,
        highCount: alerts.filter(a => a.level === 'HIGH').length,
        mediumCount: alerts.filter(a => a.level === 'MEDIUM').length,
        lowCount: alerts.filter(a => a.level === 'LOW').length,
      },
    });

    if (format === 'xlsx') {
      const wb = await generateXLSX(alerts, monday, sunday, employeesCount, weeklyCap, sucursalFilter);
      const buffer = await wb.xlsx.writeBuffer();
      const filename = `reporte_nom035_${toISODate(monday)}_a_${toISODate(sunday)}.xlsx`;
      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-Report-Alerts': String(alerts.length),
          'X-Report-Week': `${toISODate(monday)}/${toISODate(sunday)}`,
        },
      });
    }

    // PDF format: por ahora devolvemos un mensaje indicando que use XLSX
    // (implementación PDF se puede agregar después con pdfkit si se requiere)
    return NextResponse.json(
      {
        error: 'Formato PDF no implementado todavía. Use format=xlsx.',
        suggestion: 'El XLSX incluye las mismas 3 hojas (Resumen, Alertas, Desglose por tipo) con formato profesional.',
      },
      { status: 501 }
    );
  } catch (error) {
    console.error('GET /api/reports/nom-035 error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
