// ============================================================
// PUT /api/users/[id]  (Solo GENERAL_ADMIN — middleware-enforced)
//   Actualiza: name, email, role, sucursalId, isActive.
//   Validación: SUCURSAL_ADMIN requiere sucursalId.
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

const VALID_ROLES = new Set(['GENERAL_ADMIN', 'SUCURSAL_ADMIN', 'EMPLOYEE']);

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isGeneralAdmin(user)) return forbiddenResponse();

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { name, email, role, sucursalId, isActive } = body as {
      name?: string;
      email?: string;
      role?: string;
      sucursalId?: string | null;
      isActive?: boolean;
    };

    const existing = await db.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Validar role.
    let newRole: 'GENERAL_ADMIN' | 'SUCURSAL_ADMIN' | 'EMPLOYEE' | undefined;
    if (role) {
      if (!VALID_ROLES.has(role)) {
        return NextResponse.json(
          { error: 'Rol inválido' },
          { status: 400 }
        );
      }
      newRole = role as 'GENERAL_ADMIN' | 'SUCURSAL_ADMIN' | 'EMPLOYEE';
    }

    // SUCURSAL_ADMIN requiere sucursalId.
    // Si el nuevo rol es SUCURSAL_ADMIN, validar que sucursalId esté presente.
    const effectiveRole = newRole ?? existing.role;
    const effectiveSucursalId = sucursalId !== undefined ? sucursalId : null;
    if (effectiveRole === 'SUCURSAL_ADMIN' && !effectiveSucursalId) {
      return NextResponse.json(
        { error: 'sucursalId es requerido para SUCURSAL_ADMIN' },
        { status: 400 }
      );
    }

    // Unicidad de email si se cambia.
    let normalizedEmail: string | undefined;
    if (email) {
      normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== existing.email) {
        const emailConflict = await db.user.findUnique({
          where: { email: normalizedEmail },
          select: { id: true },
        });
        if (emailConflict && emailConflict.id !== id) {
          return NextResponse.json(
            { error: 'El email ya está registrado' },
            { status: 409 }
          );
        }
      }
    }

    // Validar que la sucursal existe (si se asigna).
    if (effectiveSucursalId) {
      const suc = await db.sucursal.findUnique({
        where: { id: effectiveSucursalId },
        select: { id: true },
      });
      if (!suc) {
        return NextResponse.json(
          { error: 'Sucursal inválida' },
          { status: 400 }
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (name) data.name = name.trim();
    if (normalizedEmail) data.email = normalizedEmail;
    if (newRole) data.role = newRole;
    if (sucursalId !== undefined) data.sucursalId = sucursalId || null;
    if (isActive !== undefined) data.isActive = isActive;

    const updated = await db.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        sucursalId: true,
        isActive: true,
        lastLoginAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
        sucursal: {
          select: { id: true, name: true, codigoLocal: true },
        },
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            position: true,
            department: true,
            isActive: true,
          },
        },
      },
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'UPDATE_USER',
      entityType: 'USER',
      entityId: id,
      sucursalId: updated.sucursalId ?? null,
      ipAddress: ip,
      userAgent: ua,
      details: { changes: body },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('PUT /api/users/[id] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
