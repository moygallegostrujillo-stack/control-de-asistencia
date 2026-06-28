// ============================================================
// /api/qr/dynamic
//   GET — Genera un nuevo QR dinámico.
//          Requiere ADMIN (SUCURSAL_ADMIN o GENERAL_ADMIN).
//          Genera token con generateQRToken(), lo persiste en
//          DynamicQR con createdById = user.id y devuelve
//          { code, expiresAt }.
//          Pensado para la vista del terminal QR.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
} from '@/lib/auth';
import { generateQRToken } from '@/lib/qr';
import { auditLog, getIpAndUA } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    // Generar token HMAC.
    const { code, expiresAt } = generateQRToken();

    // Persistir en DynamicQR.
    const dynamicQR = await db.dynamicQR.create({
      data: {
        code,
        expiresAt,
        used: false,
        createdById: user.id,
      },
      select: { id: true, code: true, expiresAt: true },
    });

    // Auditoría (sin bloquear la respuesta si falla).
    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'QR_DYNAMIC_GENERATE',
      entityType: 'DYNAMIC_QR',
      entityId: dynamicQR.id,
      sucursalId: user.sucursalId || null,
      ipAddress: ip,
      userAgent: ua,
      details: { expiresAt: expiresAt.toISOString() },
    }).catch((e) => console.error('auditLog error:', e));

    return NextResponse.json({
      code: dynamicQR.code,
      expiresAt: dynamicQR.expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('GET /api/qr/dynamic error:', error);
    return NextResponse.json(
      { error: 'Error al generar código QR dinámico' },
      { status: 500 }
    );
  }
}
