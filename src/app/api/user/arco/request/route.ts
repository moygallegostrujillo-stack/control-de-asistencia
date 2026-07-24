// ============================================================
// POST /api/user/arco/request
//   Crea una solicitud de Derechos ARCO (LFPDPPP arts. 29-32).
//   Body: { type: ACCESS|RECTIFICATION|CANCELLATION|OPPOSITION, details?: object }
//   Requiere sesión activa. El usuario crea su propia solicitud.
//   Notifica al admin vía AuditLog (acción PRIVACY_ARCO_REQUEST_CREATED).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';

const VALID_TYPES = new Set([
  'ACCESS',
  'RECTIFICATION',
  'CANCELLATION',
  'OPPOSITION',
]);

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    const { type, details } = body as {
      type?: string;
      details?: Record<string, unknown>;
    };

    if (!type || !VALID_TYPES.has(type)) {
      return NextResponse.json(
        {
          error: `Tipo inválido. Válidos: ${[...VALID_TYPES].join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validar que `details` sea serializable (si se provee).
    let requestDetailsJson: string | null = null;
    if (details !== undefined) {
      try {
        requestDetailsJson = JSON.stringify(details);
      } catch {
        return NextResponse.json(
          { error: 'El campo details debe ser un objeto serializable' },
          { status: 400 }
        );
      }
    }

    // Para CANCELLATION: advertir del conflicto LFPDPPP vs LFT.
    // El sistema anonimizará los datos identificativos pero conservará
    // los registros de asistencia por 12 meses (art. 804 LFT).
    const isCancellation = type === 'CANCELLATION';

    const { ip, ua } = getIpAndUA(req);

    const request = await db.privacyRequest.create({
      data: {
        userId: user.id,
        type: type as string,
        status: 'PENDING',
        requestDetails: requestDetailsJson,
      },
    });

    // Notificar al admin — AuditLog visible en panel de auditoría.
    await auditLog({
      userId: user.id,
      action: 'PRIVACY_ARCO_REQUEST_CREATED',
      entityType: 'PRIVACY_REQUEST',
      entityId: request.id,
      ipAddress: ip,
      userAgent: ua,
      details: {
        requestId: request.id,
        type,
        isCancellation,
        details: details || null,
        legalReference: isCancellation
          ? 'LFPDPPP art. 31 (cancelación) — conflicto con LFT art. 804 (conservación 12 meses). Se anonimizará en lugar de suprimir.'
          : `LFPDPPP art. ${
              type === 'ACCESS' ? 29 :
              type === 'RECTIFICATION' ? 30 :
              32 /* OPPOSITION */
            }`,
        notifyAdmin: true, // el front/admin panel puede usar esta flag
      },
    });

    return NextResponse.json(
      {
        request: {
          id: request.id,
          type: request.type,
          status: request.status,
          createdAt: request.createdAt.toISOString(),
        },
        message: isCancellation
          ? 'Solicitud de cancelación recibida. Se anonimizarán sus datos personales identificativos. Los registros de asistencia se conservarán anonimizados por 12 meses (art. 804 LFT).'
          : 'Solicitud ARCO recibida. El administrador la atenderá en un plazo máximo de 20 días hábiles (LFPDPPP art. 100).',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/user/arco/request error:', error?.code || 'UNKNOWN');
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
