// ============================================================
// /api/reports/imss-format — GET
//   Reporte de Incapacidades para IMSS (Ley del Seguro Social
//   art. 15 — obligación del patrón de registrar movimientos
//   afiliatorios y conservar comprobantes de seguridad social
//   por 5 años).
//
//   Devuelve un CSV (default) o JSON con las incapacidades
//   (enfermedad general, riesgo de trabajo) y maternidades
//   aprobadas que se solapan con el periodo solicitado, para
//   que el patrón pueda reconciliar con SUA / IDSE.
//
//   Query params:
//     startDate  (requerido, YYYY-MM-DD)
//     endDate    (requerido, YYYY-MM-DD)
//     sucursalId (opcional — SUCURSAL_ADMIN y SUPERVISOR
//                 siempre son forzados a su propia sucursal;
//                 GENERAL_ADMIN puede ver todas si se omite)
//     format     (opcional, default "csv" — "csv" | "json")
//
//   Respuesta:
//     - format=csv (default) → text/csv con línea de comentario
//       inicial + encabezado + filas (una por incapacidad).
//     - format=json           → JSON estructurado { period,
//       generatedAt, totalRecords, records[] }.
//
//   NO modifica esquemas ni endpoints existentes. Solo AGREGA
//   este endpoint (cubre el GAP 10 de ANALYSIS-1).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { parseDateRange } from '@/lib/reports';
import { toISODate } from '@/lib/timezone';

// ------------------------------------------------------------
// Tipos
// ------------------------------------------------------------

type TipoIncapacidad = 'ENFERMEDAD_GENERAL' | 'MATERNIDAD' | 'RIESGO_TRABAJO';

interface ImssRecord {
  employeeId: string;
  employeeNumber: string;
  nss: string;
  rfc: string;
  curp: string;
  nombreCompleto: string;
  sucursalName: string;
  sucursalCodigoLocal: string;
  tipoIncapacidad: TipoIncapacidad;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string; // YYYY-MM-DD
  dias: number;
  folioIMSS: string | null;
  notas: string | null;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/**
 * Mapea el Vacation.type al código IMSS:
 *   - MATERNIDAD       → "MATERNIDAD" (art. 170 LFT — 12 semanas)
 *   - RIESGO_TRABAJO   → "RIESGO_TRABAJO" (LSS art. 41, 51 — accidente/enfermedad de trabajo)
 *   - INCAPACIDAD      → "ENFERMEDAD_GENERAL" (LSS art. 96 — 52 semanas)
 *
 * Antes se infería RIESGO_TRABAJO por regex sobre el `reason`; ahora es un
 * tipo explícito en el modelo Vacation (reforma del schema).
 */
function mapTipoIncapacidad(type: string): TipoIncapacidad {
  if (type === 'MATERNIDAD') return 'MATERNIDAD';
  if (type === 'RIESGO_TRABAJO') return 'RIESGO_TRABAJO';
  return 'ENFERMEDAD_GENERAL';
}

/**
 * Días calendario inclusivos entre dos fechas (endDate - startDate + 1).
 * Igual que diasVacacionEnPeriodo de stps-report.ts, pero SIN clip al
 * periodo del reporte — para IMSS se reporta el rango COMPLETO de la
 * incapacidad, aunque empiece antes o termine después del periodo
 * solicitado (es lo que el patrón reconcilia con SUA).
 */
function calcDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Escapa un valor para CSV: lo envuelve en comillas dobles si contiene
 * coma, comilla doble, salto de línea o retorno de carro. Las comillas
 * dobles internas se duplican (RFC 4180).
 */
function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ------------------------------------------------------------
// GET handler
// ------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    // --- Autenticación y autorización (mismo patrón que /absences) ---
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { searchParams } = new URL(req.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const requestedSucursalId = searchParams.get('sucursalId');
    const format = (searchParams.get('format') || 'csv').toLowerCase();

    // SUCURSAL_ADMIN / SUPERVISOR siempre ven su propia sucursal.
    // GENERAL_ADMIN puede ver todas si se omite sucursalId.
    const sucursalId =
      user.role === 'SUCURSAL_ADMIN' || user.role === 'SUPERVISOR'
        ? user.sucursalId
        : requestedSucursalId;

    // --- Validación de formato ---
    if (!['csv', 'json'].includes(format)) {
      return NextResponse.json(
        { error: 'format inválido (csv o json)' },
        { status: 400 }
      );
    }

    // --- Validación de rango de fechas (sin tope máximo) ---
    const { range, errorResponse } = parseDateRange(startDateStr, endDateStr);
    if (!range) return errorResponse!;
    const { start, end, startISO, endISO } = range;

    // --- Query de incapacidades/maternidades aprobadas que se
    //     solapan con el periodo [start, end].
    //     Overlap: vacation.startDate <= range.end AND
    //              vacation.endDate   >= range.start
    //     (equivalente al filtro que usa stps-report.ts líneas 414-415).
    const where: {
      type: { in: string[] };
      status: string;
      startDate: { lte: Date };
      endDate: { gte: Date };
      employee?: { sucursalId: string };
    } = {
      type: { in: ['INCAPACIDAD', 'MATERNIDAD', 'RIESGO_TRABAJO'] },
      status: 'APPROVED',
      startDate: { lte: end },
      endDate: { gte: start },
    };
    if (sucursalId) {
      where.employee = { sucursalId };
    }

    // --- Query de incapacidades/maternidades/riesgos de trabajo aprobadas
    //     que se solapan con el periodo [start, end].
    //     Overlap: vacation.startDate <= range.end AND
    //              vacation.endDate   >= range.start
    //     (equivalente al filtro que usa stps-report.ts líneas 414-415).
    //     Incluye nss (Employee) y folioIMSS (Vacation) — reforma del schema.
    const vacations = await db.vacation.findMany({
      where,
      include: {
        employee: {
          include: {
            user: { select: { id: true, name: true } },
            sucursal: {
              select: { id: true, name: true, codigoLocal: true },
            },
          },
        },
      },
      // El orderBy anidado (employee.user.name) puede no ser soportado
      // en todos los backends de Prisma (especialmente SQLite), así que
      // ordenamos en JS después del fetch para garantizar el orden
      // "startDate ASC, luego nombre del empleado ASC".
      orderBy: [{ startDate: 'asc' }],
    });

    // --- Construcción de registros IMSS ---
    const records: ImssRecord[] = vacations.map((v: any) => {
      const emp = v.employee;
      const suc = emp?.sucursal;
      const vStart = new Date(v.startDate);
      const vEnd = new Date(v.endDate);
      return {
        employeeId: emp?.id ?? '',
        employeeNumber: emp?.employeeNumber ?? '',
        nss: emp?.nss ?? '', // NSS del Employee (LSS art. 15) — capturado por el admin.
        rfc: emp?.rfc ?? '',
        curp: emp?.curp ?? '',
        nombreCompleto: emp?.user?.name ?? '',
        sucursalName: suc?.name ?? '',
        sucursalCodigoLocal: suc?.codigoLocal ?? '',
        tipoIncapacidad: mapTipoIncapacidad(v.type),
        fechaInicio: toISODate(vStart),
        fechaFin: toISODate(vEnd),
        dias: calcDays(vStart, vEnd),
        folioIMSS: v.folioIMSS ?? null, // Folio IMSS (ST-3/ST-7/SV-CAE) — capturado al aprobar.
        notas: v.reason ?? null,
      };
    });

    // --- Orden secundario por nombre del empleado (startDate ya está
    //     ordenado por Prisma; este sort es estable en V8 para empates).
    records.sort((a, b) => {
      if (a.fechaInicio !== b.fechaInicio) {
        return a.fechaInicio < b.fechaInicio ? -1 : 1;
      }
      const na = a.nombreCompleto.toLowerCase();
      const nb = b.nombreCompleto.toLowerCase();
      if (na !== nb) return na < nb ? -1 : 1;
      return 0;
    });

    // --- Días totales del periodo (para metadata del reporte) ---
    const totalDays = calcDays(start, end);

    const generatedAt = new Date().toISOString();

    // --- Auditoría (Art. 132 LFT + LSS art. 15 — trazabilidad) ---
    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'EXPORT_IMSS_REPORT',
      entityType: 'REPORT',
      entityId: null,
      sucursalId: sucursalId || null,
      ipAddress: ip,
      userAgent: ua,
      details: {
        tipo: 'IMSS_LSS_ART_15',
        periodo: { start: startISO, end: endISO, totalDays },
        sucursalId: sucursalId || null,
        registros: records.length,
        format,
      },
    });

    // --- Respuesta JSON ---
    if (format === 'json') {
      return NextResponse.json({
        period: { start: startISO, end: endISO, totalDays },
        generatedAt,
        totalRecords: records.length,
        records,
      });
    }

    // --- Respuesta CSV (default) ---
    // Primera línea: comentario explicativo (muchos parsers CSV
    // interpretan las líneas que empiezan con # como comentarios y las
    // ignoran al importar — patrón usado por SUA y otras herramientas
    // gubernamentales mexicanas).
    const timestamp = new Date(generatedAt).toLocaleString('es-MX');
    const headerRow = [
      'NSS',
      'RFC',
      'CURP',
      'Nombre',
      'Numero Empleado',
      'Sucursal',
      'Codigo Local',
      'Tipo Incapacidad',
      'Fecha Inicio',
      'Fecha Fin',
      'Dias',
      'Folio IMSS',
      'Notas',
    ];

    const csvLines: string[] = [
      `# Reporte de Incapacidades para IMSS (Ley del Seguro Social art. 15) - Generado el ${timestamp}`,
      headerRow.join(','),
      ...records.map((r) =>
        [
          r.nss,
          r.rfc,
          r.curp,
          r.nombreCompleto,
          r.employeeNumber,
          r.sucursalName,
          r.sucursalCodigoLocal,
          r.tipoIncapacidad,
          r.fechaInicio,
          r.fechaFin,
          r.dias,
          r.folioIMSS,
          r.notas,
        ]
          .map(csvEscape)
          .join(',')
      ),
    ];

    if (records.length === 0) {
      csvLines.push(
        '# Sin incapacidades aprobadas en el periodo seleccionado.'
      );
    }

    const csvContent = csvLines.join('\n');
    const filename = `reporte_imss_${startISO}_${endISO}.csv`;
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('GET /api/reports/imss-format error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
