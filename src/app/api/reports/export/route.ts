// ============================================================
// /api/reports/export — GET
//   Exportación de reportes en CSV o XLSX (exceljs).
//   fix #2 — overtime con tolerancia (calculateOvertime).
//   fix #3 — hoja "Portada" con datos de la empresa.
//   fix #4 — XLSX real con exceljs (bordes, freeze, auto-width).
//   fix #5/#11 — datos consolidados usando isAbsentOnDate.
//   Query params:
//     type=daily|overtime|absences|incidences|comparative
//     startDate=YYYY-MM-DD  endDate=YYYY-MM-DD
//     sucursalId=...  format=csv|xlsx
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
  isGeneralAdmin,
} from '@/lib/auth';
import {
  toISODate,
  getMexicoTodayISO,
  minutesToHours,
  formatTimeInMexico,
} from '@/lib/timezone';
import {
  isAbsentOnDate,
  loadActiveEmployees,
  loadSchedules,
  loadRecords,
  loadApprovedVacations,
  loadHolidays,
  computeAbsentsForDate,
} from '@/lib/absence-calculator';
import { auditLog, getIpAndUA } from '@/lib/audit';

// Reforma LFT 2027 — art. 804 LFT: conservación mínima 12 meses.
// Permitimos hasta 366 días (año bisiesto) por export para no obligar a
// múltiples descargas al patrón cuando la STPS solicite el registro anual.
const MAX_RANGE_DAYS = 366;

// Mapeo de estados a español
const STATUS_ES: Record<string, string> = {
  PRESENT: 'Presente',
  LATE: 'Retardo',
  ABSENT: 'Ausente',
  EARLY_LEAVE: 'Salida Anticipada',
};

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { searchParams } = new URL(req.url);
    const reportType = (searchParams.get('type') || 'daily').toLowerCase();
    const startDateStr =
      searchParams.get('startDate') || getMexicoTodayISO();
    const endDateStr = searchParams.get('endDate') || getMexicoTodayISO();
    const requestedSucursalId = searchParams.get('sucursalId');
    const format = (searchParams.get('format') || 'csv').toLowerCase();

    // SUCURSAL_ADMIN: forzar su sucursal
    const sucursalId =
      user.role === 'SUCURSAL_ADMIN' ? user.sucursalId : requestedSucursalId;

    // Validar formato
    if (!['csv', 'xlsx'].includes(format)) {
      return NextResponse.json(
        { error: 'format inválido (csv o xlsx)' },
        { status: 400 }
      );
    }
    // Validar tipo
    if (
      !['daily', 'overtime', 'absences', 'incidences', 'comparative'].includes(
        reportType
      )
    ) {
      return NextResponse.json(
        { error: 'type inválido' },
        { status: 400 }
      );
    }
    // comparative requiere GENERAL_ADMIN
    if (reportType === 'comparative' && !isGeneralAdmin(user)) {
      return forbiddenResponse();
    }

    // Validar rango
    const start = new Date(`${startDateStr}T00:00:00.000Z`);
    const end = new Date(`${endDateStr}T23:59:59.999Z`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Fechas inválidas (use YYYY-MM-DD)' },
        { status: 400 }
      );
    }
    if (start > end) {
      return NextResponse.json(
        { error: 'startDate no puede ser mayor a endDate' },
        { status: 400 }
      );
    }
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Rango máximo permitido: ${MAX_RANGE_DAYS} días` },
        { status: 400 }
      );
    }

    // Datos de la empresa (fix #3)
    const company = await db.company.findUnique({
      where: { id: 'singleton' },
    });

    // Construir el dataset según el tipo de reporte
    const { rows, summaryRows, auditRows } = await buildReportData(
      reportType,
      startDateStr,
      endDateStr,
      sucursalId
    );

    // Auditoría
    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'EXPORT_REPORT',
      entityType: 'REPORT',
      entityId: null,
      sucursalId: sucursalId || null,
      ipAddress: ip,
      userAgent: ua,
      details: { reportType, format, startDate: startDateStr, endDate: endDateStr, sucursalId },
    });

    const filename = `Reporte_${reportType}_${startDateStr}_${endDateStr}`;

    // ---------- CSV ----------
    if (format === 'csv') {
      if (rows.length === 0) {
        return NextResponse.json(
          { error: 'No hay datos para exportar' },
          { status: 404 }
        );
      }
      const headers = Object.keys(rows[0]);
      const csvLines = [
        headers.join(','),
        ...rows.map((row: Record<string, any>) =>
          headers
            .map((h) => {
              const val = row[h];
              if (val === null || val === undefined) return '';
              const s = String(val);
              return s.includes(',') || s.includes('"') || s.includes('\n')
                ? `"${s.replace(/"/g, '""')}"`
                : s;
            })
            .join(',')
        ),
      ];
      const csvContent = csvLines.join('\n');
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    }

    // ---------- XLSX ----------
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Control de Asistencia v2.2';
    wb.created = new Date();

    // ---- Sheet 1: Portada (fix #3)
    const portada = wb.addWorksheet('Portada');
    portada.columns = [
      { width: 28 },
      { width: 60 },
    ];
    portada.addRow(['REPORTE DE ASISTENCIA']);
    portada.getCell('A1').font = { bold: true, size: 16 };
    portada.addRow([]);
    const reportLabels: Record<string, string> = {
      daily: 'Reporte Diario',
      overtime: 'Horas Extra',
      absences: 'Ausencias',
      incidences: 'Incidencias Consolidadas',
      comparative: 'Comparativo entre Sucursales',
    };
    const portadaRows: (string | null | undefined)[][] = [
      ['Tipo de Reporte', reportLabels[reportType] || reportType],
      ['Periodo', `${startDateStr} a ${endDateStr}`],
      ['Generado el', new Date().toLocaleString('es-MX')],
      ['Generado por', user.name],
      [],
      ['DATOS DE LA EMPRESA'],
      ['Razón Social', company?.razonSocial || '—'],
      ['RFC', company?.rfc || '—'],
      ['Registro Patronal', company?.registroPatronal || '—'],
      ['Domicilio Fiscal', company?.domicilioFiscal || '—'],
      ['Teléfono', company?.telefono || '—'],
      ['Email', company?.email || '—'],
      ['Representante Legal', company?.representanteLegal || '—'],
    ];
    for (const r of portadaRows) {
      portada.addRow(r);
    }
    // Marca el título de sección "DATOS DE LA EMPRESA" en negritas
    const sectionRow = portada.getRow(9);
    sectionRow.font = { bold: true, size: 12 };
    // Marca las etiquetas (col A) en negritas
    for (let i = 2; i <= portada.rowCount; i++) {
      const cell = portada.getCell(`A${i}`);
      if (cell.value && i !== 9) cell.font = { bold: true };
    }

    // ---- Sheet 2: Datos
    const datos = wb.addWorksheet('Datos');
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      datos.columns = headers.map((h) => ({
        header: h,
        key: h,
        width: Math.max(12, Math.min(40, h.length + 4)),
      }));
      for (const row of rows) {
        datos.addRow(row);
      }
      // Estilo de encabezados
      const headerRow = datos.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E78' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
      headerRow.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
      // Bordes para todas las celdas con datos
      for (let r = 1; r <= datos.rowCount; r++) {
        for (let c = 1; c <= headers.length; c++) {
          const cell = datos.getRow(r).getCell(c);
          cell.border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
          };
        }
      }
      datos.views = [{ state: 'frozen', ySplit: 1 }];
    } else {
      datos.addRow(['Sin datos para el periodo seleccionado']);
    }

    // ---- Sheet 3: Resumen
    const resumen = wb.addWorksheet('Resumen');
    resumen.columns = [
      { width: 36 },
      { width: 22 },
    ];
    resumen.addRow(['RESUMEN']);
    resumen.getCell('A1').font = { bold: true, size: 14 };
    resumen.addRow([]);
    for (const s of summaryRows) {
      resumen.addRow(s);
    }
    for (let i = 3; i <= resumen.rowCount; i++) {
      resumen.getCell(`A${i}`).font = { bold: true };
      resumen.getCell(`A${i}`).border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
      resumen.getCell(`B${i}`).border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    }

    // ---- Sheet 4: Auditoría (sólo daily — lat/long)
    if (reportType === 'daily' && auditRows && auditRows.length > 0) {
      const aud = wb.addWorksheet('Auditoría');
      const headers = Object.keys(auditRows[0]);
      aud.columns = headers.map((h) => ({
        header: h,
        key: h,
        width: Math.max(12, Math.min(40, h.length + 4)),
      }));
      for (const row of auditRows) {
        aud.addRow(row);
      }
      const hr = aud.getRow(1);
      hr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      hr.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF7F7F7F' },
      };
      aud.views = [{ state: 'frozen', ySplit: 1 }];
    }

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (error) {
    console.error('GET /api/reports/export error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ============================================================
// Construye el dataset (rows + summaryRows + auditRows) según tipo.
// ============================================================
async function buildReportData(
  reportType: string,
  startDateStr: string,
  endDateStr: string,
  sucursalId: string | null | undefined
): Promise<{
  rows: Record<string, any>[];
  summaryRows: (string | number)[][];
  auditRows?: Record<string, any>[];
}> {
  const start = new Date(`${startDateStr}T00:00:00.000Z`);
  const end = new Date(`${endDateStr}T23:59:59.999Z`);
  const todayISO = getMexicoTodayISO();
  const effectiveEndStr = endDateStr > todayISO ? todayISO : endDateStr;
  const effectiveEnd = new Date(`${effectiveEndStr}T23:59:59.999Z`);

  if (reportType === 'daily') {
    return await buildDailyRows(start, end, sucursalId);
  }
  if (reportType === 'overtime') {
    return await buildOvertimeRows(start, end, sucursalId);
  }
  if (reportType === 'absences') {
    return await buildAbsencesRows(start, end, effectiveEnd, sucursalId);
  }
  if (reportType === 'incidences') {
    return await buildIncidencesRows(start, end, effectiveEnd, sucursalId);
  }
  if (reportType === 'comparative') {
    return await buildComparativeRows(start, end, effectiveEnd);
  }
  return { rows: [], summaryRows: [] };
}

// -------- DAILY --------
async function buildDailyRows(
  start: Date,
  end: Date,
  sucursalId: string | null | undefined
) {
  const where: any = { date: { gte: start, lte: end } };
  if (sucursalId) where.sucursalId = sucursalId;

  const records = await db.attendanceRecord.findMany({
    where,
    include: {
      employee: {
        include: {
          user: { select: { name: true } },
          sucursal: { select: { id: true, name: true, codigoLocal: true } },
        },
      },
      sucursal: {
        select: {
          id: true,
          name: true,
          codigoLocal: true,
          checkoutToleranceMinutes: true,
        },
      },
    },
    orderBy: [{ sucursalId: 'asc' }, { employee: { employeeNumber: 'asc' } }],
  });

  // Reforma LFT 2027 — dobles/triples y prima descanso ya persistidos por
  // check-out. No se requiere cargar WorkSchedules (no se recalcula overtime).

  const rows: Record<string, any>[] = [];
  const auditRows: Record<string, any>[] = [];
  for (const r of records) {
    // dobles/triples y prima descanso persistidos por check-out (reforma LFT 2027)
    const doubleMin = r.overtimeDoubleMinutes ?? 0;
    const tripleMin = r.overtimeTripleMinutes ?? 0;
    const restPremiumMin = r.restDayPremiumMinutes ?? 0;

    rows.push({
      'Número de Empleado': r.employee.employeeNumber,
      Nombre: r.employee.user.name,
      Sucursal: r.sucursal.codigoLocal
        ? `${r.sucursal.codigoLocal} — ${r.sucursal.name}`
        : r.sucursal.name,
      Departamento: r.employee.department,
      Puesto: r.employee.position,
      Fecha: toISODate(r.date),
      'Hora de Entrada': r.checkInTime
        ? formatTimeInMexico(r.checkInTime)
        : '—',
      'Hora de Salida': r.checkOutTime
        ? formatTimeInMexico(r.checkOutTime)
        : '—',
      'Descanso Inicio': r.mealStart ? formatTimeInMexico(r.mealStart) : '—',
      'Descanso Fin': r.mealEnd ? formatTimeInMexico(r.mealEnd) : '—',
      'Descanso Duración (min)': r.mealDurationMinutes ?? '—',
      'Excedió Descanso': r.mealExceeded ? 'Sí' : 'No',
      'Horas Trabajadas': r.workedMinutes
        ? minutesToHours(r.workedMinutes)
        : 0,
      'Horas Extra': minutesToHours(r.overtimeMinutes ?? 0),
      // Reforma LFT 2027 — art. 66 (dobles) / art. 68 (triples)
      'Horas Extra Dobles': minutesToHours(doubleMin),
      'Horas Extra Triples': minutesToHours(tripleMin),
      // Prima por descanso trabajado (art. 73 LFT)
      'Día de Descanso Trabajado': r.isRestDayWorked ? 'Sí' : 'No',
      'Prima 100% (min)': restPremiumMin,
      // Jornada nocturna/mixta (art. 60 y 61 LFT) — tipo de jornada y minutos nocturnos
      'Jornada': r.shiftType || '—',
      'Min. nocturnos': r.nightMinutes ?? 0,
      Estado: STATUS_ES[r.status] || r.status,
      'Justificación': r.justificationStatus || '—',
    });

    auditRows.push({
      'Número de Empleado': r.employee.employeeNumber,
      Nombre: r.employee.user.name,
      Fecha: toISODate(r.date),
      'Método Entrada': r.checkInMethod || '—',
      'IP Entrada': r.checkInIp || '—',
      'Latitud Entrada': r.checkInLat ?? '—',
      'Longitud Entrada': r.checkInLong ?? '—',
      'Método Salida': r.checkOutMethod || '—',
      'IP Salida': r.checkOutIp || '—',
      'Latitud Salida': r.checkOutLat ?? '—',
      'Longitud Salida': r.checkOutLong ?? '—',
      // Jornada nocturna/mixta (art. 60 y 61 LFT) — tipo de jornada y minutos nocturnos
      'Jornada': r.shiftType || '—',
      'Min. nocturnos': r.nightMinutes ?? 0,
    });
  }

  // Resumen por sucursal
  const bySucursalMap = new Map<
    string,
    {
      sucursal: string;
      total: number;
      present: number;
      late: number;
      earlyLeave: number;
      overtimeMin: number;
      doubleMin: number;
      tripleMin: number;
      restDayWorkedCount: number;
      restPremiumMin: number;
    }
  >();
  for (const r of records) {
    const key = r.sucursalId;
    if (!bySucursalMap.has(key)) {
      bySucursalMap.set(key, {
        sucursal: r.sucursal.codigoLocal
          ? `${r.sucursal.codigoLocal} — ${r.sucursal.name}`
          : r.sucursal.name,
        total: 0,
        present: 0,
        late: 0,
        earlyLeave: 0,
        overtimeMin: 0,
        doubleMin: 0,
        tripleMin: 0,
        restDayWorkedCount: 0,
        restPremiumMin: 0,
      });
    }
    const s = bySucursalMap.get(key)!;
    s.total += 1;
    if (r.status === 'PRESENT') s.present += 1;
    if (r.status === 'LATE') s.late += 1;
    if (r.status === 'EARLY_LEAVE') s.earlyLeave += 1;
    s.overtimeMin += r.overtimeMinutes ?? 0;
    s.doubleMin += r.overtimeDoubleMinutes ?? 0;
    s.tripleMin += r.overtimeTripleMinutes ?? 0;
    if (r.isRestDayWorked) {
      s.restDayWorkedCount += 1;
      s.restPremiumMin += r.restDayPremiumMinutes ?? 0;
    }
  }

  const summaryRows: (string | number)[][] = [
    ['Total de Registros', records.length],
    ['Sucursales', bySucursalMap.size],
    [],
    ['POR SUCURSAL', ''],
  ];
  for (const s of bySucursalMap.values()) {
    summaryRows.push([`  ${s.sucursal}`, `Total: ${s.total}`]);
    summaryRows.push(['    Presentes', s.present]);
    summaryRows.push(['    Retardos', s.late]);
    summaryRows.push(['    Salidas Anticipadas', s.earlyLeave]);
    summaryRows.push(['    Horas Extra (h)', minutesToHours(s.overtimeMin)]);
    summaryRows.push(['    Horas Extra Dobles (h)', minutesToHours(s.doubleMin)]);
    summaryRows.push(['    Horas Extra Triples (h)', minutesToHours(s.tripleMin)]);
    summaryRows.push(['    Días de Descanso Trabajados', s.restDayWorkedCount]);
    summaryRows.push(['    Prima 100% (h)', minutesToHours(s.restPremiumMin)]);
  }

  return { rows, summaryRows, auditRows };
}

// -------- OVERTIME --------
async function buildOvertimeRows(
  start: Date,
  end: Date,
  sucursalId: string | null | undefined
) {
  const where: any = { date: { gte: start, lte: end } };
  if (sucursalId) where.sucursalId = sucursalId;

  const records = await db.attendanceRecord.findMany({
    where,
    include: {
      employee: {
        include: {
          user: { select: { name: true } },
          sucursal: { select: { id: true, name: true, codigoLocal: true } },
        },
      },
      sucursal: {
        select: {
          id: true,
          name: true,
          codigoLocal: true,
          checkoutToleranceMinutes: true,
        },
      },
    },
    orderBy: [{ date: 'asc' }, { employee: { employeeNumber: 'asc' } }],
  });

  // Reforma LFT 2027 — dobles/triples y prima descanso ya persistidos por
  // check-out. No se requiere cargar WorkSchedules (no se recalcula overtime).

  const rows: Record<string, any>[] = [];
  for (const r of records) {
    if (!r.checkInTime || !r.checkOutTime) continue;
    const doubleMin = r.overtimeDoubleMinutes ?? 0;
    const tripleMin = r.overtimeTripleMinutes ?? 0;
    const restPremiumMin = r.restDayPremiumMinutes ?? 0;
    const otMin = r.overtimeMinutes ?? 0;
    const workedMin = r.workedMinutes ?? 0;
    rows.push({
      'Número de Empleado': r.employee.employeeNumber,
      Nombre: r.employee.user.name,
      Sucursal: r.sucursal.codigoLocal
        ? `${r.sucursal.codigoLocal} — ${r.sucursal.name}`
        : r.sucursal.name,
      Departamento: r.employee.department,
      Puesto: r.employee.position,
      Fecha: toISODate(r.date),
      'Hora de Entrada': formatTimeInMexico(r.checkInTime),
      'Hora de Salida': formatTimeInMexico(r.checkOutTime),
      'Horas Trabajadas': minutesToHours(workedMin),
      'Horas Extra': minutesToHours(otMin),
      // Reforma LFT 2027 — art. 66 (dobles) / art. 68 (triples)
      'Horas Extra Dobles': minutesToHours(doubleMin),
      'Horas Extra Triples': minutesToHours(tripleMin),
      // Prima por descanso trabajado (art. 73 LFT)
      'Día de Descanso Trabajado': r.isRestDayWorked ? 'Sí' : 'No',
      'Prima 100% (min)': restPremiumMin,
      // Jornada nocturna/mixta (art. 60 y 61 LFT) — tipo de jornada y minutos nocturnos
      'Jornada': r.shiftType || '—',
      'Min. nocturnos': r.nightMinutes ?? 0,
    });
  }

  const totalOvertimeMin = rows.reduce(
    (s, r) => s + Math.round((r['Horas Extra'] as number) * 60),
    0
  );
  const totalDoubleMin = rows.reduce(
    (s, r) => s + Math.round((r['Horas Extra Dobles'] as number) * 60),
    0
  );
  const totalTripleMin = rows.reduce(
    (s, r) => s + Math.round((r['Horas Extra Triples'] as number) * 60),
    0
  );
  const totalRestDayWorkedCount = rows.filter(
    (r) => r['Día de Descanso Trabajado'] === 'Sí'
  ).length;
  const totalRestPremiumMin = rows.reduce(
    (s, r) => s + (r['Prima 100% (min)'] as number),
    0
  );

  const summaryRows: (string | number)[][] = [
    ['Total de Registros con Horas Extra', rows.length],
    ['Total Horas Extra', minutesToHours(totalOvertimeMin)],
    // Reforma LFT 2027 — dobles/triples
    ['Total Horas Extra Dobles', minutesToHours(totalDoubleMin)],
    ['Total Horas Extra Triples', minutesToHours(totalTripleMin)],
    // Prima por descanso trabajado (art. 73 LFT)
    ['Total Días de Descanso Trabajados', totalRestDayWorkedCount],
    ['Total Prima 100% (h)', minutesToHours(totalRestPremiumMin)],
  ];

  return { rows, summaryRows };
}

// -------- ABSENCES --------
async function buildAbsencesRows(
  start: Date,
  end: Date,
  effectiveEnd: Date,
  sucursalId: string | null | undefined
) {
  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= effectiveEnd) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const employees = await loadActiveEmployees(sucursalId || undefined);
  const employeeIds = employees.map((e) => e.id);

  const [schedulesByEmp, recordsByEmp, vacations, holidays] =
    await Promise.all([
      loadSchedules(employeeIds),
      loadRecords(start, end, sucursalId || undefined),
      loadApprovedVacations(start, end, sucursalId || undefined),
      loadHolidays(start, end),
    ]);

  const vacationsByEmp: Record<string, any[]> = {};
  for (const v of vacations as any[]) {
    if (!vacationsByEmp[v.employeeId]) vacationsByEmp[v.employeeId] = [];
    vacationsByEmp[v.employeeId].push(v);
  }

  const rows: Record<string, any>[] = [];
  for (const emp of employees) {
    const empSchedules = (schedulesByEmp[emp.id] || []).map((s) => ({
      dayOfWeek: s.dayOfWeek,
      isWeeklyRest: s.isWeeklyRest,
    }));
    const empRecords = recordsByEmp[emp.id] || [];
    const empVacations = vacationsByEmp[emp.id] || [];
    const sucName = emp.sucursal?.codigoLocal
      ? `${emp.sucursal.codigoLocal} — ${emp.sucursal.name}`
      : emp.sucursal?.name || '—';

    const absentDates: string[] = [];
    for (const day of days) {
      const result = isAbsentOnDate(day, {
        employee: { id: emp.id, isActive: emp.isActive },
        schedules: empSchedules,
        records: empRecords,
        vacations: empVacations as any,
        holidays,
      });
      if (result.absent) absentDates.push(toISODate(day));
    }
    if (absentDates.length > 0) {
      absentDates.sort();
      rows.push({
        'Número de Empleado': emp.employeeNumber,
        Nombre: emp.user.name,
        Sucursal: sucName,
        Departamento: emp.department,
        Puesto: emp.position,
        'Total Ausencias': absentDates.length,
        'Fechas de Ausencia': absentDates.join(', '),
      });
    }
  }

  const totalAbsents = rows.reduce(
    (s, r) => s + (r['Total Ausencias'] as number),
    0
  );
  const summaryRows: (string | number)[][] = [
    ['Empleados con Ausencias', rows.length],
    ['Total de Ausencias', totalAbsents],
  ];

  return { rows, summaryRows };
}

// -------- INCIDENCES --------
async function buildIncidencesRows(
  start: Date,
  end: Date,
  effectiveEnd: Date,
  sucursalId: string | null | undefined
) {
  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= effectiveEnd) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const employees = await loadActiveEmployees(sucursalId || undefined);
  const employeeIds = employees.map((e) => e.id);

  const [schedulesByEmp, recordsByEmp, vacations, holidays] =
    await Promise.all([
      loadSchedules(employeeIds),
      loadRecords(start, end, sucursalId || undefined),
      loadApprovedVacations(start, end, sucursalId || undefined),
      loadHolidays(start, end),
    ]);

  // Reforma LFT 2027 — dobles/triples y prima descanso persistidos por check-out.
  // No se necesita checkoutToleranceMinutes aquí (no se recalcula overtime).

  const vacationsByEmp: Record<string, any[]> = {};
  for (const v of vacations as any[]) {
    if (!vacationsByEmp[v.employeeId]) vacationsByEmp[v.employeeId] = [];
    vacationsByEmp[v.employeeId].push(v);
  }

  const rows: Record<string, any>[] = [];
  const totals = {
    diasLaborados: 0,
    faltas: 0,
    retardos: 0,
    salidasAnticipadas: 0,
    horasExtraMin: 0,
    horasExtraDobleMin: 0,
    horasExtraTripleMin: 0,
    horasTrabajadasMin: 0,
    diasVacaciones: 0,
    diasIncapacidad: 0,
    diasDescansoTrabajado: 0,
    primaDescansoMin: 0,
  };

  for (const emp of employees) {
    const empSchedules = schedulesByEmp[emp.id] || [];
    const empRecords = recordsByEmp[emp.id] || [];
    const empVacations = vacationsByEmp[emp.id] || [];
    const sucName = emp.sucursal?.codigoLocal
      ? `${emp.sucursal.codigoLocal} — ${emp.sucursal.name}`
      : emp.sucursal?.name || '—';

    const recordsByDate: Record<string, (typeof empRecords)[0]> = {};
    for (const r of empRecords) recordsByDate[toISODate(r.date)] = r;

    let diasLaborados = 0,
      faltas = 0,
      retardos = 0,
      salidasAnticipadas = 0,
      horasExtraMin = 0,
      horasExtraDobleMin = 0,
      horasExtraTripleMin = 0,
      horasTrabajadasMin = 0,
      diasVacaciones = 0,
      diasIncapacidad = 0,
      diasDescansoTrabajado = 0,
      primaDescansoMin = 0;

    for (const day of days) {
      const dayISO = toISODate(day);
      const vacation = empVacations.find(
        (v) =>
          v.status === 'APPROVED' &&
          toISODate(v.startDate) <= dayISO &&
          toISODate(v.endDate) >= dayISO
      );
      const absenceResult = isAbsentOnDate(day, {
        employee: { id: emp.id, isActive: emp.isActive },
        schedules: empSchedules.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          isWeeklyRest: s.isWeeklyRest,
        })),
        records: empRecords,
        vacations: empVacations as any,
        holidays,
      });
      const record = recordsByDate[dayISO];

      if (vacation) {
        if (vacation.type === 'INCAPACIDAD' || vacation.type === 'MATERNIDAD')
          diasIncapacidad += 1;
        else if (vacation.type === 'VACACIONES') diasVacaciones += 1;
        continue;
      }
      if (absenceResult.absent) {
        faltas += 1;
        continue;
      }
      if (!record) continue;
      // Reforma LFT 2027 — dobles/triples y prima descanso persistidos por check-out
      if (record.status === 'PRESENT' || record.status === 'LATE')
        diasLaborados += 1;
      if (record.status === 'LATE') retardos += 1;
      if (record.status === 'EARLY_LEAVE') salidasAnticipadas += 1;
      horasExtraMin += record.overtimeMinutes ?? 0;
      horasExtraDobleMin += record.overtimeDoubleMinutes ?? 0;
      horasExtraTripleMin += record.overtimeTripleMinutes ?? 0;
      horasTrabajadasMin += record.workedMinutes ?? 0;
      if (record.isRestDayWorked) {
        diasDescansoTrabajado += 1;
        primaDescansoMin += record.restDayPremiumMinutes ?? 0;
      }
    }

    totals.diasLaborados += diasLaborados;
    totals.faltas += faltas;
    totals.retardos += retardos;
    totals.salidasAnticipadas += salidasAnticipadas;
    totals.horasExtraMin += horasExtraMin;
    totals.horasExtraDobleMin += horasExtraDobleMin;
    totals.horasExtraTripleMin += horasExtraTripleMin;
    totals.horasTrabajadasMin += horasTrabajadasMin;
    totals.diasVacaciones += diasVacaciones;
    totals.diasIncapacidad += diasIncapacidad;
    totals.diasDescansoTrabajado += diasDescansoTrabajado;
    totals.primaDescansoMin += primaDescansoMin;

    rows.push({
      'Número de Empleado': emp.employeeNumber,
      Nombre: emp.user.name,
      Sucursal: sucName,
      Departamento: emp.department,
      Puesto: emp.position,
      'Días Laborados': diasLaborados,
      Faltas: faltas,
      Retardos: retardos,
      'Salidas Anticipadas': salidasAnticipadas,
      'Horas Extra (min)': horasExtraMin,
      'Horas Extra (h)': minutesToHours(horasExtraMin),
      // Reforma LFT 2027 — dobles/triples persistidos por check-out
      'Horas Extra Dobles (min)': horasExtraDobleMin,
      'Horas Extra Dobles (h)': minutesToHours(horasExtraDobleMin),
      'Horas Extra Triples (min)': horasExtraTripleMin,
      'Horas Extra Triples (h)': minutesToHours(horasExtraTripleMin),
      'Horas Trabajadas (min)': horasTrabajadasMin,
      'Horas Trabajadas (h)': minutesToHours(horasTrabajadasMin),
      'Días de Vacaciones': diasVacaciones,
      'Días de Incapacidad': diasIncapacidad,
      // Prima por descanso trabajado (art. 73 LFT)
      'Días de Descanso Trabajados': diasDescansoTrabajado,
      'Prima 100% (min)': primaDescansoMin,
      'Prima 100% (h)': minutesToHours(primaDescansoMin),
    });
  }

  const summaryRows: (string | number)[][] = [
    ['Empleados Evaluados', rows.length],
    ['Días Laborados (total)', totals.diasLaborados],
    ['Faltas (total)', totals.faltas],
    ['Retardos (total)', totals.retardos],
    ['Salidas Anticipadas (total)', totals.salidasAnticipadas],
    ['Horas Extra (total, h)', minutesToHours(totals.horasExtraMin)],
    // Reforma LFT 2027 — dobles/triples
    ['Horas Extra Dobles (total, h)', minutesToHours(totals.horasExtraDobleMin)],
    ['Horas Extra Triples (total, h)', minutesToHours(totals.horasExtraTripleMin)],
    ['Horas Trabajadas (total, h)', minutesToHours(totals.horasTrabajadasMin)],
    ['Días de Vacaciones (total)', totals.diasVacaciones],
    ['Días de Incapacidad (total)', totals.diasIncapacidad],
    // Prima por descanso trabajado (art. 73 LFT)
    ['Días de Descanso Trabajados (total)', totals.diasDescansoTrabajado],
    ['Prima 100% (total, h)', minutesToHours(totals.primaDescansoMin)],
  ];

  return { rows, summaryRows };
}

// -------- COMPARATIVE --------
async function buildComparativeRows(
  start: Date,
  end: Date,
  effectiveEnd: Date
) {
  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= effectiveEnd) {
    days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const sucursales = await db.sucursal.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      codigoLocal: true,
    },
  });

  const holidays = await loadHolidays(start, end);

  const rows: Record<string, any>[] = [];
  let totalPresent = 0,
    totalAbsent = 0,
    totalLate = 0,
    totalOvertimeMin = 0,
    totalDoubleMin = 0,
    totalTripleMin = 0,
    totalRestDayWorkedCount = 0,
    totalRestPremiumMin = 0;

  for (const suc of sucursales) {
    const employees = await loadActiveEmployees(suc.id);
    const employeeIds = employees.map((e) => e.id);

    const [schedulesByEmp, recordsByEmp, vacations] = await Promise.all([
      loadSchedules(employeeIds),
      loadRecords(start, end, suc.id),
      loadApprovedVacations(start, end, suc.id),
    ]);

    const vacationsByEmp: Record<string, any[]> = {};
    for (const v of vacations as any[]) {
      if (!vacationsByEmp[v.employeeId]) vacationsByEmp[v.employeeId] = [];
      vacationsByEmp[v.employeeId].push(v);
    }

    let presentDays = 0,
      absentDays = 0,
      lateDays = 0,
      overtimeMin = 0,
      doubleMin = 0,
      tripleMin = 0,
      restDayWorkedCount = 0,
      restPremiumMin = 0;

    for (const emp of employees) {
      const empSchedules = schedulesByEmp[emp.id] || [];
      const empRecords = recordsByEmp[emp.id] || [];
      const empVacations = vacationsByEmp[emp.id] || [];

      const recordsByDate: Record<string, (typeof empRecords)[0]> = {};
      for (const r of empRecords) recordsByDate[toISODate(r.date)] = r;

      for (const day of days) {
        const absenceResult = isAbsentOnDate(day, {
          employee: { id: emp.id, isActive: emp.isActive },
          schedules: empSchedules.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            isWeeklyRest: s.isWeeklyRest,
          })),
          records: empRecords,
          vacations: empVacations as any,
          holidays,
        });
        if (absenceResult.absent) {
          absentDays += 1;
          continue;
        }
        const record = recordsByDate[toISODate(day)];
        if (!record) continue;
        if (record.status === 'PRESENT') presentDays += 1;
        else if (record.status === 'LATE') {
          lateDays += 1;
          presentDays += 1;
        }
        // Reforma LFT 2027 — dobles/triples y prima descanso persistidos por check-out
        if (record.checkInTime && record.checkOutTime) {
          overtimeMin += record.overtimeMinutes ?? 0;
          doubleMin += record.overtimeDoubleMinutes ?? 0;
          tripleMin += record.overtimeTripleMinutes ?? 0;
          if (record.isRestDayWorked) {
            restDayWorkedCount += 1;
            restPremiumMin += record.restDayPremiumMinutes ?? 0;
          }
        }
      }
    }

    const evaluable = presentDays + absentDays;
    const attendanceRate =
      evaluable > 0 ? +((presentDays / evaluable) * 100).toFixed(2) : 0;

    totalPresent += presentDays;
    totalAbsent += absentDays;
    totalLate += lateDays;
    totalOvertimeMin += overtimeMin;
    totalDoubleMin += doubleMin;
    totalTripleMin += tripleMin;
    totalRestDayWorkedCount += restDayWorkedCount;
    totalRestPremiumMin += restPremiumMin;

    rows.push({
      Sucursal: suc.codigoLocal
        ? `${suc.codigoLocal} — ${suc.name}`
        : suc.name,
      'Empleados Activos': employees.length,
      'Días Presente': presentDays,
      'Días Ausente': absentDays,
      'Días con Retardo': lateDays,
      'Horas Extra': minutesToHours(overtimeMin),
      // Reforma LFT 2027 — dobles/triples
      'Horas Extra Dobles': minutesToHours(doubleMin),
      'Horas Extra Triples': minutesToHours(tripleMin),
      // Prima por descanso trabajado (art. 73 LFT)
      'Días de Descanso Trabajados': restDayWorkedCount,
      'Prima 100% (h)': minutesToHours(restPremiumMin),
      'Tasa de Asistencia (%)': attendanceRate,
    });
  }

  const totalEval = totalPresent + totalAbsent;
  const summaryRows: (string | number)[][] = [
    ['Sucursales', sucursales.length],
    ['Días Presente (total)', totalPresent],
    ['Días Ausente (total)', totalAbsent],
    ['Días con Retardo (total)', totalLate],
    ['Horas Extra (total)', minutesToHours(totalOvertimeMin)],
    // Reforma LFT 2027 — dobles/triples
    ['Horas Extra Dobles (total)', minutesToHours(totalDoubleMin)],
    ['Horas Extra Triples (total)', minutesToHours(totalTripleMin)],
    // Prima por descanso trabajado (art. 73 LFT)
    ['Días de Descanso Trabajados (total)', totalRestDayWorkedCount],
    ['Prima 100% (total, h)', minutesToHours(totalRestPremiumMin)],
    [
      'Tasa de Asistencia Global (%)',
      totalEval > 0 ? +((totalPresent / totalEval) * 100).toFixed(2) : 0,
    ],
  ];

  return { rows, summaryRows };
}
