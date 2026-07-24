// ============================================================
// /api/reports/stps-format — GET
//   Reporte de asistencia en formato STPS (Art. 804 LFT).
//   Devuelve un Excel multi-hoja listo para exhibir ante una
//   inspección laboral de la STPS o en un juicio laboral.
//
//   Query params:
//     sucursalId  (opcional) — Si se omite, incluye todas las
//                  sucursales. SUCURSAL_ADMIN siempre fuerza su
//                  propia sucursal.
//     periodo     (opcional) — "semanal" | "mensual" (default "mensual")
//     mes         (1-12)     — Requerido si periodo=mensual
//     anio        (requerido) — Ej. 2026
//     semana      (1-53)     — Requerido si periodo=semanal (semana ISO)
//     format      (opcional) — "xlsx" (default) | "json"
//
//   Respuesta:
//     - format=xlsx → archivo .xlsx multi-hoja (3 secciones)
//     - format=json → JSON estructurado con todas las secciones
//
//   NO modifica esquemas ni endpoints existentes. Solo AGREGA
//   este endpoint (Cambio A del requerimiento STPS).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import {
  buildStpsReport,
  computePeriodo,
  NO_CAPTURADO,
  type TipoPeriodo,
  type StpsReport,
  type FilaTrabajador,
  type FilaDetalleDiario,
} from '@/lib/stps-report';

// Etiqueta para campos sin datos capturados.
const NA = NO_CAPTURADO;

export async function GET(req: NextRequest) {
  try {
    // --- Autenticación y autorización ---
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { searchParams } = new URL(req.url);
    const requestedSucursalId = searchParams.get('sucursalId');
    const periodoParam = (searchParams.get('periodo') || 'mensual').toLowerCase() as TipoPeriodo;
    const mesParam = searchParams.get('mes');
    const anioParam = searchParams.get('anio');
    const semanaParam = searchParams.get('semana');
    const format = (searchParams.get('format') || 'xlsx').toLowerCase();

    // SUCURSAL_ADMIN siempre ve solo su sucursal.
    const sucursalId =
      user.role === 'SUCURSAL_ADMIN' ? user.sucursalId : requestedSucursalId;

    // --- Validación de parámetros ---
    if (!['mensual', 'semanal'].includes(periodoParam)) {
      return NextResponse.json(
        { error: 'periodo inválido (valores: mensual | semanal)' },
        { status: 400 }
      );
    }
    if (!anioParam) {
      return NextResponse.json(
        { error: 'anio es requerido (ej. 2026)' },
        { status: 400 }
      );
    }
    const anio = parseInt(anioParam, 10);
    if (isNaN(anio) || anio < 2000 || anio > 2100) {
      return NextResponse.json(
        { error: 'anio inválido (debe ser un año entre 2000 y 2100)' },
        { status: 400 }
      );
    }

    let mes: number | undefined;
    let semana: number | undefined;
    if (periodoParam === 'mensual') {
      if (!mesParam) {
        return NextResponse.json(
          { error: 'mes es requerido (1-12) cuando periodo=mensual' },
          { status: 400 }
        );
      }
      mes = parseInt(mesParam, 10);
      if (isNaN(mes) || mes < 1 || mes > 12) {
        return NextResponse.json(
          { error: 'mes inválido (1-12)' },
          { status: 400 }
        );
      }
    } else {
      if (!semanaParam) {
        return NextResponse.json(
          { error: 'semana es requerida (1-53) cuando periodo=semanal' },
          { status: 400 }
        );
      }
      semana = parseInt(semanaParam, 10);
      if (isNaN(semana) || semana < 1 || semana > 53) {
        return NextResponse.json(
          { error: 'semana inválida (1-53 ISO)' },
          { status: 400 }
        );
      }
    }

    if (!['xlsx', 'json'].includes(format)) {
      return NextResponse.json(
        { error: 'format inválido (xlsx o json)' },
        { status: 400 }
      );
    }

    // --- Cálculo del periodo ---
    let periodo;
    try {
      periodo = computePeriodo(periodoParam, anio, mes, semana);
    } catch (e: any) {
      return NextResponse.json(
        { error: e.message || 'Periodo inválido' },
        { status: 400 }
      );
    }

    // --- Construcción del reporte ---
    const reporte = await buildStpsReport(periodo, sucursalId || null);

    // --- Auditoría (Art. 132 LFT — trazabilidad) ---
    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'EXPORT_STPS_REPORT',
      entityType: 'REPORT',
      entityId: null,
      sucursalId: sucursalId || null,
      ipAddress: ip,
      userAgent: ua,
      details: {
        tipo: 'STPS_ART_804',
        periodo: periodo.descripcion,
        sucursalId,
        trabajadores: reporte.trabajadores.length,
        format,
      },
    });

    // --- Respuesta JSON (para depuración / integraciones) ---
    if (format === 'json') {
      return NextResponse.json(reporte);
    }

    // --- Respuesta XLSX multi-hoja ---
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Control de Asistencia v2.2';
    wb.created = new Date();
    wb.properties = {
      title: `Reporte STPS — ${periodo.descripcion}`,
      subject: 'Art. 804 LFT — Registros de asistencia',
      creator: 'Control de Asistencia v2.2',
    };

    // ===== Hoja 1: Datos del Patrón =====
    buildHojaPatron(wb, reporte);

    // ===== Hoja 2: Catálogo de Trabajadores =====
    buildHojaTrabajadores(wb, reporte);

    // ===== Hojas 3..N: Detalle diario por trabajador =====
    buildHojasDetalle(wb, reporte);

    const buffer = await wb.xlsx.writeBuffer();
    const filename = `Reporte_STPS_${periodo.tipo}_${anio}${
      periodoParam === 'mensual' && mes ? `_${String(mes).padStart(2, '0')}` : ''
    }${periodoParam === 'semanal' && semana ? `_S${String(semana).padStart(2, '0')}` : ''}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (error) {
    console.error('GET /api/reports/stps-format error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ============================================================
// Hoja 1 — Datos del patrón (Sección 1)
// ============================================================
function buildHojaPatron(wb: ExcelJS.Workbook, reporte: StpsReport): void {
  const ws = wb.addWorksheet('1. Datos del Patrón');
  ws.columns = [{ width: 32 }, { width: 64 }];

  // Título
  ws.addRow(['REPORTE DE ASISTENCIA — FORMATO STPS (Art. 804 LFT)']);
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.mergeCells('A1:B1');

  ws.addRow([]);
  ws.addRow(['Generado el', new Date(reporte.generadoEn).toLocaleString('es-MX')]);
  ws.addRow([]);

  // Encabezado de sección
  const secRow = ws.addRow(['SECCIÓN 1 — DATOS DEL PATRÓN']);
  secRow.font = { bold: true, size: 12 };
  ws.mergeCells(`A${secRow.number}:B${secRow.number}`);

  const p = reporte.patron;
  const filas: [string, string][] = [
    ['Razón Social', p.razonSocial],
    ['RFC', p.rfc],
    ['Registro Patronal (IMSS)', p.registroPatronal],
    ['Domicilio Fiscal', p.domicilioFiscal],
    ['Representante Legal', p.representanteLegal],
    ['Teléfono', p.telefono],
    ['Email', p.email],
    ['Periodo del Reporte', p.periodo],
  ];
  for (const [k, v] of filas) {
    ws.addRow([k, v]);
  }

  // Estilo: etiquetas en negritas, bordes
  for (let i = 1; i <= ws.rowCount; i++) {
    const cellA = ws.getCell(`A${i}`);
    const cellB = ws.getCell(`B${i}`);
    if (i === 1 || i === ws.rowCount - filas.length - 1) continue; // títulos
    if (cellA.value && i > 2) cellA.font = { bold: true };
    for (const c of [cellA, cellB]) {
      c.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
      c.alignment = { vertical: 'top', wrapText: true };
    }
  }
}

// ============================================================
// Hoja 2 — Catálogo de Trabajadores (Sección 2)
// Incluye el resumen de inasistencias y retardos (Cambio C).
// ============================================================
function buildHojaTrabajadores(wb: ExcelJS.Workbook, reporte: StpsReport): void {
  const ws = wb.addWorksheet('2. Trabajadores');

  const headers = [
    'N° Empleado',
    'Nombre Completo',
    'RFC',
    'CURP',
    'Puesto',
    'Departamento',
    'Sucursal',
    'Salario Base',
    'Días Trabajados',
    'Total Horas Trabajadas',
    'Horas Extra Dobles',
    'Horas Extra Triples',
    'Min. Nocturnos (prima 25%)',
    'Días Descanso Trabajados',
    'Días Vacaciones Disfrutados',
    'Días Falta Sin Justificar',
    'Días Llegó Tarde',
    'Días Salió Temprano',
    'Total Retardos (min)',
    'Días Permiso',
  ];

  ws.columns = headers.map((h) => ({
    header: h,
    key: h,
    width: Math.max(14, Math.min(28, h.length + 2)),
  }));

  for (const t of reporte.trabajadores) {
    ws.addRow([
      t.numeroEmpleado,
      t.nombreCompleto,
      t.rfc,
      t.curp,
      t.puesto,
      t.departamento,
      t.sucursal,
      t.salarioBase,
      t.diasTrabajados,
      t.totalHorasTrabajadas,
      t.totalHorasExtraDobles,
      t.totalHorasExtraTriples,
      t.totalMinutosNocturnos,
      t.diasDescansoTrabajados,
      t.diasVacacionesDisfrutados,
      t.diasFaltaSinJustificar,
      t.diasLlegoTarde,
      t.diasSalioTemprano,
      t.totalRetardosMinutos,
      t.diasPermiso,
    ]);
  }

  estiloTabla(ws, headers.length, 'FF1F4E78');

  // Si no hay trabajadores, agregar nota.
  if (reporte.trabajadores.length === 0) {
    ws.addRow([]);
    ws.addRow(['No hay trabajadores activos en el periodo seleccionado.']);
  }

  // Congelar primera fila
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

// ============================================================
// Hojas 3..N — Detalle diario por trabajador (Sección 3)
// ============================================================
function buildHojasDetalle(wb: ExcelJS.Workbook, reporte: StpsReport): void {
  const headers = [
    'Fecha',
    'Entrada',
    'Salida',
    'Comida (min)',
    'Horas Trabajadas',
    'Horas Extra Dobles',
    'Horas Extra Triples',
    'Min. Nocturnos',
    'Jornada',
    'Fuera de Geofence',
    'Status',
    'Descanso Semanal Trabajado',
  ];

  const detalleConDatos = reporte.detalle.filter((d) => d.filas.length > 0);

  // Si ningún empleado tiene registros, crear una hoja vacía con nota.
  if (detalleConDatos.length === 0) {
    const ws = wb.addWorksheet('3. Detalle Diario');
    ws.addRow(['SECCIÓN 3 — DETALLE DIARIO POR TRABAJADOR']);
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.addRow([]);
    ws.addRow(['No hay registros de asistencia en el periodo seleccionado.']);
    return;
  }

  for (const d of detalleConDatos) {
    // Nombre de hoja: máximo 31 chars, sin caracteres inválidos : \ / ? * [ ]
    const nombreBase = `${d.numero} ${d.nombre}`
      .replace(/[:\\/?*\[\]]/g, '')
      .trim()
      .slice(0, 31);
    const ws = wb.addWorksheet(nombreBase || `Empleado ${d.numero}`);

    // Subtítulo con identificación del empleado
    ws.addRow([`Empleado: ${d.nombre} (N° ${d.numero})`]);
    ws.getCell('A1').font = { bold: true, size: 12 };
    ws.mergeCells('A1:L1');

    ws.addRow([]);
    // Fila de encabezados (fila 3)
    ws.addRow(headers);

    for (const f of d.filas) {
      ws.addRow([
        f.fecha,
        f.entrada,
        f.salida,
        f.tiempoComidaMin,
        f.totalHorasDia,
        f.horasExtraDobles,
        f.horasExtraTriples,
        f.minutosNocturnos,
        f.jornada,
        f.fueraGeofence,
        f.status,
        f.descansoSemanalTrabajado,
      ]);
    }

    // Estilo: encabezados en fila 3 (negritas, fondo azul, bordes)
    estiloTabla(ws, headers.length, 'FF1F4E78', 3);
    ws.views = [{ state: 'frozen', ySplit: 3 }];
  }
}

// ============================================================
// Estilo de tabla reutilizable: encabezados blancos sobre fondo
// color, bordes en todas las celdas con datos.
// ============================================================
function estiloTabla(
  ws: ExcelJS.Worksheet,
  numCols: number,
  headerColor: string,
  headerRowNum: number = 1
): void {
  const headerRow = ws.getRow(headerRowNum);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: headerColor },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'left' };

  for (let r = headerRowNum; r <= ws.rowCount; r++) {
    for (let c = 1; c <= numCols; c++) {
      const cell = ws.getRow(r).getCell(c);
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    }
  }
}
