// ============================================================
// POST /api/auth/mfa/disable
// Desactiva MFA para el usuario autenticado.
// Requiere token TOTP válido O backup code (para casos de pérdida
// de dispositivo).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { decryptSecret, verifyMfaToken } from '@/lib/auth.config';
import { db } from '@/lib/db';
import { auditLog, getIpAndUA } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    const { token, backupCode } = (body || {}) as {
      token?: string;
      backupCode?: string;
    };

    if (!token && !backupCode) {
      return NextResponse.json(
        { error: 'Proporciona token TOTP o backupCode' },
        { status: 400 }
      );
    }

    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    if (!dbUser?.mfaEnabled) {
      return NextResponse.json(
        { error: 'MFA no está habilitado' },
        { status: 400 }
      );
    }

    let verified = false;

    // 1. Verificar TOTP
    if (token && dbUser.mfaSecret) {
      const secret = decryptSecret(dbUser.mfaSecret);
      verified = verifyMfaToken(token.trim(), secret);
    }

    // 2. Verificar backup code
    if (!verified && backupCode) {
      const codes: string[] = dbUser.mfaBackupCodesHash
        ? JSON.parse(dbUser.mfaBackupCodesHash)
        : [];
      const normalized = backupCode.trim().toUpperCase();
      for (const hash of codes) {
        if (await bcrypt.compare(normalized, hash)) {
          verified = true;
          // Remover el code usado (reemplazo el array sin ese hash)
          const remaining = codes.filter((h) => h !== hash);
          await db.user.update({
            where: { id: user.id },
            data: { mfaBackupCodesHash: JSON.stringify(remaining) },
          });
          break;
        }
      }
    }

    if (!verified) {
      return NextResponse.json(
        { error: 'Token o backup code inválido' },
        { status: 401 }
      );
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodesHash: null,
        mfaEnrolledAt: null,
      },
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'MFA_DISABLED',
      entityType: 'User',
      entityId: user.id,
      sucursalId: user.sucursalId || undefined,
      ipAddress: ip || undefined,
      userAgent: ua || undefined,
    }).catch(() => {});

    return NextResponse.json({
      message: 'MFA desactivado',
      mfaEnabled: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Error al desactivar MFA', detail: msg },
      { status: 500 }
    );
  }
}
