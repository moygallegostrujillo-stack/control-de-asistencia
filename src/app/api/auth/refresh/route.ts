// ============================================================
// POST /api/auth/refresh
//   Re-emite el JWT con datos frescos de la BD.
//
//   Es CRÍTICO para el flujo LFPDPPP: si un usuario tenía un JWT
//   viejo con privacyAccepted=false (emitido antes de que el admin
//   aceptara el aviso por él, o antes de que el SQL fix marcara su
//   consentimiento), este endpoint re-emite el JWT con el flag
//   actualizado desde la BD.
//
//   Este endpoint está en PRIVACY_PUBLIC_PATHS, así que puede llamarse
//   SIN consentimiento previo (es justamente para resolver el bloqueo).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, unauthorizedResponse, buildSessionCookies, applySessionCookies } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) return unauthorizedResponse();

    // Re-fetch the user to return fresh data (role/sucursal/privacy may have changed)
    const user = await db.user.findUnique({
      where: { id: authUser.id },
      include: { sucursal: true, employee: true },
    });

    if (!user || !user.isActive) {
      return unauthorizedResponse();
    }

    // Construir el payload completo con datos frescos (incluye privacyAcceptedAt/Version)
    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sucursalId: user.sucursalId,
      employeeId: user.employee?.id ?? null,
      sucursalName: user.sucursal?.name ?? null,
      sucursalCodigoLocal: user.sucursal?.codigoLocal ?? null,
      mfaVerified: !!(user.mfaEnabled && user.mfaSecret),
      privacyAcceptedAt: user.privacyAcceptedAt,
      privacyAcceptedVersion: user.privacyAcceptedVersion,
    };

    // Re-emitir el JWT firmado con los datos actualizados
    const cookiePairs = await buildSessionCookies(payload);
    const res = NextResponse.json({
      ok: true,
      user: {
        id: payload.id,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        sucursalId: payload.sucursalId,
        employeeId: payload.employeeId,
        sucursalName: payload.sucursalName,
        sucursalCodigoLocal: payload.sucursalCodigoLocal,
        mfaVerified: payload.mfaVerified,
        privacyAccepted: !!(user.privacyAcceptedAt && user.privacyAcceptedVersion === '1.0'),
        privacyVersion: user.privacyAcceptedVersion,
      },
    });
    applySessionCookies(res, cookiePairs);
    return res;
  } catch (error) {
    console.error('[auth/refresh] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
