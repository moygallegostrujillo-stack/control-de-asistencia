import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-helper';
import { createAuditLog } from '@/lib/auth';

// Sucursales API - CRUD for branch management
export async function GET(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    if (currentUser.role !== 'ADMIN') return forbiddenResponse();

    const sucursales = await db.sucursal.findMany({
      orderBy: { name: 'asc' },
    });

    // Get employee counts per sucursal (use include instead of select+where relation
    // for compatibility with both Prisma and Supabase adapter)
    const employees = await db.employee.findMany({
      include: { user: { select: { isActive: true } } },
    });

    const employeeCounts: Record<string, number> = {};
    for (const emp of employees) {
      const userActive = (emp as { user?: { isActive: boolean } }).user?.isActive !== false;
      if (!userActive) continue;
      const key = emp.sucursal || 'Matriz';
      employeeCounts[key] = (employeeCounts[key] || 0) + 1;
    }

    // Also add "Matriz" as a default if no sucursales exist
    const result = sucursales.map((s: { id: string; name: string; address: string; isActive: boolean; createdAt: Date; updatedAt: Date }) => ({
      ...s,
      employeeCount: employeeCounts[s.name] || 0,
    }));

    return NextResponse.json({ sucursales: result });
  } catch (error) {
    console.error('Get sucursales error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    if (currentUser.role !== 'ADMIN') return forbiddenResponse();

    const body = await request.json();
    const { name, address } = body;

    if (!name) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    // Check if sucursal name already exists
    const existing = await db.sucursal.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: 'Ya existe una sucursal con ese nombre' }, { status: 409 });
    }

    const sucursal = await db.sucursal.create({
      data: {
        name,
        address: address || '',
        isActive: true,
      },
    });

    await createAuditLog(currentUser.id, 'CREATE_SUCURSAL', request, 'SUCURSAL', sucursal.id, {
      name, address,
    });

    return NextResponse.json({ sucursal }, { status: 201 });
  } catch (error) {
    console.error('Create sucursal error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
