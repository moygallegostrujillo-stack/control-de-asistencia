// ============================================================
// /api/audit
//   GET — Lista paginada de logs de auditoría.
//          Requiere ADMIN (SUCURSAL_ADMIN o GENERAL_ADMIN).
//          SUCURSAL_ADMIN: solo logs de su sucursal.
//          GENERAL_ADMIN: todos (o filtrar por ?sucursalId=).
//          Filtros: ?page=&limit=&action=&userId=&startDate=&endDate=&sucursalId=
//          Incluye user { name, email }.
//          Orden: createdAt desc.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
  isGeneralAdmin,
} from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { searchParams } = new URL(req.url);

    // Paginación.
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(
      500,
      Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50)
    );
    const skip = (page - 1) * limit;
    const take = limit;

    // Filtros opcionales.
    const action = searchParams.get('action')?.trim() || null;
    const userId = searchParams.get('userId')?.trim() || null;
    const startDateStr = searchParams.get('startDate')?.trim() || null;
    const endDateStr = searchParams.get('endDate')?.trim() || null;
    const requestedSucursalId = searchParams.get('sucursalId')?.trim() || null;

    // Scoping por sucursal.
    // SUCURSAL_ADMIN: forzado a su sucursal (ignora ?sucursalId=).
    // GENERAL_ADMIN: ?sucursalId= filtra; sin él, ve todo.
    let sucursalIdFilter: string | null;
    if (isGeneralAdmin(user)) {
      sucursalIdFilter = requestedSucursalId || null;
    } else {
      sucursalIdFilter = user.sucursalId || '__NONE__';
    }

    // Construir cláusula `where`.
    const where: {
      action?: string;
      userId?: string;
      sucursalId?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};

    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (sucursalIdFilter) where.sucursalId = sucursalIdFilter;

    if (startDateStr || endDateStr) {
      where.createdAt = {};
      if (startDateStr) {
        const start = new Date(startDateStr);
        if (!isNaN(start.getTime())) {
          // Incluir desde el inicio del día.
          start.setHours(0, 0, 0, 0);
          where.createdAt.gte = start;
        }
      }
      if (endDateStr) {
        const end = new Date(endDateStr);
        if (!isNaN(end.getTime())) {
          // Incluir hasta el final del día.
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      db.auditLog.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('GET /api/audit error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
