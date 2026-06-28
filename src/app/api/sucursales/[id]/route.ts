// ============================================================
// /api/sucursales/[id]
//   PUT    — GENERAL_ADMIN: cualquiera; SUCURSAL_ADMIN: solo la suya.
//             Incluye codigoLocal (fix #9) y checkoutToleranceMinutes (fix #2).
//   DELETE — Solo GENERAL_ADMIN (middleware-enforced). Bloquea si
//             tiene empleados activos asignados.
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
import { auditLog, getIpAndUA } from '@/lib/audit';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { id } = await params;
    const existing = await db.sucursal.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Sucursal no encontrada' },
        { status: 404 }
      );
    }

    // SUCURSAL_ADMIN: solo puede editar su propia sucursal.
    if (!isGeneralAdmin(user) && id !== user.sucursalId) {
      return forbiddenResponse();
    }

    const body = await req.json().catch(() => ({}));
    const {
      name,
      codigoLocal,
      address,
      latitude,
      longitude,
      geofenceRadiusMeters,
      enforceGeofence,
      mealToleranceMinutes,
      restToleranceMinutes,
      mealDurationMinutes,
      restDurationMinutes,
      checkoutToleranceMinutes,
      isActive,
    } = body as {
      name?: string;
      codigoLocal?: string | null;
      address?: string;
      latitude?: number | null;
      longitude?: number | null;
      geofenceRadiusMeters?: number;
      enforceGeofence?: boolean;
      mealToleranceMinutes?: number;
      restToleranceMinutes?: number;
      mealDurationMinutes?: number;
      restDurationMinutes?: number;
      checkoutToleranceMinutes?: number;
      isActive?: boolean;
    };

    // Unicidad de name si se cambia.
    if (name && name !== existing.name) {
      const conflict = await db.sucursal.findUnique({
        where: { name },
        select: { id: true },
      });
      if (conflict && conflict.id !== id) {
        return NextResponse.json(
          { error: 'Ya existe una sucursal con ese nombre' },
          { status: 409 }
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (codigoLocal !== undefined) data.codigoLocal = codigoLocal;
    if (address !== undefined) data.address = address;
    if (latitude !== undefined) data.latitude = latitude;
    if (longitude !== undefined) data.longitude = longitude;
    if (geofenceRadiusMeters !== undefined) data.geofenceRadiusMeters = geofenceRadiusMeters;
    if (enforceGeofence !== undefined) data.enforceGeofence = enforceGeofence;
    if (mealToleranceMinutes !== undefined) data.mealToleranceMinutes = mealToleranceMinutes;
    if (restToleranceMinutes !== undefined) data.restToleranceMinutes = restToleranceMinutes;
    if (mealDurationMinutes !== undefined) data.mealDurationMinutes = mealDurationMinutes;
    if (restDurationMinutes !== undefined) data.restDurationMinutes = restDurationMinutes;
    if (checkoutToleranceMinutes !== undefined) data.checkoutToleranceMinutes = checkoutToleranceMinutes;
    if (isActive !== undefined) data.isActive = isActive;

    const sucursal = await db.sucursal.update({
      where: { id },
      data,
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'UPDATE_SUCURSAL',
      entityType: 'SUCURSAL',
      entityId: id,
      sucursalId: id,
      ipAddress: ip,
      userAgent: ua,
      details: { changes: body },
    });

    return NextResponse.json({ sucursal });
  } catch (error) {
    console.error('PUT /api/sucursales/[id] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isGeneralAdmin(user)) return forbiddenResponse(); // middleware-enforced

    const { id } = await params;
    const existing = await db.sucursal.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Sucursal no encontrada' },
        { status: 404 }
      );
    }

    // Bloquear si tiene empleados activos asignados.
    const activeEmployees = await db.employee.count({
      where: { sucursalId: id, isActive: true },
    });
    if (activeEmployees > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar: la sucursal tiene ${activeEmployees} empleado(s) activo(s)`,
          employeeCount: activeEmployees,
        },
        { status: 409 }
      );
    }

    // Bloquear si tiene admins asignados (moverlos antes).
    const admins = await db.user.count({
      where: { sucursalId: id, isActive: true },
    });
    if (admins > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar: la sucursal tiene ${admins} admin(s) activo(s) asignado(s)`,
          adminCount: admins,
        },
        { status: 409 }
      );
    }

    await db.sucursal.delete({ where: { id } });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'DELETE_SUCURSAL',
      entityType: 'SUCURSAL',
      entityId: id,
      sucursalId: null,
      ipAddress: ip,
      userAgent: ua,
      details: { name: existing.name },
    });

    return NextResponse.json({ message: 'Sucursal eliminada correctamente' });
  } catch (error) {
    console.error('DELETE /api/sucursales/[id] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
