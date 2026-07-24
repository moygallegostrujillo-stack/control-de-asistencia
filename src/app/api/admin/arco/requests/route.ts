// ============================================================
// GET /api/admin/arco/requests
//   Lista las solicitudes ARCO pendientes o filtradas por status.
//   Solo GENERAL_ADMIN. Permite al DPO (Data Protection Officer)
//   gestionar las solicitudes dentro del plazo legal de 20 días
//   hábiles (LFPDPPP art. 100).
//
//   Query: ?status=PENDING|IN_PROGRESS|RESOLVED|REJECTED (opcional)
//          ?type=ACCESS|RECTIFICATION|CANCELLATION|OPPOSITION (opcional)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (user.role !== 'GENERAL_ADMIN') return forbiddenResponse();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status')?.trim().toUpperCase();
    const type = searchParams.get('type')?.trim().toUpperCase();

    const where: { status?: string; type?: string } = {};
    if (status && ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'].includes(status)) {
      where.status = status;
    }
    if (type && ['ACCESS', 'RECTIFICATION', 'CANCELLATION', 'OPPOSITION'].includes(type)) {
      where.type = type;
    }

    const requests = await db.privacyRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            sucursalId: true,
          },
        },
        resolvedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Calcular días transcurridos desde la creación (para alertar
    // sobre el plazo legal de 20 días hábiles, LFPDPPP art. 100).
    const now = new Date();
    const enriched = requests.map((r) => {
      const createdMs = r.createdAt.getTime();
      const elapsedDays = Math.floor((now.getTime() - createdMs) / (24 * 60 * 60 * 1000));
      // 20 días hábiles ≈ 28 días naturales (4 fines de semana)
      const legalDeadlineNaturalDays = 28;
      const daysRemaining = Math.max(0, legalDeadlineNaturalDays - elapsedDays);
      const isOverdue =
        r.status === 'PENDING' && elapsedDays > legalDeadlineNaturalDays;
      return {
        ...r,
        elapsedDays,
        daysRemaining,
        isOverdue,
        legalDeadlineNaturalDays,
      };
    });

    // Resumen para el dashboard del DPO.
    const summary = {
      total: enriched.length,
      pending: enriched.filter((r) => r.status === 'PENDING').length,
      inProgress: enriched.filter((r) => r.status === 'IN_PROGRESS').length,
      resolved: enriched.filter((r) => r.status === 'RESOLVED').length,
      rejected: enriched.filter((r) => r.status === 'REJECTED').length,
      overdue: enriched.filter((r) => r.isOverdue).length,
    };

    return NextResponse.json({ requests: enriched, summary });
  } catch (error) {
    console.error('GET /api/admin/arco/requests error:', error?.code || 'UNKNOWN');
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
