// ============================================================
// POST /api/user/privacy/accept
//   Registra el consentimiento del Aviso de Privacidad.
//   Body: { version: string }
//   Requiere sesión activa. Registra privacyAcceptedAt, version, IP.
//   LFPDPPP art. 17 — consentimiento informado y expreso.
//
//   IMPORTANTE: Después de actualizar la BD, re-emite el JWT con
//   privacyAccepted=true para que el middleware permita el acceso
//   inmediatamente (sin necesidad de re-login).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, unauthorizedResponse, buildSessionCookies, applySessionCookies } from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { CURRENT_PRIVACY_VERSION } from '@/lib/privacy';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    const { version } = body as { version?: string };

    if (!version) {
      return NextResponse.json(
        { error: 'El campo version es requerido' },
        { status: 400 }
      );
    }

    // Validar que la versión sea la vigente. Si el front envía otra,
    // rechazar para forzar UI a mostrar el aviso actualizado.
    if (version !== CURRENT_PRIVACY_VERSION) {
      return NextResponse.json(
        {
          error: `La versión del aviso (${version}) no coincide con la vigente (${CURRENT_PRIVACY_VERSION}). Vuelve a cargar el aviso.`,
          currentVersion: CURRENT_PRIVACY_VERSION,
        },
        { status: 409 }
      );
    }

    const { ip, ua } = getIpAndUA(req);
    const now = new Date();

    // Cargar el User real desde BD con todas las relaciones para re-emitir el JWT.
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      include: { sucursal: true, employee: true },
    });
    if (!dbUser) return unauthorizedResponse();

    const previousVersion = dbUser.privacyAcceptedVersion;
    const previousAcceptedAt = dbUser.privacyAcceptedAt;

    await db.user.update({
      where: { id: user.id },
      data: {
        privacyAcceptedAt: now,
        privacyAcceptedVersion: CURRENT_PRIVACY_VERSION,
        privacyAcceptedIp: ip,
      },
    });

    // Audit — registro probatorio del consentimiento (LFPDPPP art. 17).
    await auditLog({
      userId: user.id,
      action: 'PRIVACY_CONSENT_ACCEPT',
      entityType: 'USER',
      entityId: user.id,
      ipAddress: ip,
      userAgent: ua,
      details: {
        version: CURRENT_PRIVACY_VERSION,
        previousVersion,
        previousAcceptedAt: previousAcceptedAt?.toISOString() || null,
        acceptedAt: now.toISOString(),
        legalReference: 'LFPDPPP art. 17 (consentimiento informado y expreso)',
      },
    });

    // Re-emitir el JWT con privacyAccepted=true para que el middleware
    // permita el acceso inmediatamente (sin necesidad de re-login).
    const jwtPayload = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      sucursalId: dbUser.sucursalId,
      employeeId: dbUser.employee?.id ?? null,
      sucursalName: dbUser.sucursal?.name ?? null,
      sucursalCodigoLocal: dbUser.sucursal?.codigoLocal ?? null,
      mfaVerified: !!(dbUser.mfaEnabled && dbUser.mfaSecret),
      privacyAcceptedAt: now,
      privacyAcceptedVersion: CURRENT_PRIVACY_VERSION,
    };
    const cookiePairs = await buildSessionCookies(jwtPayload);
    const res = NextResponse.json({
      ok: true,
      acceptedAt: now.toISOString(),
      version: CURRENT_PRIVACY_VERSION,
    });
    applySessionCookies(res, cookiePairs);
    return res;
  } catch (error) {
    console.error('POST /api/user/privacy/accept error:', error?.code || 'UNKNOWN');
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
