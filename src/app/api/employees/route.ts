import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, createAuditLog } from '@/lib/auth';
import { getAuthenticatedUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-helper';

export async function GET(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    if (currentUser.role !== 'ADMIN') return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const search = searchParams.get('search');
    const sucursal = searchParams.get('sucursal');

    const where: Record<string, unknown> = {};
    if (department) where.department = department;
    if (sucursal) where.sucursal = sucursal;

    if (search) {
      where.OR = [
        { employeeNumber: { contains: search } },
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
      ];
    }

    const employees = await db.employee.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true } },
        workSchedules: true,
      },
      orderBy: { employeeNumber: 'asc' },
    });

    // Filter active employees (post-fetch since Supabase join filter doesn't work reliably)
    const activeEmployees = employees.filter((e: Record<string, unknown>) => (e.user as Record<string, unknown>)?.isActive !== false);

    // Also return the list of available sucursales for the frontend
    const sucursales = await db.sucursal.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ employees: activeEmployees, sucursales });
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    if (currentUser.role !== 'ADMIN') return forbiddenResponse();

    const body = await request.json();
    const { name, email, password, employeeNumber, position, department, sucursal, schedules } = body;

    if (!name || !email || !password || !employeeNumber || !position || !department) {
      return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 });
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 });
    }

    // Check if employee number already exists
    const existingEmployee = await db.employee.findUnique({ where: { employeeNumber } });
    if (existingEmployee) {
      return NextResponse.json({ error: 'El número de empleado ya existe' }, { status: 409 });
    }

    const hashedPassword = await hashPassword(password);

    const employeeData: Record<string, unknown> = {
      employeeNumber,
      position,
      department,
      sucursal: sucursal || 'Matriz',
    };

    const user = await db.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name,
        role: 'EMPLOYEE',
        isActive: true,
        employee: {
          create: employeeData,
        }
      },
      include: { employee: true }
    });

    // Create work schedules if provided
    if (schedules && Array.isArray(schedules)) {
      for (const schedule of schedules) {
        await db.workSchedule.create({
          data: {
            employeeId: user.employee!.id,
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            toleranceMinutes: schedule.toleranceMinutes || 10,
          }
        });
      }
    }

    await createAuditLog(currentUser.id, 'CREATE_EMPLOYEE', request, 'EMPLOYEE', user.employee!.id, {
      employeeNumber, name, email, position, department, sucursal: sucursal || 'Matriz'
    });

    return NextResponse.json({ 
      employee: {
        id: user.employee!.id,
        employeeNumber: user.employee!.employeeNumber,
        position: user.employee!.position,
        department: user.employee!.department,
        sucursal: (user.employee as Record<string, unknown>).sucursal || sucursal || 'Matriz',
        user: { id: user.id, name: user.name, email: user.email, isActive: user.isActive }
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Create employee error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
