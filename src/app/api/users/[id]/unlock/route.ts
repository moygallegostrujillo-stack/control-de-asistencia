// ============================================================
// POST /api/users/[id]/unlock  (Solo GENERAL_ADMIN)
//   Limpia failedLoginAttempts=0 y lockedUntil=null.
//   Log ACCOUNT_UNLOCK audit.
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

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isGeneralAdmin(user)) return forbiddenResponse();

    const { id } = await params;
    const target = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });
    if (!target) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Si ya está desbloqueado, informar.
    if (target.failedLoginAttempts === 0 && !target.lockedUntil) {
      return NextResponse.json({
        message: 'La cuenta ya está desbloqueada',
        alreadyUnlocked: true,
      });
    }

    await db.user.update({
      where: { id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'ACCOUNT_UNLOCK',
      entityType: 'USER',
      entityId: id,
      sucursalId: null,
      ipAddress: ip,
      userAgent: ua,
      details: {
        targetEmail: target.email,
        targetName: target.name,
        previousFailedAttempts: target.failedLoginAttempts,
        previousLockedUntil: target.lockedUntil?.toISOString() ?? null,
      },
    });

    return NextResponse.json({
      message: 'Cuenta desbloqueada correctamente',
      userId: id,
    });
  } catch (error) {
    console.error('POST /api/users/[id]/unlock error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
