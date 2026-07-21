// ============================================================
// /api/users  (Solo GENERAL_ADMIN — middleware-enforced)
//   GET  — Lista de usuarios con role, sucursal y employee info.
//   POST — Crea usuario {email, password, name, role, sucursalId?, employeeNumber?}.
//          Si role=EMPLOYEE y employeeNumber presente, también crea
//          Employee + WorkSchedules L-V 9-18 por defecto.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isGeneralAdmin,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { validateWorkSchedules, type ScheduleInput } from '@/lib/work-schedule';

// Horario por defecto: L-V 9-18 + domingo como descanso semanal (art. 71 LFT).
// Si el front no envía `workSchedules`, se usa este default.
const DEFAULT_SCHEDULES: ScheduleInput[] = [
  { dayOfWeek: 0, startTime: '00:00', endTime: '00:00', toleranceMinutes: 0, isWeeklyRest: true }, // domingo — descanso
  { dayOfWeek: 1, startTime: '09:00', endTime: '18:00', toleranceMinutes: 10, isWeeklyRest: false },
  { dayOfWeek: 2, startTime: '09:00', endTime: '18:00', toleranceMinutes: 10, isWeeklyRest: false },
  { dayOfWeek: 3, startTime: '09:00', endTime: '18:00', toleranceMinutes: 10, isWeeklyRest: false },
  { dayOfWeek: 4, startTime: '09:00', endTime: '18:00', toleranceMinutes: 10, isWeeklyRest: false },
  { dayOfWeek: 5, startTime: '09:00', endTime: '18:00', toleranceMinutes: 10, isWeeklyRest: false },
];

const VALID_ROLES = new Set(['GENERAL_ADMIN', 'SUCURSAL_ADMIN', 'SUPERVISOR', 'EMPLOYEE']);

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isGeneralAdmin(user)) return forbiddenResponse();

    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const isActive = searchParams.get('isActive');

    const where: { role?: 'GENERAL_ADMIN' | 'SUCURSAL_ADMIN' | 'EMPLOYEE'; isActive?: boolean } = {};
    if (role && VALID_ROLES.has(role)) {
      where.role = role as 'GENERAL_ADMIN' | 'SUCURSAL_ADMIN' | 'EMPLOYEE';
    }
    if (isActive === 'true') where.isActive = true;
    if (isActive === 'false') where.isActive = false;

    const users = await db.user.findMany({
      where,
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
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('GET /api/users error:', error);
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
    if (!isGeneralAdmin(user)) return forbiddenResponse();

    const body = await req.json().catch(() => ({}));
    const {
      email,
      password,
      name,
      role,
      sucursalId,
      employeeNumber,
      position,
      department,
      baseSalary,
      hireDate,
      vacationBalanceDays,
      workSchedules,
    } = body as {
      email?: string;
      password?: string;
      name?: string;
      role?: string;
      sucursalId?: string;
      employeeNumber?: string;
      position?: string;
      department?: string;
      baseSalary?: number;
      hireDate?: string;
      vacationBalanceDays?: number;
      workSchedules?: ScheduleInput[];
    };

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: email, password, name, role' },
        { status: 400 }
      );
    }

    if (!VALID_ROLES.has(role)) {
      return NextResponse.json(
        { error: 'Rol inválido. Debe ser GENERAL_ADMIN, SUCURSAL_ADMIN o EMPLOYEE' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // SUCURSAL_ADMIN requiere sucursalId.
    if (role === 'SUCURSAL_ADMIN' && !sucursalId) {
      return NextResponse.json(
        { error: 'sucursalId es requerido para SUCURSAL_ADMIN' },
        { status: 400 }
      );
    }

    // EMPLOYEE con employeeNumber requiere position, department y sucursalId.
    const wantEmployee = role === 'EMPLOYEE' && employeeNumber;
    if (wantEmployee) {
      if (!position || !department || !sucursalId) {
        return NextResponse.json(
          { error: 'Para crear empleado: position, department y sucursalId son requeridos' },
          { status: 400 }
        );
      }
    }

    // Validar horarios del empleado (art. 71 LFT — mínimo 1 día de descanso).
    // Si el front no provee `workSchedules`, se usa DEFAULT_SCHEDULES (ya válido).
    // Si los provee, se validan estrictamente antes de tocar la BD.
    let schedulesToCreate: ScheduleInput[] = DEFAULT_SCHEDULES;
    if (wantEmployee && workSchedules !== undefined) {
      const validationError = validateWorkSchedules(workSchedules);
      if (validationError) {
        return NextResponse.json(
          { error: validationError },
          { status: 400 }
        );
      }
      schedulesToCreate = workSchedules as ScheduleInput[];
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

    // Unicidad de employeeNumber si se provee.
    if (employeeNumber) {
      const existingEmp = await db.employee.findUnique({
        where: { employeeNumber },
        select: { id: true },
      });
      if (existingEmp) {
        return NextResponse.json(
          { error: 'El número de empleado ya existe' },
          { status: 409 }
        );
      }
    }

    // Validar que la sucursal existe (si se provee).
    if (sucursalId) {
      const suc = await db.sucursal.findUnique({
        where: { id: sucursalId },
        select: { id: true, isActive: true },
      });
      if (!suc || !suc.isActive) {
        return NextResponse.json(
          { error: 'Sucursal inválida o inactiva' },
          { status: 400 }
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Transacción: User + Employee + WorkSchedules.
    const created = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: name.trim(),
          role: role as 'GENERAL_ADMIN' | 'SUCURSAL_ADMIN' | 'EMPLOYEE',
          sucursalId: sucursalId ?? null,
          isActive: true,
        },
        select: { id: true },
      });

      let newEmployee: { id: string; employeeNumber: string } | null = null;
      if (wantEmployee) {
        newEmployee = await tx.employee.create({
          data: {
            employeeNumber: employeeNumber!,
            position: position!,
            department: department!,
            sucursalId: sucursalId!,
            userId: newUser.id,
            hireDate: hireDate ? new Date(hireDate) : new Date(),
            baseSalary: baseSalary ?? null,
            vacationBalanceDays: vacationBalanceDays ?? 12,
            isActive: true,
          },
          select: { id: true, employeeNumber: true },
        });

        await tx.workSchedule.createMany({
          data: schedulesToCreate.map((s) => ({
            employeeId: newEmployee!.id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            toleranceMinutes: s.toleranceMinutes ?? 0,
            isWeeklyRest: s.isWeeklyRest ?? false,
          })),
        });
      }

      return { newUser, newEmployee };
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'CREATE_USER',
      entityType: 'USER',
      entityId: created.newUser.id,
      sucursalId: sucursalId ?? null,
      ipAddress: ip,
      userAgent: ua,
      details: {
        email: normalizedEmail,
        name: name.trim(),
        role,
        sucursalId: sucursalId ?? null,
        employeeNumber: employeeNumber ?? null,
        employeeId: created.newEmployee?.id ?? null,
      },
    });

    return NextResponse.json(
      {
        user: {
          id: created.newUser.id,
          email: normalizedEmail,
          name: name.trim(),
          role,
          sucursalId: sucursalId ?? null,
          employeeId: created.newEmployee?.id ?? null,
          employeeNumber: created.newEmployee?.employeeNumber ?? null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/users error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
