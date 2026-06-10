import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Get all active users with their employee info
    const users = await db.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        employee: {
          select: {
            id: true,
            department: true,
            sucursal: true,
            position: true,
          }
        }
      },
      orderBy: [
        { role: 'desc' }, // ADMIN first
        { name: 'asc' }
      ]
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Users list error:', error);
    return NextResponse.json({ error: 'Error al obtener usuarios' }, { status: 500 });
  }
}
