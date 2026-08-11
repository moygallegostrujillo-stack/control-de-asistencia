// ============================================================
// /api/reports/corrections — GET
//   Reporte de correcciones manuales a registros de asistencia
//   (LFT 2027 — art. 132 fracción XXXIV y NOM-037 — trazabilidad
//   de modificaciones para prueba plena).
//
//   Devuelve los registros cuyo campo `correctedAt` cae dentro del
//   rango solicitado. Filtra por sucursal (SUCURSAL_ADMIN forzado
//   a la suya), por `correctedById` y por `employeeId`.
//
//   Soporta JSON (default), CSV y XLSX (format=csv|xlsx).
//
//   SIN tope máximo de días (decisión del usuario).
//
//   Query params:
//     startDate=YYYY-MM-DD  (requerido)
//     endDate=YYYY-MM-DD    (requerido)
//     sucursalId=...        (opcional — SUCURSAL_ADMIN forzado al suyo)
//     correctedById=...     (opcional — filtra por quién corrigió)
//     employeeId=...        (opcional — filtra por empleado)
//     format=csv|xlsx       (opcional — si se omite, JSON)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth';
import {
  toISODate,
  formatTimeInMexico,
  formatDateTimeInMexico,
} from '@/lib/timezone';
import {
  parseDateRange,
  buildPeriodResponse,
} from '@/lib/reports';
import { auditLog, getIpAndUA } from '@/lib/audit';

const STATUS_ES: Record<string, string> = {
  PRESENT: 'Presente',
  LATE: 'Retardo',
  ABSENT: 'Ausente',
  EARLY_LEAVE: 'Salida Anticipada',
};

const JUSTIFICATION_ES: Record<string, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
};

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    // Sólo GENERAL_ADMIN y SUCURSAL_ADMIN (no SUPERVISOR ni EMPLOYEE).
    if (user.role !== 'GENERAL_ADMIN' && user.role !== 'SUCURSAL_ADMIN') {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(req.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const requestedSucursalId = searchParams.get('sucursalId');
    const correctedById = searchParams.get('correctedById');
    const employeeId = searchParams.get('employeeId');
    const formatParam = searchParams.get('format');

    // Validar formato (si viene)
    if (formatParam && !['csv', 'xlsx'].includes(formatParam.toLowerCase())) {
      return NextResponse.json(
        { error: 'format inválido (csv o xlsx)' },
        { status: 400 }
      );
    }
    const format = formatParam ? formatParam.toLowerCase() : null;

    // Validar rango (sin tope máximo)
    const { range, errorResponse } = parseDateRange(startDateStr, endDateStr);
    if (!range) return errorResponse!;
    const { start, end } = range;

    // SUCURSAL_ADMIN: forzar su sucursal
    const sucursalId =
      user.role === 'SUCURSAL_ADMIN' ? user.sucursalId : requestedSucursalId;

    // Cargar registros corregidos en el rango
    const records = await db.attendanceRecord.findMany({
      where: {
        correctedAt: { not: null, gte: start, lte: end },
        ...(sucursalId ? { sucursalId } : {}),
        ...(correctedById ? { correctedById } : {}),
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            sucursal: { select: { id: true, name: true, codigoLocal: true } },
          },
        },
        correctedBy: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { correctedAt: 'desc' },
    });

    // Datos de la empresa para XLSX
    const company = await db.company.findUnique({
      where: { id: 'singleton' },
    });

    // ----- Construir respuesta JSON canónica -----
    const corrections = records.map((r) => ({
      id: r.id,
      recordDate: toISODate(r.date),
      employee: {
        id: r.employee.id,
        employeeNumber: r.employee.employeeNumber,
        name: r.employee.user.name,
        department: r.employee.department,
        position: r.employee.position,
        sucursal: {
          id: r.employee.sucursal.id,
          name: r.employee.sucursal.name,
          codigoLocal: r.employee.sucursal.codigoLocal,
        },
      },
      originalCheckIn: r.originalCheckInTime
        ? r.originalCheckInTime.toISOString()
        : null,
      originalCheckOut: r.originalCheckOutTime
        ? r.originalCheckOutTime.toISOString()
        : null,
      currentCheckIn: r.checkInTime ? r.checkInTime.toISOString() : null,
      currentCheckOut: r.checkOutTime ? r.checkOutTime.toISOString() : null,
      workedMinutes: r.workedMinutes,
      overtimeMinutes: r.overtimeMinutes ?? 0,
      status: r.status,
      correctionReason: r.correctionReason,
      correctedAt: r.correctedAt ? r.correctedAt.toISOString() : null,
      correctedBy: r.correctedBy
        ? {
            id: r.correctedBy.id,
            name: r.correctedBy.name,
            email: r.correctedBy.email,
            role: r.correctedBy.role,
          }
        : null,
      notes: r.notes,
      justificationStatus: r.justificationStatus,
    }));

    // ----- Summary -----
    const bySucursalMap = new Map<
      string,
      { sucursalId: string; sucursalName: string; count: number }
    >();
    const byCorrectorMap = new Map<
      string,
      { correctedById: string; correctedByName: string; count: number }
    >();
    const affectedEmployeesSet = new Set<string>();

    for (const r of records) {
      // bySucursal
      const sucId = r.employee.sucursal?.id || '—';
      const sucName = r.employee.sucursal?.codigoLocal
        ? `Local ${r.employee.sucursal.codigoLocal} — ${r.employee.sucursal.name}`
        : r.employee.sucursal?.name || '—';
      if (!bySucursalMap.has(sucId)) {
        bySucursalMap.set(sucId, { sucursalId: sucId, sucursalName: sucName, count: 0 });
      }
      bySucursalMap.get(sucId)!.count += 1;

      // byCorrector
      const corrId = r.correctedBy?.id || '—';
      const corrName = r.correctedBy?.name || '—';
      if (!byCorrectorMap.has(corrId)) {
        byCorrectorMap.set(corrId, {
          correctedById: corrId,
          correctedByName: corrName,
          count: 0,
        });
      }
      byCorrectorMap.get(corrId)!.count += 1;

      affectedEmployeesSet.add(r.employeeId);
    }

    const summary = {
      total: corrections.length,
      bySucursal: Array.from(bySucursalMap.values()),
      byCorrector: Array.from(byCorrectorMap.values()),
      affectedEmployees: affectedEmployeesSet.size,
    };

    // ----- Audit log -----
    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'REPORT_GENERATED',
      entityType: 'ATTENDANCE_RECORD',
      sucursalId: sucursalId || null,
      ipAddress: ip,
      userAgent: ua,
      details: {
        reportType: 'corrections',
        startDate: range.startISO,
        endDate: range.endISO,
        totalReturned: corrections.length,
        filters: { sucursalId, correctedById, employeeId },
        format: format || 'json',
      },
    });

    // ----- JSON (default) -----
    if (!format) {
      return NextResponse.json({
        corrections,
        summary,
        period: buildPeriodResponse(range),
      });
    }

    // ----- Construir rows para CSV/XLSX -----
    const rows = records.map((r) => {
      const sucursalLabel = r.employee.sucursal?.codigoLocal
        ? `Local ${r.employee.sucursal.codigoLocal} — ${r.employee.sucursal.name}`
        : r.employee.sucursal?.name || '—';
      return {
        'Fecha Registro': toISODate(r.date),
        'Fecha Corrección': r.correctedAt
          ? formatDateTimeInMexico(r.correctedAt)
          : '—',
        'Empleado': r.employee.user.name,
        'Número': r.employee.employeeNumber,
        'Sucursal': sucursalLabel,
        'Departamento': r.employee.department || '—',
        'Puesto': r.employee.position || '—',
        'Entrada Original': r.originalCheckInTime
          ? formatTimeInMexico(r.originalCheckInTime)
          : '—',
        'Salida Original': r.originalCheckOutTime
          ? formatTimeInMexico(r.originalCheckOutTime)
          : '—',
        'Entrada Actual': r.checkInTime
          ? formatTimeInMexico(r.checkInTime)
          : '—',
        'Salida Actual': r.checkOutTime
          ? formatTimeInMexico(r.checkOutTime)
          : '—',
        'Min. Trabajados': r.workedMinutes ?? '',
        'Min. Extra': r.overtimeMinutes ?? 0,
        'Estado': STATUS_ES[r.status] || r.status,
        'Motivo Corrección': r.correctionReason || '—',
        'Corregido Por': r.correctedBy?.name || '—',
        'Corregido Por (Email)': r.correctedBy?.email || '—',
        'Notas': r.notes || '—',
        'Justificación': r.justificationStatus
          ? JUSTIFICATION_ES[r.justificationStatus] || r.justificationStatus
          : '—',
      };
    });

    const filename = `correcciones_${range.startISO}_${range.endISO}`;

    // ---------- CSV ----------
    if (format === 'csv') {
      const headerNote = [
        `# Reporte de Correcciones a Registros de Asistencia`,
        `# Empresa: ${company?.razonSocial || 'N/A'} | RFC: ${company?.rfc || 'N/A'}`,
        `# Periodo: ${range.startISO} a ${range.endISO}`,
        `# Generado: ${new Date().toISOString()}`,
        `# Total correcciones: ${records.length}`,
        `# Conforme al art. 132 fracción XXXIV LFT 2027 y NOM-037 — trazabilidad de modificaciones a registros de asistencia.`,
        ``,
      ].join('\n');

      if (rows.length === 0) {
        const empty = `${headerNote}No hay correcciones en el periodo seleccionado.\n`;
        return new NextResponse(empty, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}.csv"`,
          },
        });
      }

      const headers = Object.keys(rows[0]);
      const csvLines = [
        headers.join(','),
        ...rows.map((row) =>
          headers
            .map((h) => {
              const val = (row as Record<string, any>)[h];
              if (val === null || val === undefined) return '';
              const s = String(val);
              return s.includes(',') || s.includes('"') || s.includes('\n')
                ? `"${s.replace(/"/g, '""')}"`
                : s;
            })
            .join(',')
        ),
      ];
      const csvContent = headerNote + csvLines.join('\n') + '\n';
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

    // Sheet 1: Portada
    const portada = wb.addWorksheet('Portada');
    portada.columns = [{ width: 28 }, { width: 60 }];
    portada.addRow(['REPORTE DE CORRECCIONES']);
    portada.getCell('A1').font = { bold: true, size: 16 };
    portada.addRow([]);
    portada.addRow(['Periodo', `${range.startISO} a ${range.endISO}`]);
    portada.addRow(['Generado el', new Date().toLocaleString('es-MX')]);
    portada.addRow(['Generado por', user.name]);
    portada.addRow(['Total de Correcciones', records.length]);
    portada.addRow([]);
    portada.addRow(['DATOS DE LA EMPRESA']);
    portada.getCell('A9').font = { bold: true, size: 12 };
    portada.addRow(['Razón Social', company?.razonSocial || '—']);
    portada.addRow(['RFC', company?.rfc || '—']);
    portada.addRow(['Registro Patronal', company?.registroPatronal || '—']);
    portada.addRow(['Domicilio Fiscal', company?.domicilioFiscal || '—']);
    portada.addRow([]);
    portada.addRow([
      'Conforme al art. 132 fracción XXXIV LFT 2027 y NOM-037 —',
    ]);
    portada.addRow(['trazabilidad de modificaciones a registros de asistencia.']);

    // Marca las etiquetas (col A) en negritas, excepto el título y la sección
    for (let i = 3; i <= portada.rowCount; i++) {
      if (i === 9) continue;
      const cell = portada.getCell(`A${i}`);
      if (cell.value) cell.font = { bold: true };
    }

    // Sheet 2: Correcciones
    const det = wb.addWorksheet('Correcciones');
    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      det.columns = headers.map((key) => ({
        header: key,
        key,
        width: Math.max(14, Math.min(40, key.length + 4)),
      }));
      det.addRows(rows);
      const headerRow = det.getRow(1);
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
      for (let r = 2; r <= det.rowCount; r++) {
        for (let c = 1; c <= headers.length; c++) {
          det.getRow(r).getCell(c).border = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' },
          };
        }
      }
      det.views = [{ state: 'frozen', ySplit: 1 }];
    } else {
      det.addRow(['No hay correcciones en el periodo seleccionado']);
    }

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('GET /api/reports/corrections error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
