// ============================================================
// /api/qr/dynamic
//   GET — Genera un nuevo QR dinámico.
//          Requiere ADMIN (SUCURSAL_ADMIN o GENERAL_ADMIN).
//          Genera token con generateQRToken(), lo persiste en
//          DynamicQR con createdById = user.id y devuelve
//          { code, expiresAt }.
//          Pensado para la vista del terminal QR.
//
//   CLEANUP (26-ago-2026): eliminada la llamada auditLog con action
//   QR_DYNAMIC_GENERATE. Cada generación (cada 60s) escribía una
//   entrada en AuditLog → ~525,600 entradas/año (88% del volumen
//   total de la bitácora). La tabla DynamicQR sigue siendo la fuente
//   funcional de verdad (con expiresAt, used, createdById). El
//   auditLog era 100% redundante y generaba ruido + costo de
//   almacenamiento + queries lentas a futuro. LFPDPPP art. 31
//   (supresión efectiva de datos innecesarios) también aplica.
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

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    // Generar token HMAC.
    const { code, expiresAt } = generateQRToken();

    // Persistir en DynamicQR (fuente de verdad funcional).
    const dynamicQR = await db.dynamicQR.create({
      data: {
        code,
        expiresAt,
        used: false,
        createdById: user.id,
      },
      select: { id: true, code: true, expiresAt: true },
    });

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
