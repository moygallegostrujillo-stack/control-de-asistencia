// ============================================================
// POST /api/auth/mfa/verify
// Confirma el enrolamiento MFA verificando un token TOTP de 6 dígitos.
// Si es válido, marca mfaEnabled=true.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { decryptSecret, verifyMfaToken } from '@/lib/auth.config';
import { db } from '@/lib/db';
import { auditLog, getIpAndUA } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    const { token } = (body || {}) as { token?: string };

    if (!token || !/^\d{6}$/.test(token.trim())) {
      return NextResponse.json(
        { error: 'Token debe ser 6 dígitos' },
        { status: 400 }
      );
    }

    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    if (!dbUser?.mfaSecret) {
      return NextResponse.json(
        { error: 'No hay enrolamiento MFA pendiente. Ejecuta /mfa/setup primero.' },
        { status: 400 }
      );
    }

    if (dbUser.mfaEnabled) {
      return NextResponse.json(
        { error: 'MFA ya está habilitado' },
        { status: 400 }
      );
    }

    const secret = decryptSecret(dbUser.mfaSecret);
    const ok = verifyMfaToken(token.trim(), secret);
    if (!ok) {
      return NextResponse.json(
        { error: 'Token inválido. Revisa tu app autenticadora e intenta de nuevo.' },
        { status: 401 }
      );
    }

    // Activar MFA
    await db.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        mfaEnrolledAt: new Date(),
      },
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'MFA_ENABLED',
      entityType: 'User',
      entityId: user.id,
      sucursalId: user.sucursalId || undefined,
      ipAddress: ip || undefined,
      userAgent: ua || undefined,
    }).catch(() => {});

    return NextResponse.json({
      message: 'MFA habilitado correctamente. A partir de ahora tu login requerirá el código TOTP.',
      mfaEnabled: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Error al verificar MFA', detail: msg },
      { status: 500 }
    );
  }
}
