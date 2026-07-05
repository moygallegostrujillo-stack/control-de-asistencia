// ============================================================
// /api/employees
//   GET  — Lista de empleados (fix #8 orderBy user.name asc).
//          SUCURSAL_ADMIN: solo su sucursal (getSucursalFilter).
//          GENERAL_ADMIN: ?sucursalId=&search=&department=&isActive=
//   POST — Crea empleado + user + WorkSchedules.
//          El horario se asigna MANUALMENTE desde el formulario
//          (no hay horario por defecto automático). Requiere ADMIN.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import {
  getAuthUser,
  getSucursalFilter,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
  isGeneralAdmin,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { validateWorkSchedules } from '@/lib/work-schedule';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { searchParams } = new URL(req.url);
    const sucursalId = searchParams.get('sucursalId');
    const search = searchParams.get('search')?.trim();
    const department = searchParams.get('department')?.trim();
    const isActive = searchParams.get('isActive');

    // fix #8 — orderBy user.name asc (nested Prisma ordering).
    //         Filtro de sucursal: SUCURSAL_ADMIN forzado al propio.
    const sucursalFilter = getSucursalFilter(user);

    const where: {
      sucursalId?: string;
      department?: string;
      isActive?: boolean;
      OR?: Array<Record<string, unknown>>;
    } = { ...sucursalFilter };

    // GENERAL_ADMIN puede filtrar por sucursal específica.
    if (isGeneralAdmin(user) && sucursalId) {
      where.sucursalId = sucursalId;
    }

    if (department) where.department = department;
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;

    if (search) {
      where.OR = [
        { employeeNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const employees = await db.employee.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
          },
        },
        sucursal: {
          select: { id: true, name: true, codigoLocal: true },
        },
        workSchedules: true,
      },
      orderBy: { user: { name: 'asc' } }, // fix #8
    });

    return NextResponse.json({ employees });
  } catch (error) {
    console.error('GET /api/employees error:', error);
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
    if (!isAdmin(user)) return forbiddenResponse();

    const body = await req.json().catch(() => ({}));
    const {
      name,
      email,
      password,
      employeeNumber,
      position,
      department,
      sucursalId,
      baseSalary,
      hireDate,
      vacationBalanceDays,
      schedules,
    } = body as {
      name?: string;
      email?: string;
      password?: string;
      employeeNumber?: string;
      position?: string;
      department?: string;
      sucursalId?: string;
      baseSalary?: number;
      hireDate?: string;
      vacationBalanceDays?: number;
      schedules?: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        toleranceMinutes?: number;
        isWeeklyRest?: boolean;
      }>;
    };

    // -----------------------------------------------------
    // Validaciones
    // -----------------------------------------------------
    if (!name || !email || !password || !employeeNumber || !position || !department) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: name, email, password, employeeNumber, position, department' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // SUCURSAL_ADMIN: solo puede crear en su propia sucursal.
    let targetSucursalId = sucursalId;
    if (!isGeneralAdmin(user)) {
      targetSucursalId = user.sucursalId || undefined;
    }
    if (!targetSucursalId) {
      return NextResponse.json(
        { error: 'sucursalId es requerido' },
        { status: 400 }
      );
    }

    // Verificar que la sucursal existe y está activa.
    const sucursal = await db.sucursal.findUnique({
      where: { id: targetSucursalId },
      select: { id: true, isActive: true },
    });
    if (!sucursal || !sucursal.isActive) {
      return NextResponse.json(
        { error: 'Sucursal inválida o inactiva' },
        { status: 400 }
      );
    }

    // Unicidad de email.
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: 'El email ya está registrado' },
        { status: 409 }
      );
    }

    // Unicidad de employeeNumber.
    const existingEmployee = await db.employee.findUnique({
      where: { employeeNumber },
      select: { id: true },
    });
    if (existingEmployee) {
      return NextResponse.json(
        { error: 'El número de empleado ya existe' },
        { status: 409 }
      );
    }

    // -----------------------------------------------------
    // Horario semanal — asignación MANUAL obligatoria.
    // El frontend envía el array `schedules` con los días
    // laborales y de descanso definidos por el admin.
    // Cumple art. 132 XXXIV LFT (registro electrónico) y
    // art. 71 LFT (mínimo 1 descanso semanal).
    // -----------------------------------------------------
    const passwordHash = await bcrypt.hash(password, 12);
    const schedError = validateWorkSchedules(schedules);
    if (schedError) {
      return NextResponse.json({ error: schedError }, { status: 400 });
    }
    const scheds = schedules!;

    const created = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: name.trim(),
          role: 'EMPLOYEE',
          sucursalId: targetSucursalId,
          isActive: true,
        },
        select: { id: true },
      });

      const newEmployee = await tx.employee.create({
        data: {
          employeeNumber,
          position,
          department,
          sucursalId: targetSucursalId!,
          userId: newUser.id,
          hireDate: hireDate ? new Date(hireDate) : new Date(),
          baseSalary: baseSalary ?? null,
          vacationBalanceDays: vacationBalanceDays ?? 12,
          isActive: true,
        },
        select: { id: true, employeeNumber: true },
      });

      await tx.workSchedule.createMany({
        data: scheds.map((s) => ({
          employeeId: newEmployee.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          toleranceMinutes: s.toleranceMinutes ?? 10,
          isWeeklyRest: s.isWeeklyRest ?? false,
        })),
      });
      // Nota: los días "no laborables" simplemente no se insertan
      // (ausencia de fila = no trabaja ese día, no es descanso).

      return { newUser, newEmployee };
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'CREATE_EMPLOYEE',
      entityType: 'EMPLOYEE',
      entityId: created.newEmployee.id,
      sucursalId: targetSucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: {
        employeeNumber,
        name,
        email: normalizedEmail,
        position,
        department,
        sucursalId: targetSucursalId,
        baseSalary: baseSalary ?? null,
      },
    });

    return NextResponse.json(
      {
        employee: {
          id: created.newEmployee.id,
          employeeNumber: created.newEmployee.employeeNumber,
          position,
          department,
          sucursalId: targetSucursalId,
          userId: created.newUser.id,
          name: name.trim(),
          email: normalizedEmail,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/employees error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
