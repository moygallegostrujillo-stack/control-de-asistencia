// ============================================================
// PATCH /api/admin/arco/[id]/resolve
//   Marca una solicitud ARCO como RESOLVED o REJECTED.
//   Solo GENERAL_ADMIN. Registra quién, cuándo y notas de resolución.
//
//   Si type=CANCELLATION y status=RESOLVED → dispara la anonimización
//   automática de los datos del usuario (lib/privacy.ts → anonymizeUserData).
//   Conflicto LFPDPPP art. 31 vs LFT art. 804 resuelto por anonimización.
//
//   Body: { status: RESOLVED|REJECTED|IN_PROGRESS, resolutionNotes?: string }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { anonymizeUserData } from '@/lib/privacy';

const RESOLVABLE_STATUSES = new Set(['IN_PROGRESS', 'RESOLVED', 'REJECTED']);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (user.role !== 'GENERAL_ADMIN') return forbiddenResponse();

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { status, resolutionNotes } = body as {
      status?: string;
      resolutionNotes?: string;
    };

    if (!status || !RESOLVABLE_STATUSES.has(status)) {
      return NextResponse.json(
        {
          error: `status inválido. Válidos: ${[...RESOLVABLE_STATUSES].join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Cargar la solicitud.
    const request = await db.privacyRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, isActive: true },
        },
      },
    });

    if (!request) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada' },
        { status: 404 }
      );
    }

    if (request.status === 'RESOLVED' || request.status === 'REJECTED') {
      return NextResponse.json(
        {
          error: `La solicitud ya está ${request.status} y no puede modificarse`,
        },
        { status: 409 }
      );
    }

    const { ip, ua } = getIpAndUA(req);

    // Si es CANCELLATION + RESOLVED → anonimizar al usuario.
    let anonymizationResult = null;
    if (
      request.type === 'CANCELLATION' &&
      status === 'RESOLVED' &&
      request.user.isActive
    ) {
      anonymizationResult = await anonymizeUserData(
        request.userId,
        `ARCO CANCELLATION_REQUEST_${request.id} — resuelta por ${user.email}`
      );
      if (anonymizationResult.errors.length > 0) {
        return NextResponse.json(
          {
            error: 'Error durante la anonimización',
            details: anonymizationResult.errors,
          },
          { status: 500 }
        );
      }
    }

    // Actualizar la solicitud.
    const updated = await db.privacyRequest.update({
      where: { id },
      data: {
        status,
        resolutionNotes: resolutionNotes?.trim() || null,
        resolvedAt: status === 'RESOLVED' || status === 'REJECTED' ? new Date() : null,
        resolvedById: user.id,
      },
    });

    // Audit de la resolución.
    await auditLog({
      userId: user.id,
      action: 'PRIVACY_ARCO_REQUEST_RESOLVED',
      entityType: 'PRIVACY_REQUEST',
      entityId: request.id,
      ipAddress: ip,
      userAgent: ua,
      details: {
        requestId: request.id,
        requestType: request.type,
        requesterId: request.userId,
        requesterEmail: request.user.email,
        newStatus: status,
        resolutionNotes: resolutionNotes?.trim() || null,
        anonymizationPerformed: !!anonymizationResult,
        anonymizationSummary: anonymizationResult
          ? {
              anonymizedUser: anonymizationResult.anonymizedUser,
              anonymizedEmployee: anonymizationResult.anonymizedEmployee,
              anonymizedAttendanceRecords: anonymizationResult.anonymizedAttendanceRecords,
              anonymizedAuditLogs: anonymizationResult.anonymizedAuditLogs,
              deletedVacations: anonymizationResult.deletedVacations,
              deletedWorkSchedules: anonymizationResult.deletedWorkSchedules,
              deletedDynamicQRs: anonymizationResult.deletedDynamicQRs,
            }
          : null,
        legalReference:
          request.type === 'CANCELLATION' && status === 'RESOLVED'
            ? 'LFPDPPP art. 31 (cancelación) resuelta mediante anonimización; LFT art. 804 (conservación 12 meses) satisfecha con registros anonimizados.'
            : `LFPDPPP art. ${
                request.type === 'ACCESS' ? 29 :
                request.type === 'RECTIFICATION' ? 30 :
                request.type === 'OPPOSITION' ? 32 :
                100
              }`,
      },
    });

    return NextResponse.json({
      request: updated,
      anonymization: anonymizationResult
        ? {
            performed: true,
            summary: {
              anonymizedUser: anonymizationResult.anonymizedUser,
              anonymizedEmployee: anonymizationResult.anonymizedEmployee,
              anonymizedAttendanceRecords: anonymizationResult.anonymizedAttendanceRecords,
              anonymizedAuditLogs: anonymizationResult.anonymizedAuditLogs,
              deletedVacations: anonymizationResult.deletedVacations,
              deletedWorkSchedules: anonymizationResult.deletedWorkSchedules,
              deletedDynamicQRs: anonymizationResult.deletedDynamicQRs,
            },
          }
        : { performed: false },
    });
  } catch (error) {
    console.error('PATCH /api/admin/arco/[id]/resolve error:', error?.code || 'UNKNOWN');
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
