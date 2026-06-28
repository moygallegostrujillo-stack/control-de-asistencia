// ============================================================
// POST /api/employees/[id]/transfer
//   Solo GENERAL_ADMIN (middleware-enforced).
//   Body: { newSucursalId }
//   Transfiere el empleado a otra sucursal: actualiza
//   Employee.sucursalId y User.sucursalId. Log TRANSFER audit.
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

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isGeneralAdmin(user)) return forbiddenResponse();

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { newSucursalId } = body as { newSucursalId?: string };

    if (!newSucursalId) {
      return NextResponse.json(
        { error: 'newSucursalId es requerido' },
        { status: 400 }
      );
    }

    const employee = await db.employee.findUnique({
      where: { id },
      select: { id: true, userId: true, sucursalId: true, employeeNumber: true },
    });
    if (!employee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    if (employee.sucursalId === newSucursalId) {
      return NextResponse.json(
        { error: 'El empleado ya pertenece a esa sucursal' },
        { status: 400 }
      );
    }

    const newSucursal = await db.sucursal.findUnique({
      where: { id: newSucursalId },
      select: { id: true, name: true, isActive: true },
    });
    if (!newSucursal || !newSucursal.isActive) {
      return NextResponse.json(
        { error: 'Sucursal destino inválida o inactiva' },
        { status: 400 }
      );
    }

    const oldSucursal = await db.sucursal.findUnique({
      where: { id: employee.sucursalId },
      select: { id: true, name: true },
    });

    // Actualizar Employee.sucursalId y User.sucursalId
    await db.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: { sucursalId: newSucursalId },
      });
      await tx.user.update({
        where: { id: employee.userId },
        data: { sucursalId: newSucursalId },
      });
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'TRANSFER',
      entityType: 'EMPLOYEE',
      entityId: id,
      sucursalId: newSucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: {
        employeeNumber: employee.employeeNumber,
        fromSucursalId: employee.sucursalId,
        fromSucursalName: oldSucursal?.name ?? null,
        toSucursalId: newSucursalId,
        toSucursalName: newSucursal.name,
      },
    });

    return NextResponse.json({
      message: 'Empleado transferido correctamente',
      employeeId: id,
      fromSucursalId: employee.sucursalId,
      toSucursalId: newSucursalId,
    });
  } catch (error) {
    console.error('POST /api/employees/[id]/transfer error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
