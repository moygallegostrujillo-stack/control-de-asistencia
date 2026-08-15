// ============================================================
// POST /api/admin/retention/archive
//   RT-P0.8 (auditoría 14-ago-2026): Retención y archivo automático de
//   registros de asistencia mayores a 12 meses (LFT art. 804).
//
//   LFT art. 804 obliga al patrón a conservar los registros de asistencia
//   por 12 meses posteriores a la terminación de la relación laboral.
//   Esta función:
//     1. Identifica AttendanceRecords con date < (hoy - 12 meses) que
//        pertenezcan a empleados inactivos (isActive=false).
//     2. Los archiva: los marca como archivados (campo archivedAt) y
//        suprime las IPs/User-Agents (LFPDPPP art. 31 — ya no son
//        necesarios para la finalidad probatoria).
//     3. Registra la acción en AuditLog para evidencia.
//
//   Diseño:
//     - NO elimina los registros: los marca como archivados y anonimiza
//       IPs/UA. Esto conserva el valor probatorio (LFT art. 804) y cumple
//       la supresión efectiva de PII (LFPDPPP art. 31).
//     - Solo aplica a empleados inactivos (isActive=false). Los registros
//       de empleados activos se conservan intactos, sin importar antigüedad.
//     - Es idempotente: si se ejecuta múltiples veces, no duplica trabajo.
//
//   Ejecución:
//     - Manual: POST /api/admin/retention/archive (auth admin)
//     - Automática: Vercel Cron (configurar en vercel.json) el primer día
//       de cada mes.
//
//   Auth: sesión GENERAL_ADMIN o token de emergencia ?token=RETENTION_2027
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isGeneralAdmin,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';

const RETENTION_TOKEN = 'RETENTION_2027';
const RETENTION_MONTHS = 12;

export async function POST(req: NextRequest) {
  try {
    // --- Auth dual: sesión admin O token de emergencia ---
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get('token');
    const dryRun = url.searchParams.get('dryRun') === 'true';

    let authorized = false;
    let adminUserId: string | null = null;

    if (tokenParam === RETENTION_TOKEN) {
      authorized = true;
    } else {
      const user = await getAuthUser(req);
      if (user && isGeneralAdmin(user)) {
        authorized = true;
        adminUserId = user.id;
      }
    }

    if (!authorized) {
      if (tokenParam !== null) {
        return NextResponse.json(
          { error: 'Token de retención inválido' },
          { status: 403 }
        );
      }
      const user = await getAuthUser(req);
      if (!user) return unauthorizedResponse();
      return forbiddenResponse();
    }

    // --- Calcular fecha de corte (hoy - 12 meses) ---
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_MONTHS);

    // --- Identificar registros elegibles para archivar ---
    // Criterios:
    //   - date < cutoffDate (mayores a 12 meses)
    //   - employee.isActive = false (empleado dado de baja)
    //   - archivedAt IS NULL (no archivados previamente)
    //
    // Nota: el campo `archivedAt` no existe en el schema actual. Lo
    // simulamos marcando los registros en el AuditLog y anonimizando
    // IPs/UA. Si en el futuro se añade el campo, la consulta puede
    // filtrar por él.
    const eligibleRecords = await db.attendanceRecord.findMany({
      where: {
        date: { lt: cutoffDate },
        employee: { isActive: false },
        // Solo registros que aún tengan IPs/UA sin anonimizar (idempotencia).
        // Si ya fueron anonimizados, no hay nada que archivar.
        OR: [
          { checkInIp: { not: null } },
          { checkOutIp: { not: null } },
          { checkInUserAgent: { not: null } },
          { checkOutUserAgent: { not: null } },
        ],
      },
      select: {
        id: true,
        employeeId: true,
        date: true,
        checkInIp: true,
        checkOutIp: true,
        employee: { select: { id: true, employeeNumber: true, user: { select: { name: true } } } },
      },
      take: 5000, // limit por batch para no saturar memoria
    });

    if (eligibleRecords.length === 0) {
      return NextResponse.json({
        success: true,
        dryRun,
        message: 'No hay registros elegibles para archivar.',
        archivedCount: 0,
        cutoffDate: cutoffDate.toISOString(),
      });
    }

    // --- Dry run: solo reportar, no modificar ---
    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Se archivarían ${eligibleRecords.length} registros de empleados inactivos con date < ${cutoffDate.toISOString().slice(0, 10)}.`,
        archivedCount: 0,
        wouldArchive: eligibleRecords.length,
        cutoffDate: cutoffDate.toISOString(),
        sample: eligibleRecords.slice(0, 5).map((r) => ({
          id: r.id,
          employeeId: r.employeeId,
          employeeNumber: r.employee.employeeNumber,
          employeeName: r.employee.user.name,
          date: r.date.toISOString().slice(0, 10),
        })),
      });
    }

    // --- Archivar: anonimizar IPs/UA en los registros elegibles ---
    // Usamos updateMany con where por IDs para eficiencia.
    const recordIds = eligibleRecords.map((r) => r.id);

    const updateResult = await db.attendanceRecord.updateMany({
      where: { id: { in: recordIds } },
      data: {
        checkInIp: null,
        checkInUserAgent: null,
        checkOutIp: null,
        checkOutUserAgent: null,
      },
    });

    // --- Registrar en AuditLog para evidencia probatoria ---
    const { ip, ua } = getIpAndUA(req);
    const employeesAffected = new Set(eligibleRecords.map((r) => r.employeeId));

    await auditLog({
      userId: adminUserId ?? undefined,
      action: 'RETENTION_ARCHIVE',
      entityType: 'ATTENDANCE_RECORD',
      entityId: null,
      sucursalId: null,
      ipAddress: ip,
      userAgent: ua,
      details: {
        legalReference: 'LFT art. 804 (conservación 12 meses); LFPDPPP art. 31 (supresión efectiva)',
        cutoffDate: cutoffDate.toISOString(),
        archivedCount: updateResult.count,
        employeesAffected: employeesAffected.size,
        retentionMonths: RETENTION_MONTHS,
        triggeredBy: adminUserId ? 'MANUAL_ADMIN' : 'CRON_TOKEN',
        note:
          'Anonimización de IPs/User-Agents en registros >12 meses de empleados inactivos. ' +
          'Los registros se conservan (LFT art. 804) pero sin PII de red (LFPDPPP art. 31).',
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Se archivaron ${updateResult.count} registros de ${employeesAffected.size} empleado(s) inactivo(s).`,
      archivedCount: updateResult.count,
      employeesAffected: employeesAffected.size,
      cutoffDate: cutoffDate.toISOString(),
      legalReference: 'LFT art. 804; LFPDPPP art. 31',
    });
  } catch (error) {
    console.error('POST /api/admin/retention/archive error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error en retención de registros',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// ============================================================
// GET /api/admin/retention/archive
//   Reporte de cuántos registros serían archivados (dry-run por defecto).
//   Útil para preview antes de ejecutar el POST.
// ============================================================
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isGeneralAdmin(user)) return forbiddenResponse();

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_MONTHS);

    const eligibleCount = await db.attendanceRecord.count({
      where: {
        date: { lt: cutoffDate },
        employee: { isActive: false },
        OR: [
          { checkInIp: { not: null } },
          { checkOutIp: { not: null } },
          { checkInUserAgent: { not: null } },
          { checkOutUserAgent: { not: null } },
        ],
      },
    });

    const totalInactiveRecords = await db.attendanceRecord.count({
      where: {
        date: { lt: cutoffDate },
        employee: { isActive: false },
      },
    });

    return NextResponse.json({
      cutoffDate: cutoffDate.toISOString(),
      retentionMonths: RETENTION_MONTHS,
      eligibleForArchive: eligibleCount,
      totalInactiveRecordsOlderThan12Months: totalInactiveRecords,
      alreadyArchived: totalInactiveRecords - eligibleCount,
      legalReference: 'LFT art. 804 (12 meses); LFPDPPP art. 31 (supresión PII)',
      nextSteps:
        eligibleCount > 0
          ? `Ejecute POST /api/admin/retention/archive para archivar ${eligibleCount} registros.`
          : 'No hay registros pendientes de archivar.',
    });
  } catch (error) {
    console.error('GET /api/admin/retention/archive error:', error);
    return NextResponse.json(
      { error: 'Error al obtener reporte de retención' },
      { status: 500 }
    );
  }
}
