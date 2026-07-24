// ============================================================
// GET /api/user/mydata
//   DERECHO DE ACCESO — LFPDPPP art. 29.
//   Retorna TODOS los datos personales que el sistema tiene del
//   usuario autenticado: datos de cuenta, empleado, sucursal,
//   registros de asistencia, vacaciones, horarios, audit logs.
//
//   El usuario puede descargar este JSON como evidencia de qué
//   datos personales se están tratando sobre él.
//
//   Solo el propio usuario puede consultar sus datos. No se
//   requiere rol admin — es un derecho personalísimo.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    // 1. Datos de la cuenta de usuario (datos personales identificativos).
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        mfaEnabled: true,
        mfaEnrolledAt: true,
        // NO exponer mfaSecret ni passwordHash ni mfaBackupCodesHash
        // (datos sensibles que no corresponden al titular).
        privacyAcceptedAt: true,
        privacyAcceptedVersion: true,
        createdAt: true,
        updatedAt: true,
        sucursalId: true,
      },
    });

    if (!dbUser) return unauthorizedResponse();

    // 2. Datos del Employee (si existe).
    const employee = await db.employee.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        employeeNumber: true,
        position: true,
        department: true,
        hireDate: true,
        baseSalary: true,
        vacationBalanceDays: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        sucursalId: true,
        sucursal: {
          select: { id: true, name: true, codigoLocal: true, address: true },
        },
        workSchedules: {
          select: {
            id: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            toleranceMinutes: true,
            isWeeklyRest: true,
          },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    // 3. Registros de asistencia (datos personales laborales).
    let attendanceRecords: any[] = [];
    let attendanceSummary: any = null;
    if (employee) {
      attendanceRecords = await db.attendanceRecord.findMany({
        where: { employeeId: employee.id },
        select: {
          id: true,
          date: true,
          checkInTime: true,
          checkOutTime: true,
          checkInMethod: true,
          checkOutMethod: true,
          checkInLat: true,
          checkInLong: true,
          checkOutLat: true,
          checkOutLong: true,
          mealStart: true,
          mealEnd: true,
          mealDurationMinutes: true,
          restStart: true,
          restEnd: true,
          status: true,
          workedMinutes: true,
          overtimeMinutes: true,
          overtimeDoubleMinutes: true,
          overtimeTripleMinutes: true,
          isRestDayWorked: true,
          restDayWorkedMinutes: true,
          isSunday: true,
          notes: true,
          justification: true,
          justificationStatus: true,
          isLocked: true,
          correctionReason: true,
          correctedAt: true,
          employeeSignedAt: true,
        },
        orderBy: { date: 'desc' },
        take: 1000, // límite razonable
      });

      const totalRecords = await db.attendanceRecord.count({
        where: { employeeId: employee.id },
      });
      const totalOvertimeMinutes = attendanceRecords.reduce(
        (sum, r) => sum + (r.overtimeMinutes || 0), 0
      );
      const totalRestDaysWorked = attendanceRecords.filter(r => r.isRestDayWorked).length;
      attendanceSummary = {
        totalRecords,
        returnedRecords: attendanceRecords.length,
        totalOvertimeMinutes,
        totalOvertimeHours: +(totalOvertimeMinutes / 60).toFixed(2),
        totalRestDaysWorked,
        dateRange: attendanceRecords.length > 0
          ? { from: attendanceRecords[attendanceRecords.length - 1].date, to: attendanceRecords[0].date }
          : null,
      };
    }

    // 4. Vacaciones / permisos solicitados.
    let vacations: any[] = [];
    if (employee) {
      vacations = await db.vacation.findMany({
        where: { employeeId: employee.id },
        select: {
          id: true,
          type: true,
          startDate: true,
          endDate: true,
          days: true,
          reason: true,
          status: true,
          grantMode: true,
          isPartial: true,
          partialHours: true,
          createdAt: true,
          approvedAt: true,
          approvedBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // 5. AuditLogs donde el usuario aparece como actor.
    const auditLogs = await db.auditLog.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        ipAddress: true,
        userAgent: true,
        details: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // 6. PrivacyRequests que el usuario ha presentado.
    const privacyRequests = await db.privacyRequest.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        type: true,
        status: true,
        requestDetails: true,
        resolutionNotes: true,
        createdAt: true,
        resolvedAt: true,
        resolvedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Audit del ejercicio del derecho de acceso (LFPDPPP art. 29).
    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'ARCO_ACCESS_EXERCISED',
      entityType: 'USER',
      entityId: user.id,
      ipAddress: ip,
      userAgent: ua,
      details: {
        legalReference: 'LFPDPPP art. 29 (derecho de acceso)',
        returnedSections: {
          user: true,
          employee: !!employee,
          attendanceRecords: attendanceRecords.length,
          vacations: vacations.length,
          auditLogs: auditLogs.length,
          privacyRequests: privacyRequests.length,
        },
      },
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      legalReference: 'LFPDPPP art. 29 — Derecho de acceso',
      user: dbUser,
      employee,
      attendanceRecords,
      attendanceSummary,
      vacations,
      auditLogs,
      privacyRequests,
      note:
        'Este documento contiene todos los datos personales que el sistema ' +
        'tiene sobre usted. Puede descargarlo en formato JSON. Para solicitar ' +
        'rectificación, cancelación u oposición, use /api/user/arco/request.',
    });
  } catch (error) {
    console.error('GET /api/user/mydata error:', error?.code || 'UNKNOWN');
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
