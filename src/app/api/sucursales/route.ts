// ============================================================
// /api/sucursales
//   GET  — GENERAL_ADMIN: todas; SUCURSAL_ADMIN: solo la suya.
//          Incluye employeeCount. Incluye codigoLocal (fix #9).
//   POST — Solo GENERAL_ADMIN (middleware-enforced). Crea con
//          todos los campos: codigoLocal (fix #9),
//          checkoutToleranceMinutes (fix #2), geofence, tolerancias.
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

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    // GENERAL_ADMIN: todas; SUCURSAL_ADMIN: solo la suya.
    const where = isGeneralAdmin(user) ? {} : { id: user.sucursalId || '__NONE__' };

    const sucursales = await db.sucursal.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            employees: { where: { isActive: true } },
          },
        },
      },
    });

    // fix #9 — incluir codigoLocal en el payload.
    const result = sucursales.map((s) => ({
      id: s.id,
      name: s.name,
      codigoLocal: s.codigoLocal,
      address: s.address,
      latitude: s.latitude,
      longitude: s.longitude,
      geofenceRadiusMeters: s.geofenceRadiusMeters,
      enforceGeofence: s.enforceGeofence,
      mealToleranceMinutes: s.mealToleranceMinutes,
      restToleranceMinutes: s.restToleranceMinutes,
      mealDurationMinutes: s.mealDurationMinutes,
      restDurationMinutes: s.restDurationMinutes,
      checkoutToleranceMinutes: s.checkoutToleranceMinutes,
      isActive: s.isActive,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      employeeCount: s._count.employees,
    }));

    return NextResponse.json({ sucursales: result });
  } catch (error) {
    console.error('GET /api/sucursales error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isGeneralAdmin(user)) return forbiddenResponse(); // middleware-enforced

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
      codigoLocal?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      geofenceRadiusMeters?: number;
      enforceGeofence?: boolean;
      mealToleranceMinutes?: number;
      restToleranceMinutes?: number;
      mealDurationMinutes?: number;
      restDurationMinutes?: number;
      checkoutToleranceMinutes?: number;
      isActive?: boolean;
    };

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      );
    }

    // Unicidad de name.
    const existing = await db.sucursal.findUnique({
      where: { name },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe una sucursal con ese nombre' },
        { status: 409 }
      );
    }

    const sucursal = await db.sucursal.create({
      data: {
        name,
        codigoLocal: codigoLocal ?? null,
        address: address ?? '',
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        geofenceRadiusMeters: geofenceRadiusMeters ?? 150,
        enforceGeofence: enforceGeofence ?? false,
        mealToleranceMinutes: mealToleranceMinutes ?? 5,
        restToleranceMinutes: restToleranceMinutes ?? 3,
        mealDurationMinutes: mealDurationMinutes ?? 30,
        restDurationMinutes: restDurationMinutes ?? 15,
        checkoutToleranceMinutes: checkoutToleranceMinutes ?? 10, // fix #2
        isActive: isActive ?? true,
      },
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'CREATE_SUCURSAL',
      entityType: 'SUCURSAL',
      entityId: sucursal.id,
      sucursalId: sucursal.id,
      ipAddress: ip,
      userAgent: ua,
      details: { name, codigoLocal, address },
    });

    return NextResponse.json({ sucursal }, { status: 201 });
  } catch (error) {
    console.error('POST /api/sucursales error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
