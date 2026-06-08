import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-helper';

export async function GET(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    if (currentUser.role !== 'ADMIN') return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const action = searchParams.get('action');

    const where: Record<string, unknown> = {};
    if (action) where.action = action;

    const logs = await db.auditLog.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.auditLog.count({ where });

    return NextResponse.json({ logs, total });
  } catch (error) {
    console.error('Audit logs error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
