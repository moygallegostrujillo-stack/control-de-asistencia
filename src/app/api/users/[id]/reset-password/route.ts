// ============================================================
// POST /api/users/[id]/reset-password  (Solo GENERAL_ADMIN)
//   Body: { newPassword? }
//   Si no se provee newPassword, genera uno aleatorio (12 chars).
//   Hashea con bcrypt cost 12. Devuelve la contraseña NUEVA una
//   sola vez en la respuesta. Log PASSWORD_RESET audit.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isGeneralAdmin,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';

type Ctx = { params: Promise<{ id: string }> };

function generateRandomPassword(length = 12): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += charset[bytes[i] % charset.length];
  }
  return out;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isGeneralAdmin(user)) return forbiddenResponse();

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { newPassword } = body as { newPassword?: string };

    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    });
    if (!target) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    const password = (newPassword && newPassword.trim().length >= 6)
      ? newPassword.trim()
      : generateRandomPassword(12);

    const passwordHash = await bcrypt.hash(password, 12);

    // Actualizar password y desbloquear cuenta.
    await db.user.update({
      where: { id },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'PASSWORD_RESET',
      entityType: 'USER',
      entityId: id,
      sucursalId: null,
      ipAddress: ip,
      userAgent: ua,
      details: {
        targetEmail: target.email,
        targetName: target.name,
        generated: !newPassword,
      },
    });

    // Devolver la contraseña NUEVA una sola vez.
    return NextResponse.json({
      message: 'Contraseña restablecida correctamente',
      password, // ONLY returned here — not stored in plain text
      generated: !newPassword,
    });
  } catch (error) {
    console.error('POST /api/users/[id]/reset-password error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
