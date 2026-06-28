// ============================================================
// /api/employees/[id]
//   GET    — Detalle del empleado (incluye workSchedules).
//   PUT    — Actualiza campos de Employee + User. SUCURSAL_ADMIN
//            solo puede editar empleados de su sucursal.
//   DELETE — Solo GENERAL_ADMIN (middleware-enforced). Soft-delete:
//            set isActive=false en User y Employee.
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

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { id } = await params;

    const employee = await db.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, isActive: true },
        },
        sucursal: {
          select: { id: true, name: true, codigoLocal: true },
        },
        workSchedules: {
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // SUCURSAL_ADMIN: solo puede ver su sucursal.
    if (!isGeneralAdmin(user) && employee.sucursalId !== user.sucursalId) {
      return forbiddenResponse();
    }

    return NextResponse.json({ employee });
  } catch (error) {
    console.error('GET /api/employees/[id] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const {
      name,
      email,
      position,
      department,
      sucursalId,
      baseSalary,
      hireDate,
      vacationBalanceDays,
      isActive,
      schedules,
    } = body as {
      name?: string;
      email?: string;
      position?: string;
      department?: string;
      sucursalId?: string;
      baseSalary?: number | null;
      hireDate?: string;
      vacationBalanceDays?: number;
      isActive?: boolean;
      schedules?: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        toleranceMinutes?: number;
        isWeeklyRest?: boolean;
      }>;
    };

    const existing = await db.employee.findUnique({
      where: { id },
      select: { id: true, userId: true, sucursalId: true, employeeNumber: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // SUCURSAL_ADMIN: solo puede editar empleados de su sucursal.
    if (!isGeneralAdmin(user) && existing.sucursalId !== user.sucursalId) {
      return forbiddenResponse();
    }

    // SUCURSAL_ADMIN no puede mover empleados a otra sucursal.
    if (!isGeneralAdmin(user) && sucursalId && sucursalId !== existing.sucursalId) {
      return forbiddenResponse();
    }

    // Unicidad de email si se cambia.
    let normalizedEmail: string | undefined;
    if (email) {
      normalizedEmail = email.trim().toLowerCase();
      const emailConflict = await db.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (emailConflict && emailConflict.id !== existing.userId) {
        return NextResponse.json(
          { error: 'El email ya está registrado' },
          { status: 409 }
        );
      }
    }

    // -----------------------------------------------------
    // Transacción: User + Employee + WorkSchedules
    // -----------------------------------------------------
    await db.$transaction(async (tx) => {
      // User
      const userData: Record<string, unknown> = {};
      if (name) userData.name = name.trim();
      if (normalizedEmail) userData.email = normalizedEmail;
      if (isActive !== undefined) userData.isActive = isActive;
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id: existing.userId },
          data: userData,
        });
      }

      // Employee
      const empData: Record<string, unknown> = {};
      if (position) empData.position = position;
      if (department) empData.department = department;
      if (sucursalId && isGeneralAdmin(user)) empData.sucursalId = sucursalId;
      if (baseSalary !== undefined) empData.baseSalary = baseSalary;
      if (hireDate) empData.hireDate = new Date(hireDate);
      if (vacationBalanceDays !== undefined) empData.vacationBalanceDays = vacationBalanceDays;
      if (isActive !== undefined) empData.isActive = isActive;
      if (Object.keys(empData).length > 0) {
        await tx.employee.update({
          where: { id },
          data: empData,
        });
      }

      // WorkSchedules (reemplazo completo si se proveen)
      if (schedules && Array.isArray(schedules)) {
        await tx.workSchedule.deleteMany({ where: { employeeId: id } });
        if (schedules.length > 0) {
          await tx.workSchedule.createMany({
            data: schedules.map((s) => ({
              employeeId: id,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
              toleranceMinutes: s.toleranceMinutes ?? 10,
              isWeeklyRest: s.isWeeklyRest ?? false,
            })),
          });
        }
      }
    });

    const updated = await db.employee.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true } },
        sucursal: { select: { id: true, name: true, codigoLocal: true } },
        workSchedules: { orderBy: { dayOfWeek: 'asc' } },
      },
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'UPDATE_EMPLOYEE',
      entityType: 'EMPLOYEE',
      entityId: id,
      sucursalId: existing.sucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: { changes: body },
    });

    return NextResponse.json({ employee: updated });
  } catch (error) {
    console.error('PUT /api/employees/[id] error:', error);
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
    const existing = await db.employee.findUnique({
      where: { id },
      select: { id: true, userId: true, sucursalId: true, employeeNumber: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Soft-delete: marcar isActive=false en User y Employee.
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.userId },
        data: { isActive: false },
      });
      await tx.employee.update({
        where: { id },
        data: { isActive: false },
      });
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'DEACTIVATE_EMPLOYEE',
      entityType: 'EMPLOYEE',
      entityId: id,
      sucursalId: existing.sucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: { employeeNumber: existing.employeeNumber, softDelete: true },
    });

    return NextResponse.json({
      message: 'Empleado desactivado correctamente',
    });
  } catch (error) {
    console.error('DELETE /api/employees/[id] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
