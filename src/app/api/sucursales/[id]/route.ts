import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/auth';
import { getAuthenticatedUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-helper';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    if (currentUser.role !== 'ADMIN') return forbiddenResponse();

    const { id } = await params;
    const body = await request.json();
    const { name, address, isActive, mealToleranceMinutes, restToleranceMinutes, breakToleranceMinutes } = body;

    const existing = await db.sucursal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (address !== undefined) data.address = address;
    if (isActive !== undefined) data.isActive = isActive;
    if (mealToleranceMinutes !== undefined) data.mealToleranceMinutes = mealToleranceMinutes;
    if (restToleranceMinutes !== undefined) data.restToleranceMinutes = restToleranceMinutes;
    if (breakToleranceMinutes !== undefined) data.breakToleranceMinutes = breakToleranceMinutes;

    // Check name uniqueness if changing name
    if (name && name !== existing.name) {
      const nameConflict = await db.sucursal.findUnique({ where: { name } });
      if (nameConflict) {
        return NextResponse.json({ error: 'Ya existe una sucursal con ese nombre' }, { status: 409 });
      }
    }

    const sucursal = await db.sucursal.update({
      where: { id },
      data,
    });

    await createAuditLog(currentUser.id, 'UPDATE_SUCURSAL', request, 'SUCURSAL', id, {
      changes: body,
    });

    return NextResponse.json({ sucursal });
  } catch (error) {
    console.error('Update sucursal error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    if (currentUser.role !== 'ADMIN') return forbiddenResponse();

    const { id } = await params;

    const existing = await db.sucursal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Sucursal no encontrada' }, { status: 404 });
    }

    await db.sucursal.delete({ where: { id } });

    await createAuditLog(currentUser.id, 'DELETE_SUCURSAL', request, 'SUCURSAL', id, {
      name: existing.name,
    });

    return NextResponse.json({ message: 'Sucursal eliminada correctamente' });
  } catch (error) {
    console.error('Delete sucursal error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
