// ============================================================
// src/lib/stps-pdf.ts
// Generador de PDF para el reporte STPS (Art. 804 LFT).
//
// Tres secciones obligatorias (mismo contenido que el Excel):
//   1. Datos del Patrón
//   2. Catálogo de Trabajadores (resumen del periodo)
//   3. Detalle Diario por Trabajador
//
// Formato: Letter (carta), márgenes estándar 2.5 cm.
// Tipografía: Helvetica (integrada en pdfkit, sin dependencias externas).
//
// NO depende de Puppeteer ni de un navegador; funciona en Vercel
// (Node.js serverless) porque pdfkit es puro JavaScript.
// ============================================================

import PDFDocument from 'pdfkit';
import type { StpsReport } from './stps-report';

// --- Constantes de layout (puntos; 1 pt = 1/72 inch) ---
// Letter = 612 x 792 pts. Márgenes 2.5 cm ≈ 71 pt.
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 56; // ~1.98 cm — estándar para documentos formales
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Colores (valores RGB 0-1 para pdfkit)
const COLOR_PRIMARY: [number, number, number] = [0.122, 0.306, 0.471]; // #1F4E78 (azul oscuro corporativo)
const COLOR_HEADER_BG: [number, number, number] = [0.122, 0.306, 0.471];
const COLOR_TEXT: [number, number, number] = [0.13, 0.13, 0.13];
const COLOR_MUTED: [number, number, number] = [0.45, 0.45, 0.45];
const COLOR_BORDER: [number, number, number] = [0.75, 0.75, 0.75];
const COLOR_ZEBRA: [number, number, number] = [0.96, 0.96, 0.96];

// ============================================================
// Función principal: genera un Buffer con el PDF.
// ============================================================
export async function buildStpsPdf(reporte: StpsReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      // pdfkit accepts custom page size [width, height]
      const doc = new PDFDocument({
        size: [PAGE_WIDTH, PAGE_HEIGHT],
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

      // ===== Encabezado del documento =====
      drawDocumentHeader(doc, reporte);

      // ===== Sección 1: Datos del Patrón =====
      drawSectionPatron(doc, reporte);

      // ===== Sección 2: Catálogo de Trabajadores =====
      doc.addPage();
      drawSectionTrabajadores(doc, reporte);

      // ===== Sección 3: Detalle Diario por Trabajador =====
      // Una sub-sección por empleado, con salto de página entre ellos.
      const detalleConDatos = reporte.detalle.filter((d) => d.filas.length > 0);
      if (detalleConDatos.length > 0) {
        for (const d of detalleConDatos) {
          doc.addPage();
          drawSectionDetalleEmpleado(doc, d, reporte);
        }
      } else {
        // Si nadie tiene registros, agregar una hoja con nota.
        doc.addPage();
        drawEmptyDetalle(doc);
      }

      // ===== Pie de página final =====
      drawFooter(doc, reporte);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================================
// Encabezado del documento (título + fecha de generación)
// ============================================================
function drawDocumentHeader(doc: PDFKit.PDFDocument, reporte: StpsReport): void {
  const y = doc.y;
  // Título principal
  doc.fillColor(COLOR_PRIMARY)
    .font('Helvetica-Bold')
    .fontSize(15)
    .text('REPORTE DE ASISTENCIA — FORMATO STPS (Art. 804 LFT)', MARGIN, y, {
      width: CONTENT_WIDTH,
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
  // Línea separadora
  drawSeparatorLine(doc);
  doc.moveDown(0.5);
}

// ============================================================
// Sección 1 — Datos del Patrón
// ============================================================
function drawSectionPatron(doc: PDFKit.PDFDocument, reporte: StpsReport): void {
  drawSectionTitle(doc, 'SECCIÓN 1 — DATOS DEL PATRÓN');

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
  const valueWidth = CONTENT_WIDTH - labelWidth;
  const rowHeight = 18;

  for (const [k, v] of filas) {
    const y = doc.y;
    // Fondo alterno para legibilidad
    const idx = filas.indexOf([k, v]);
    if (idx % 2 === 1) {
      doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight).fill(COLOR_ZEBRA);
    }
    // Etiqueta
    doc.fillColor(COLOR_TEXT)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(k, MARGIN + 6, y + 4, { width: labelWidth - 6 });
    // Valor
    doc.font('Helvetica')
      .fontSize(9)
      .text(v, MARGIN + labelWidth + 4, y + 4, { width: valueWidth - 6 });
    // Borde inferior
    doc.strokeColor(COLOR_BORDER)
      .lineWidth(0.5)
      .moveTo(MARGIN, y + rowHeight)
      .lineTo(MARGIN + CONTENT_WIDTH, y + rowHeight)
      .stroke();
    doc.y = y + rowHeight;
  }
  doc.moveDown(1);
}

// ============================================================
// Sección 2 — Catálogo de Trabajadores
// ============================================================
function drawSectionTrabajadores(doc: PDFKit.PDFDocument, reporte: StpsReport): void {
  drawSectionTitle(doc, 'SECCIÓN 2 — CATÁLOGO DE TRABAJADORES');

  if (reporte.trabajadores.length === 0) {
    doc.fillColor(COLOR_MUTED)
      .font('Helvetica-Oblique')
      .fontSize(10)
      .text('No hay trabajadores activos en el periodo seleccionado.');
    return;
  }

  // Columnas (encabezado). Anchos en puntos, suman CONTENT_WIDTH.
  // Para que quepan en Letter, reducimos algunas columnas y usamos
  // orientación portrait con tabla compacta.
  const cols = [
    { header: 'N°', key: 'numeroEmpleado', width: 36 },
    { header: 'Nombre', key: 'nombreCompleto', width: 110 },
    { header: 'RFC', key: 'rfc', width: 60 },
    { header: 'CURP', key: 'curp', width: 70 },
    { header: 'Puesto', key: 'puesto', width: 55 },
    { header: 'Sucursal', key: 'sucursal', width: 55 },
    { header: 'Días Trab.', key: 'diasTrabajados', width: 36, align: 'right' },
    { header: 'Hrs. Trab.', key: 'totalHorasTrabajadas', width: 36, align: 'right' },
    { header: 'HE Doble', key: 'totalHorasExtraDobles', width: 34, align: 'right' },
    { header: 'HE Triple', key: 'totalHorasExtraTriples', width: 34, align: 'right' },
    { header: 'Faltas', key: 'diasFaltaSinJustificar', width: 30, align: 'right' },
    { header: 'Vacac.', key: 'diasVacacionesDisfrutados', width: 30, align: 'right' },
  ];
  // Verificar que los anchos no excedan CONTENT_WIDTH
  const totalColsWidth = cols.reduce((s, c) => s + c.width, 0);
  if (totalColsWidth > CONTENT_WIDTH) {
    // Escalar proporcionalmente si excede (caso extremo)
    const scale = CONTENT_WIDTH / totalColsWidth;
    cols.forEach((c) => (c.width = Math.floor(c.width * scale)));
  }

  drawTableHeader(doc, cols);

  // Filas de datos
  doc.font('Helvetica').fontSize(7);
  const rowHeight = 14;
  let zebra = false;
  for (const t of reporte.trabajadores) {
    if (doc.y + rowHeight > PAGE_HEIGHT - MARGIN - 30) {
      doc.addPage();
      drawTableHeader(doc, cols);
      doc.font('Helvetica').fontSize(7);
      zebra = false;
    }
    const y = doc.y;
    if (zebra) {
      doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight).fill(COLOR_ZEBRA);
    }
    zebra = !zebra;
    let x = MARGIN;
    for (const c of cols) {
      const val = (t as any)[c.key];
      const txt = val === null || val === undefined || val === '' ? '—' : String(val);
      doc.fillColor(COLOR_TEXT)
        .font('Helvetica')
        .fontSize(7)
        .text(txt, x + 2, y + 3, {
          width: c.width - 4,
          align: (c.align as 'left' | 'right' | 'center') || 'left',
        });
      x += c.width;
    }
    doc.y = y + rowHeight;
  }
  // Borde inferior de la tabla
  drawSeparatorLine(doc);
  doc.moveDown(1);
}

// ============================================================
// Sección 3 — Detalle Diario por Trabajador
// ============================================================
function drawSectionDetalleEmpleado(
  doc: PDFKit.PDFDocument,
  d: import('./stps-report').DetallePorEmpleado,
  reporte: StpsReport
): void {
  // Subtítulo con identificación del empleado
  doc.fillColor(COLOR_PRIMARY)
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(`SECCIÓN 3 — DETALLE DIARIO`, { align: 'left' });
  doc.moveDown(0.2);
  doc.fillColor(COLOR_TEXT)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(`Empleado: ${d.nombre} (N° ${d.numero})`, { align: 'left' });
  doc.moveDown(0.3);
  doc.fillColor(COLOR_MUTED)
    .font('Helvetica')
    .fontSize(8)
    .text(`Periodo: ${reporte.periodo.descripcion}`, { align: 'left' });
  doc.moveDown(0.5);
  drawSeparatorLine(doc);
  doc.moveDown(0.3);

  // Columnas del detalle diario
  const cols = [
    { header: 'Fecha', key: 'fecha', width: 60 },
    { header: 'Entrada', key: 'entrada', width: 40 },
    { header: 'Salida', key: 'salida', width: 40 },
    { header: 'Comida (min)', key: 'tiempoComidaMin', width: 50, align: 'right' },
    { header: 'Hrs. Trab.', key: 'totalHorasDia', width: 45, align: 'right' },
    { header: 'HE Doble', key: 'horasExtraDobles', width: 45, align: 'right' },
    { header: 'HE Triple', key: 'horasExtraTriples', width: 45, align: 'right' },
    { header: 'Min. Noct.', key: 'minutosNocturnos', width: 45, align: 'right' },
    { header: 'Jornada', key: 'jornada', width: 50 },
    { header: 'Geofence', key: 'fueraGeofence', width: 60 },
    { header: 'Status', key: 'status', width: 55 },
    { header: 'Desc. Trab.', key: 'descansoSemanalTrabajado', width: 45, align: 'right' },
  ];

  drawTableHeader(doc, cols);

  doc.font('Helvetica').fontSize(7);
  const rowHeight = 14;
  let zebra = false;
  for (const f of d.filas) {
    if (doc.y + rowHeight > PAGE_HEIGHT - MARGIN - 30) {
      doc.addPage();
      // Repetir encabezado de tabla en la nueva página
      doc.fillColor(COLOR_MUTED)
        .font('Helvetica-Oblique')
        .fontSize(8)
        .text(`(continuación) ${d.nombre} — N° ${d.numero}`, { align: 'left' });
      doc.moveDown(0.3);
      drawTableHeader(doc, cols);
      doc.font('Helvetica').fontSize(7);
      zebra = false;
    }
    const y = doc.y;
    if (zebra) {
      doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight).fill(COLOR_ZEBRA);
    }
    zebra = !zebra;
    let x = MARGIN;
    for (const c of cols) {
      const val = (f as any)[c.key];
      const txt = val === null || val === undefined || val === '' ? '—' : String(val);
      doc.fillColor(COLOR_TEXT)
        .font('Helvetica')
        .fontSize(7)
        .text(txt, x + 2, y + 3, {
          width: c.width - 4,
          align: (c.align as 'left' | 'right' | 'center') || 'left',
        });
      x += c.width;
    }
    doc.y = y + rowHeight;
  }
  drawSeparatorLine(doc);
}

// ============================================================
// Hoja vacía cuando no hay detalle diario
// ============================================================
function drawEmptyDetalle(doc: PDFKit.PDFDocument): void {
  drawSectionTitle(doc, 'SECCIÓN 3 — DETALLE DIARIO POR TRABAJADOR');
  doc.fillColor(COLOR_MUTED)
    .font('Helvetica-Oblique')
    .fontSize(10)
    .text('No hay registros de asistencia en el periodo seleccionado.');
}

// ============================================================
// Utilidades de dibujo
// ============================================================

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
  const y = doc.y;
  // Fondo azul corporativo
  doc.rect(MARGIN, y, CONTENT_WIDTH, 22).fill(COLOR_HEADER_BG);
  doc.fillColor('white')
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(title, MARGIN + 8, y + 6, { width: CONTENT_WIDTH - 16 });
  doc.y = y + 22;
  doc.moveDown(0.4);
}

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  cols: { header: string; width: number; align?: string }[]
): void {
  const y = doc.y;
  doc.rect(MARGIN, y, CONTENT_WIDTH, 16).fill(COLOR_HEADER_BG);
  let x = MARGIN;
  for (const c of cols) {
    doc.fillColor('white')
      .font('Helvetica-Bold')
      .fontSize(7)
      .text(c.header, x + 2, y + 4, {
        width: c.width - 4,
        align: (c.align as 'left' | 'right' | 'center') || 'left',
      });
    x += c.width;
  }
  doc.y = y + 16;
}

function drawSeparatorLine(doc: PDFKit.PDFDocument): void {
  const y = doc.y;
  doc.strokeColor(COLOR_BORDER)
    .lineWidth(0.5)
    .moveTo(MARGIN, y)
    .lineTo(MARGIN + CONTENT_WIDTH, y)
    .stroke();
}

function drawFooter(doc: PDFKit.PDFDocument, reporte: StpsReport): void {
  // Pie en la última página
  doc.moveDown(1);
  drawSeparatorLine(doc);
  doc.moveDown(0.3);
  doc.fillColor(COLOR_MUTED)
    .font('Helvetica-Oblique')
    .fontSize(7)
    .text(
      `Documento generado por Control de Asistencia v2.2 — ${new Date(reporte.generadoEn).toLocaleString('es-MX')}. ` +
        `Este reporte cumple con el Art. 804 de la Ley Federal del Trabajo y conserva valor probatorio.`,
      { align: 'center', width: CONTENT_WIDTH }
    );
}
