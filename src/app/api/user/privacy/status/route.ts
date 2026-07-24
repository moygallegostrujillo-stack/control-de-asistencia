// ============================================================
// GET /api/user/privacy/status
//   Retorna el estado de consentimiento del usuario autenticado.
//   Útil para que el front decida si mostrar el modal de aceptación.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { db } from '@/lib/db';
import { CURRENT_PRIVACY_VERSION, hasAcceptedCurrentPrivacy } from '@/lib/privacy';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        privacyAcceptedAt: true,
        privacyAcceptedVersion: true,
        privacyAcceptedIp: true,
      },
    });

    if (!dbUser) return unauthorizedResponse();

    return NextResponse.json({
      hasAccepted: hasAcceptedCurrentPrivacy(dbUser),
      currentVersion: CURRENT_PRIVACY_VERSION,
      acceptedVersion: dbUser.privacyAcceptedVersion,
      acceptedAt: dbUser.privacyAcceptedAt?.toISOString() || null,
      needsReaccept:
        !!dbUser.privacyAcceptedAt &&
        dbUser.privacyAcceptedVersion !== CURRENT_PRIVACY_VERSION,
    });
  } catch (error) {
    console.error('GET /api/user/privacy/status error:', error?.code || 'UNKNOWN');
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
