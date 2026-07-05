// ============================================================
// POST /api/auth/mfa/setup
// Inicia enrolamiento MFA TOTP para el usuario autenticado.
// Genera secreto, lo guarda encriptado (pendiente de verificación),
// y retorna otpauth_uri + backup codes.
// El usuario debe escanear el QR con Google Authenticator/Authy,
// ingresar un código de 6 dígitos para confirmar en /mfa/verify.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import {
  generateMfaSecret,
  encryptSecret,
  buildOtpauthUri,
  generateBackupCodes,
} from '@/lib/auth.config';
import { db } from '@/lib/db';
import QRCode from 'qrcode';
import { auditLog, getIpAndUA } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    // Solo admins pueden habilitar MFA (empleados no, por ahora)
    if (user.role === 'EMPLOYEE') {
      return NextResponse.json(
        { error: 'MFA solo disponible para administradores' },
        { status: 403 }
      );
    }

    // Si ya está habilitado, no permitir re-enrolar sin disable primero
    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    if (dbUser?.mfaEnabled) {
      return NextResponse.json(
        { error: 'MFA ya está habilitado. Desactívalo primero.' },
        { status: 400 }
      );
    }

    // Generar secreto y backup codes
    const secret = generateMfaSecret();
    const encryptedSecret = encryptSecret(secret);
    const { plain: backupCodesPlain, hashed: backupCodesHashed } = generateBackupCodes();

    // Guardar en DB (mfaEnabled=false hasta que se verifique)
    await db.user.update({
      where: { id: user.id },
      data: {
        mfaSecret: encryptedSecret,
        mfaBackupCodesHash: JSON.stringify(backupCodesHashed),
        mfaEnabled: false,
        mfaEnrolledAt: null,
      },
    });

    // Generar QR code como data URL
    const uri = buildOtpauthUri(user.email, secret);
    const qrDataUrl = await QRCode.toDataURL(uri, {
      width: 240,
      margin: 2,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'MFA_SETUP_INITIATED',
      entityType: 'User',
      entityId: user.id,
      sucursalId: user.sucursalId || undefined,
      ipAddress: ip || undefined,
      userAgent: ua || undefined,
    }).catch(() => {});

    return NextResponse.json({
      message: 'Escanea el QR con tu app autenticadora (Google Authenticator, Authy, 1Password)',
      qrDataUrl,
      secret, // mostrado en texto para input manual si el QR no se puede escanear
      backupCodes: backupCodesPlain, // se muestran UNA sola vez
      nextStep: 'POST /api/auth/mfa/verify con { token: "123456" }',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Error al iniciar MFA', detail: msg },
      { status: 500 }
    );
  }
}
