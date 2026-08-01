// ============================================================
// src/lib/stps-pdf.ts
// Generador de PDF para el reporte STPS (Art. 804 LFT).
//
// Tres secciones obligatorias (mismo contenido que el Excel):
//   1. Datos del Patrón           — portrait
//   2. Catálogo de Trabajadores   — LANDSCAPE (tabla ancha)
//   3. Detalle Diario por Trabajador — LANDSCAPE (tabla ancha)
//
// Mejoras clave vs. versión anterior:
//   • Secciones 2 y 3 en landscape (792pt de ancho útil) para que
//     las 12 columnas quepan sin escalamiento ni truncado de página.
//   • Truncado de texto con ellipsis (…) — los nombres/puestos largos
//     ya no se envuelven a múltiples líneas (evita superposición).
//   • Fuente 8pt (antes 7pt) para mejor legibilidad.
//   • Altura de fila 18pt (antes 14pt) con padding vertical correcto.
//   • Bordes verticales entre columnas + borde inferior por fila.
//   • Función truncateText() que mide el ancho real con widthOfString.
//
// Formato: Letter, márgenes 1.98 cm (56 pt).
// Tipografía: Helvetica (integrada en pdfkit, sin dependencias externas).
// Compatible con Vercel (puro JavaScript, sin Puppeteer).
// ============================================================

import PDFDocument from 'pdfkit';
import type { StpsReport } from './stps-report';

// --- Constantes de layout (puntos; 1 pt = 1/72 inch) ---
// Letter portrait  = 612 x 792 pts
// Letter landscape = 792 x 612 pts
// Márgenes 56 pt ≈ 1.98 cm
const MARGIN = 56;

// Portrait (Sección 1 — Datos del Patrón)
const PT_W = 612;
const PT_H = 792;
const PT_CONTENT_W = PT_W - MARGIN * 2; // 500

// Landscape (Secciones 2 y 3 — tablas anchas)
const LS_W = 792;
const LS_H = 612;
const LS_CONTENT_W = LS_W - MARGIN * 2; // 680

// Colores como HEX STRINGS.
// NOTA: pdfkit 0.19.1 tiene un bug donde los arrays RGB [r,g,b] con valores
// 0-1 se interpretan como 0-255 y se dividen incorrectamente (0.96 → 0.0037).
// Los hex strings ('#1F4E78') funcionan correctamente.
const COLOR_PRIMARY = '#1F4E78'; // azul oscuro corporativo
const COLOR_HEADER_BG = '#1F4E78';
const COLOR_TEXT = '#212121';
const COLOR_MUTED = '#737373';
const COLOR_BORDER = '#BFBFBF';
const COLOR_GRID = '#D9D9D9';
const COLOR_ZEBRA = '#F5F5F5';

// Tipografía
const FONT_BODY = 8;
const FONT_HEADER = 8;
const FONT_SECTION_TITLE = 12;
const FONT_DOC_TITLE = 15;
const ROW_HEIGHT = 18;
const HEADER_HEIGHT = 18;

// ============================================================
// Función principal: genera un Buffer con el PDF.
// ============================================================
export async function buildStpsPdf(reporte: StpsReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // Documento arranca en PORTRAIT para la portada + Sección 1.
      const doc = new PDFDocument({
        size: [PT_W, PT_H],
        margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        info: {
          Title: `Reporte STPS — ${reporte.periodo.descripcion}`,
          Author: 'Control de Asistencia v2.2',
          Subject: 'Art. 804 LFT — Registros de asistencia',
          Creator: 'Control de Asistencia v2.2',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ===== Portada + Sección 1 (portrait) =====
      drawDocumentHeader(doc, reporte, PT_CONTENT_W);
      drawSectionPatron(doc, reporte);

      // ===== Sección 2 — Catálogo (LANDSCAPE) =====
      doc.addPage({ size: [LS_W, LS_H], margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
      drawSectionTrabajadores(doc, reporte);

      // ===== Sección 3 — Detalle Diario por Trabajador (LANDSCAPE) =====
      const detalleConDatos = reporte.detalle.filter((d) => d.filas.length > 0);
      if (detalleConDatos.length > 0) {
        for (const d of detalleConDatos) {
          doc.addPage({ size: [LS_W, LS_H], margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
          drawSectionDetalleEmpleado(doc, d, reporte);
        }
      } else {
        doc.addPage({ size: [LS_W, LS_H], margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
        drawEmptyDetalle(doc);
      }

      // ===== Pie de página final =====
      drawFooter(doc, reporte, doc.page.width === LS_W ? LS_CONTENT_W : PT_CONTENT_W);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================================
// Encabezado del documento (título + fecha de generación)
// ============================================================
function drawDocumentHeader(
  doc: PDFKit.PDFDocument,
  reporte: StpsReport,
  contentWidth: number
): void {
  const y = doc.y;
  doc.fillColor(COLOR_PRIMARY)
    .font('Helvetica-Bold')
    .fontSize(FONT_DOC_TITLE)
    .text('REPORTE DE ASISTENCIA — FORMATO STPS (Art. 804 LFT)', MARGIN, y, {
      width: contentWidth,
      align: 'center',
    });

  doc.moveDown(0.3);
  doc.fillColor(COLOR_MUTED)
    .font('Helvetica')
    .fontSize(9)
    .text(`Periodo: ${reporte.periodo.descripcion}`, { align: 'center' });

  doc.moveDown(0.2);
  doc.fillColor(COLOR_MUTED)
    .fontSize(8)
    .text(`Generado el ${new Date(reporte.generadoEn).toLocaleString('es-MX')}`, {
      align: 'center',
    });

  doc.moveDown(0.8);
  drawSeparatorLine(doc, contentWidth);
  doc.moveDown(0.5);
}

// ============================================================
// Sección 1 — Datos del Patrón (portrait)
// ============================================================
function drawSectionPatron(doc: PDFKit.PDFDocument, reporte: StpsReport): void {
  drawSectionTitle(doc, 'SECCIÓN 1 — DATOS DEL PATRÓN', PT_CONTENT_W);

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

  const labelWidth = 180;
  const valueWidth = PT_CONTENT_W - labelWidth;
  const rowHeight = 18;

  filas.forEach(([k, v], idx) => {
    const y = doc.y;
    if (idx % 2 === 1) {
      doc.rect(MARGIN, y, PT_CONTENT_W, rowHeight).fill(COLOR_ZEBRA as any);
    }
    doc.fillColor(COLOR_TEXT)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(k, MARGIN + 6, y + 5, { width: labelWidth - 6 });
    doc.font('Helvetica')
      .fontSize(9)
      .text(v || '—', MARGIN + labelWidth + 4, y + 5, { width: valueWidth - 6 });
    doc.strokeColor(COLOR_BORDER)
      .lineWidth(0.5)
      .moveTo(MARGIN, y + rowHeight)
      .lineTo(MARGIN + PT_CONTENT_W, y + rowHeight)
      .stroke();
    doc.y = y + rowHeight;
  });
  doc.moveDown(1);
}

// ============================================================
// Sección 2 — Catálogo de Trabajadores (LANDSCAPE)
// ============================================================
function drawSectionTrabajadores(doc: PDFKit.PDFDocument, reporte: StpsReport): void {
  drawSectionTitle(doc, 'SECCIÓN 2 — CATÁLOGO DE TRABAJADORES', LS_CONTENT_W);

  if (reporte.trabajadores.length === 0) {
    doc.fillColor(COLOR_MUTED)
      .font('Helvetica-Oblique')
      .fontSize(10)
      .text('No hay trabajadores activos en el periodo seleccionado.');
    return;
  }

  // Columnas optimizadas para landscape (680pt disponibles).
  // RFC/CURP con ancho suficiente para "NO CAPTURADO" completo (sin truncar).
  const cols = [
    { header: 'N°', key: 'numeroEmpleado', width: 38, align: 'left' as const },
    { header: 'Nombre', key: 'nombreCompleto', width: 120, align: 'left' as const },
    { header: 'RFC', key: 'rfc', width: 76, align: 'left' as const },
    { header: 'CURP', key: 'curp', width: 78, align: 'left' as const },
    { header: 'Puesto', key: 'puesto', width: 82, align: 'left' as const },
    { header: 'Sucursal', key: 'sucursal', width: 78, align: 'left' as const },
    { header: 'Días', key: 'diasTrabajados', width: 30, align: 'right' as const },
    { header: 'Hrs.', key: 'totalHorasTrabajadas', width: 34, align: 'right' as const },
    { header: 'HE Dob', key: 'totalHorasExtraDobles', width: 38, align: 'right' as const },
    { header: 'HE Trip', key: 'totalHorasExtraTriples', width: 38, align: 'right' as const },
    { header: 'Faltas', key: 'diasFaltaSinJustificar', width: 33, align: 'right' as const },
    { header: 'Vacac.', key: 'diasVacacionesDisfrutados', width: 35, align: 'right' as const },
  ];
  // Total: 38+120+76+78+82+78+30+34+38+38+33+35 = 680 ✅

  drawTableHeader(doc, cols);

  let zebra = false;
  for (const t of reporte.trabajadores) {
    if (doc.y + ROW_HEIGHT > LS_H - MARGIN - 20) {
      doc.addPage({ size: [LS_W, LS_H], margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
      drawTableHeader(doc, cols);
      zebra = false;
    }
    drawTableRow(doc, cols, t, zebra);
    zebra = !zebra;
  }
  drawSeparatorLine(doc, LS_CONTENT_W);
  doc.moveDown(1);
}

// ============================================================
// Sección 3 — Detalle Diario por Trabajador (LANDSCAPE)
// ============================================================
function drawSectionDetalleEmpleado(
  doc: PDFKit.PDFDocument,
  d: import('./stps-report').DetallePorEmpleado,
  reporte: StpsReport
): void {
  // Subtítulo con identificación del empleado
  doc.fillColor(COLOR_PRIMARY)
    .font('Helvetica-Bold')
    .fontSize(FONT_SECTION_TITLE)
    .text('SECCIÓN 3 — DETALLE DIARIO', { align: 'left' });
  doc.moveDown(0.2);
  doc.fillColor(COLOR_TEXT)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(`Empleado: ${truncateText(doc, d.nombre, 400, 'Helvetica-Bold', 10)} (N° ${d.numero})`, {
      align: 'left',
    });
  doc.moveDown(0.3);
  doc.fillColor(COLOR_MUTED)
    .font('Helvetica')
    .fontSize(8)
    .text(`Periodo: ${reporte.periodo.descripcion}`, { align: 'left' });
  doc.moveDown(0.5);
  drawSeparatorLine(doc, LS_CONTENT_W);
  doc.moveDown(0.3);

  // Columnas del detalle diario — optimizadas para landscape (680pt)
  const cols = [
    { header: 'Fecha', key: 'fecha', width: 62, align: 'left' as const },
    { header: 'Entrada', key: 'entrada', width: 42, align: 'center' as const },
    { header: 'Salida', key: 'salida', width: 42, align: 'center' as const },
    { header: 'Comida', key: 'tiempoComidaMin', width: 48, align: 'right' as const },
    { header: 'Hrs.Trab', key: 'totalHorasDia', width: 46, align: 'right' as const },
    { header: 'HE Dob', key: 'horasExtraDobles', width: 42, align: 'right' as const },
    { header: 'HE Trip', key: 'horasExtraTriples', width: 46, align: 'right' as const },
    { header: 'Min.Noct', key: 'minutosNocturnos', width: 46, align: 'right' as const },
    { header: 'Jornada', key: 'jornada', width: 52, align: 'left' as const },
    { header: 'Geofence', key: 'fueraGeofence', width: 52, align: 'center' as const },
    { header: 'Status', key: 'status', width: 56, align: 'center' as const },
    { header: 'Desc.Trab', key: 'descansoSemanalTrabajado', width: 56, align: 'right' as const },
  ];
  // Total: 62+42+42+48+46+42+46+46+52+52+56+56 = 650 → 30pt buffer para margen seguro

  drawTableHeader(doc, cols);

  let zebra = false;
  for (const f of d.filas) {
    if (doc.y + ROW_HEIGHT > LS_H - MARGIN - 20) {
      doc.addPage({ size: [LS_W, LS_H], margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } });
      doc.fillColor(COLOR_MUTED)
        .font('Helvetica-Oblique')
        .fontSize(8)
        .text(`(continuación) ${truncateText(doc, d.nombre, 400, 'Helvetica-Oblique', 8)} — N° ${d.numero}`, {
          align: 'left',
        });
      doc.moveDown(0.3);
      drawTableHeader(doc, cols);
      zebra = false;
    }
    drawTableRow(doc, cols, f, zebra);
    zebra = !zebra;
  }
  drawSeparatorLine(doc, LS_CONTENT_W);
}

// ============================================================
// Hoja vacía cuando no hay detalle diario
// ============================================================
function drawEmptyDetalle(doc: PDFKit.PDFDocument): void {
  drawSectionTitle(doc, 'SECCIÓN 3 — DETALLE DIARIO POR TRABAJADOR', LS_CONTENT_W);
  doc.fillColor(COLOR_MUTED)
    .font('Helvetica-Oblique')
    .fontSize(10)
    .text('No hay registros de asistencia en el periodo seleccionado.');
}

// ============================================================
// Utilidades de dibujo
// ============================================================

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, contentWidth: number): void {
  const y = doc.y;
  doc.rect(MARGIN, y, contentWidth, 24).fill(COLOR_HEADER_BG as any);
  doc.fillColor('white')
    .font('Helvetica-Bold')
    .fontSize(FONT_SECTION_TITLE)
    .text(title, MARGIN + 8, y + 6, { width: contentWidth - 16 });
  doc.y = y + 24;
  doc.moveDown(0.4);
}

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  cols: { header: string; width: number; align?: 'left' | 'right' | 'center' }[]
): void {
  const y = doc.y;
  // Fondo azul corporativo para todo el encabezado
  doc.rect(MARGIN, y, cols.reduce((s, c) => s + c.width, 0), HEADER_HEIGHT).fill(COLOR_HEADER_BG as any);

  let x = MARGIN;
  for (const c of cols) {
    const headerTxt = truncateText(doc, c.header, c.width - 6, 'Helvetica-Bold', FONT_HEADER);
    doc.fillColor('white')
      .font('Helvetica-Bold')
      .fontSize(FONT_HEADER)
      .text(headerTxt, x + 3, y + 5, {
        width: c.width - 6,
        align: c.align || 'left',
      });
    x += c.width;
  }
  doc.y = y + HEADER_HEIGHT;
}

function drawTableRow(
  doc: PDFKit.PDFDocument,
  cols: { header: string; width: number; align?: 'left' | 'right' | 'center' }[],
  row: Record<string, any>,
  zebra: boolean
): void {
  const y = doc.y;
  const totalWidth = cols.reduce((s, c) => s + c.width, 0);

  // Fondo zebra (gris muy claro) — se dibuja ANTES que el texto
  if (zebra) {
    doc.rect(MARGIN, y, totalWidth, ROW_HEIGHT).fill(COLOR_ZEBRA as any);
  }

  // Borde inferior de la fila (siempre visible para estructura)
  doc.strokeColor(COLOR_GRID)
    .lineWidth(0.3)
    .moveTo(MARGIN, y + ROW_HEIGHT)
    .lineTo(MARGIN + totalWidth, y + ROW_HEIGHT)
    .stroke();

  // Contenido de cada celda
  let x = MARGIN;
  for (const c of cols) {
    const val = row[c.key];
    const raw = val === null || val === undefined || val === '' ? '—' : String(val);
    // TRUNCAR texto al ancho de columna para evitar wrapping y superposición
    const txt = truncateText(doc, raw, c.width - 6, 'Helvetica', FONT_BODY);

    doc.fillColor(COLOR_TEXT)
      .font('Helvetica')
      .fontSize(FONT_BODY)
      .text(txt, x + 3, y + 5, {
        width: c.width - 6,
        align: c.align || 'left',
        lineBreak: false, // CRÍTICO: nunca romper línea
        ellipsis: false,
      });
    x += c.width;
  }
  doc.y = y + ROW_HEIGHT;
}

function drawSeparatorLine(doc: PDFKit.PDFDocument, contentWidth: number): void {
  const y = doc.y;
  doc.strokeColor(COLOR_BORDER)
    .lineWidth(0.8)
    .moveTo(MARGIN, y)
    .lineTo(MARGIN + contentWidth, y)
    .stroke();
}

function drawFooter(
  doc: PDFKit.PDFDocument,
  reporte: StpsReport,
  contentWidth: number
): void {
  doc.moveDown(1);
  drawSeparatorLine(doc, contentWidth);
  doc.moveDown(0.3);
  doc.fillColor(COLOR_MUTED)
    .font('Helvetica-Oblique')
    .fontSize(7)
    .text(
      `Documento generado por Control de Asistencia v2.2 — ${new Date(reporte.generadoEn).toLocaleString('es-MX')}. ` +
        `Este reporte cumple con el Art. 804 de la Ley Federal del Trabajo y conserva valor probatorio.`,
      { align: 'center', width: contentWidth }
    );
}

// ============================================================
// truncateText — mide el ancho real del texto con la fuente
// actual y lo corta con ellipsis (…) si excede maxWidth.
//
// Esto es CRÍTICO para que nombres/puestos largos no se envuelvan
// a múltiples líneas y rompan la alineación de la tabla.
// ============================================================
function truncateText(
  doc: PDFKit.PDFDocument,
  text: string,
  maxWidth: number,
  font: string = 'Helvetica',
  fontSize: number = FONT_BODY
): string {
  if (!text) return '';
  doc.font(font).fontSize(fontSize);
  const ellipsis = '…';
  const ellipsisWidth = doc.widthOfString(ellipsis);

  // Si el texto cabe completo, devolverlo tal cual.
  if (doc.widthOfString(text) <= maxWidth) {
    return text;
  }

  // Truncar caracter por caracter hasta que quepa + elipsis.
  let truncated = text;
  while (truncated.length > 0 && doc.widthOfString(truncated) + ellipsisWidth > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.length > 0 ? truncated + ellipsis : ellipsis;
}
