// ============================================================
// /api/holidays/[id]
//   DELETE — Solo GENERAL_ADMIN (middleware-enforced). Elimina
//            un día feriado por id. Log HOLIDAY_DELETE audit.
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

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isGeneralAdmin(user)) return forbiddenResponse(); // middleware-enforced

    const { id } = await params;
    const existing = await db.holiday.findUnique({
      where: { id },
      select: { id: true, date: true, name: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Día feriado no encontrado' },
        { status: 404 }
      );
    }

    await db.holiday.delete({ where: { id } });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'HOLIDAY_DELETE',
      entityType: 'HOLIDAY',
      entityId: id,
      sucursalId: null,
      ipAddress: ip,
      userAgent: ua,
      details: { date: existing.date, name: existing.name },
    });

    return NextResponse.json({
      message: 'Día feriado eliminado correctamente',
    });
  } catch (error) {
    console.error('DELETE /api/holidays/[id] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
