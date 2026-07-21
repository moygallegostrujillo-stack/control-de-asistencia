// ============================================================
// /api/reports/my-export — GET
//   Exportación CSV del propio historial del empleado (Reforma LFT 2027 —
//   art. 132 XXXIV: "hará prueba plena si fue acordado entre trabajador y
//   empleadora"). El empleado puede descargar sus registros para revisarlos
//   y conservarlos. Solo accede a SUS registros.
//
//   Query params:
//     startDate=YYYY-MM-DD  (default: hace 30 días)
//     endDate=YYYY-MM-DD    (default: hoy)
//     format=csv            (csv por defecto; xlsx también soportado)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
} from '@/lib/auth';
import {
  toISODate,
  getMexicoTodayISO,
  formatTimeInMexico,
  minutesToHours,
} from '@/lib/timezone';
import { auditLog, getIpAndUA } from '@/lib/audit';

const MAX_RANGE_DAYS = 365; // el empleado puede exportar hasta 1 año

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

    // Solo empleados (los admins usan /api/reports/export)
    if (user.role === 'GENERAL_ADMIN' || user.role === 'SUCURSAL_ADMIN') {
      return NextResponse.json(
        { error: 'Los administradores deben usar /api/reports/export' },
        { status: 400 }
      );
    }

    if (!user.employeeId) {
      return NextResponse.json(
        { error: 'Su usuario no tiene empleado asociado' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const today = getMexicoTodayISO();
    const thirtyAgo = new Date();
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    const thirtyAgoISO = thirtyAgo.toISOString().slice(0, 10);

    const startDateStr = searchParams.get('startDate') || thirtyAgoISO;
    const endDateStr = searchParams.get('endDate') || today;
    const format = (searchParams.get('format') || 'csv').toLowerCase();

    if (!['csv', 'xlsx'].includes(format)) {
      return NextResponse.json(
        { error: 'format inválido (csv o xlsx)' },
        { status: 400 }
      );
    }

    const start = new Date(`${startDateStr}T00:00:00.000Z`);
    const end = new Date(`${endDateStr}T23:59:59.999Z`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Fechas inválidas (use YYYY-MM-DD)' },
        { status: 400 }
      );
    }
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) {
      return NextResponse.json(
        { error: 'La fecha de inicio no puede ser posterior a la de fin' },
        { status: 400 }
      );
    }
    if (diffDays > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `El rango máximo es de ${MAX_RANGE_DAYS} días` },
        { status: 400 }
      );
    }

    // Cargar registros del empleado + info de sucursal y empresa
    const [records, employee, company] = await Promise.all([
      db.attendanceRecord.findMany({
        where: {
          employeeId: user.employeeId,
          date: { gte: start, lte: end },
        },
        orderBy: { date: 'asc' },
      }),
      db.employee.findUnique({
        where: { id: user.employeeId },
        include: {
          user: { select: { name: true, email: true } },
          sucursal: { select: { id: true, name: true, codigoLocal: true } },
        },
      }),
      db.company.findUnique({ where: { id: 'singleton' } }),
    ]);

    if (!employee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'EMPLOYEE_EXPORT',
      entityType: 'ATTENDANCE_RECORD',
      entityId: user.employeeId,
      sucursalId: employee.sucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: {
        employeeId: user.employeeId,
        startDate: startDateStr,
        endDate: endDateStr,
        recordCount: records.length,
        format,
        performedBy: user.email,
      },
    });

    const filename = `MiRegistro_${startDateStr}_${endDateStr}`;

    // Construir rows para CSV/XLSX
    const rows = records.map((r) => ({
      Fecha: toISODate(r.date),
      'Entrada': r.checkInTime ? formatTimeInMexico(r.checkInTime) : '—',
      'Salida': r.checkOutTime ? formatTimeInMexico(r.checkOutTime) : '—',
      'Comida inicio': r.mealStart ? formatTimeInMexico(r.mealStart) : '—',
      'Comida fin': r.mealEnd ? formatTimeInMexico(r.mealEnd) : '—',
      'Min. trabajados': r.workedMinutes ?? '',
      'Horas extra (min)': r.overtimeMinutes ?? 0,
      'Horas extra DOBLE (min)': r.overtimeDoubleMinutes ?? 0,
      'Horas extra TRIPLE (min)': r.overtimeTripleMinutes ?? 0,
      // Prima por descanso trabajado (art. 73 LFT)
      'Día de Descanso Trabajado': r.isRestDayWorked ? 'Sí' : 'No',
      'Prima 100% (min)': r.restDayPremiumMinutes ?? 0,
      'Domingo': r.isSunday ? 'Sí' : 'No',
      'Estado': STATUS_ES[r.status] || r.status,
      'Firmado': r.employeeSignedAt ? toISODate(r.employeeSignedAt) : 'No firmado',
      '¿Corregido?': r.correctedAt ? 'Sí' : 'No',
      'Motivo corrección': r.correctionReason || '',
    }));

    // ---------- CSV ----------
    if (format === 'csv') {
      const headerNote = [
        `# Reporte de mi registro de asistencia`,
        `# Empleado: ${employee.user.name} (${employee.employeeNumber})`,
        `# Sucursal: ${employee.sucursal.codigoLocal ? `Local ${employee.sucursal.codigoLocal} — ` : ''}${employee.sucursal.name}`,
        `# Empresa: ${company?.razonSocial || 'N/A'} | RFC: ${company?.rfc || 'N/A'}`,
        `# Periodo: ${startDateStr} a ${endDateStr}`,
        `# Generado: ${new Date().toISOString()}`,
        ``,
      ].join('\n');

      if (rows.length === 0) {
        const empty = `${headerNote}No hay registros en el periodo seleccionado.\n`;
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
    portada.addRow(['MI REGISTRO DE ASISTENCIA']);
    portada.getCell('A1').font = { bold: true, size: 16 };
    portada.addRow([]);
    portada.addRow(['Empleado', employee.user.name]);
    portada.addRow(['Número', employee.employeeNumber]);
    portada.addRow(['Email', employee.user.email]);
    portada.addRow(['Departamento', employee.department || '—']);
    portada.addRow(['Puesto', employee.position || '—']);
    portada.addRow(['Sucursal', `${employee.sucursal.codigoLocal ? `Local ${employee.sucursal.codigoLocal} — ` : ''}${employee.sucursal.name}`]);
    portada.addRow([]);
    portada.addRow(['Empresa', company?.razonSocial || 'N/A']);
    portada.addRow(['RFC', company?.rfc || 'N/A']);
    portada.addRow(['Registro Patronal', company?.registroPatronal || 'N/A']);
    portada.addRow(['Domicilio', company?.domicilioFiscal || 'N/A']);
    portada.addRow([]);
    portada.addRow(['Periodo', `${startDateStr} a ${endDateStr}`]);
    portada.addRow(['Generado', new Date().toISOString()]);
    portada.addRow(['Total registros', records.length]);
    portada.addRow([]);
    portada.addRow(['Este documento es una constancia de mi registro de']);
    portada.addRow(['asistencia conforme al art. 132 fracción XXXIV de la LFT']);
    portada.addRow(['(DOF 1-may-2026, vigente 1-ene-2027).']);

    // Sheet 2: Detalle
    const det = wb.addWorksheet('Detalle');
    if (rows.length > 0) {
      det.columns = Object.keys(rows[0]).map((key) => ({
        header: key,
        key,
        width: 18,
      }));
      det.addRows(rows);
      det.getRow(1).font = { bold: true };
      det.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E7EB' },
      };
      det.views = [{ state: 'frozen', ySplit: 1 }];
    } else {
      det.addRow(['No hay registros en el periodo seleccionado']);
    }

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('my-export error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
