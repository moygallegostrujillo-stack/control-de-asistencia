import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/auth';
import { getAuthenticatedUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-helper';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();

    const { id } = await params;
    const employee = await db.employee.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true } },
        workSchedules: true,
      }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ employee });
  } catch (error) {
    console.error('Get employee error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    if (currentUser.role !== 'ADMIN') return forbiddenResponse();

    const { id } = await params;
    const body = await request.json();
    const { name, email, position, department, sucursal, isActive, schedules } = body;

    const existingEmployee = await db.employee.findUnique({ where: { id } });
    if (!existingEmployee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Update user info
    if (name || email || isActive !== undefined) {
      const userData: Record<string, unknown> = {};
      if (name) userData.name = name;
      if (email) userData.email = email;
      if (isActive !== undefined) userData.isActive = isActive;
      
      await db.user.update({
        where: { id: existingEmployee.userId },
        data: userData
      });
    }

    // Update employee info
    const employeeData: Record<string, unknown> = {};
    if (position) employeeData.position = position;
    if (department) employeeData.department = department;
    
    if (sucursal !== undefined) employeeData.sucursal = sucursal;

    if (Object.keys(employeeData).length > 0) {
      await db.employee.update({
        where: { id },
        data: employeeData
      });
    }

    // Update work schedules if provided
    if (schedules && Array.isArray(schedules)) {
      // Delete existing schedules
      await db.workSchedule.deleteMany({ where: { employeeId: id } });
      // Create new schedules
      for (const schedule of schedules) {
        await db.workSchedule.create({
          data: {
            employeeId: id,
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            toleranceMinutes: schedule.toleranceMinutes || 10,
          }
        });
      }
    }

    const updatedEmployee = await db.employee.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true } },
        workSchedules: true,
      }
    });

    await createAuditLog(currentUser.id, 'UPDATE_EMPLOYEE', request, 'EMPLOYEE', id, {
      changes: body
    });

    return NextResponse.json({ employee: updatedEmployee });
  } catch (error) {
    console.error('Update employee error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    if (currentUser.role !== 'ADMIN') return forbiddenResponse();

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';
    
    const employee = await db.employee.findUnique({ where: { id } });
    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    if (hardDelete) {
      // Hard delete - cascade delete all related records
      // 1. Delete work schedules
      await db.workSchedule.deleteMany({ where: { employeeId: id } });
      // 2. Delete attendance records
      await db.attendanceRecord.deleteMany({ where: { employeeId: id } });
      // 3. Delete employee record
      await db.employee.delete({ where: { id } });
      // 4. Delete user record
      await db.user.delete({ where: { id: employee.userId } });

      await createAuditLog(currentUser.id, 'DELETE_EMPLOYEE', request, 'EMPLOYEE', id, {
        employeeNumber: employee.employeeNumber,
        hardDelete: true
      });

      return NextResponse.json({ message: 'Empleado eliminado permanentemente' });
    } else {
      // Soft delete - deactivate user
      await db.user.update({
        where: { id: employee.userId },
        data: { isActive: false }
      });

      await createAuditLog(currentUser.id, 'DEACTIVATE_EMPLOYEE', request, 'EMPLOYEE', id);

      return NextResponse.json({ message: 'Empleado desactivado correctamente' });
    }
  } catch (error) {
    console.error('Delete employee error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
