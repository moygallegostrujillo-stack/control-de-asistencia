// ============================================================
// GET /api/attendance/history
// ?period=day|week|month&date=YYYY-MM-DD&sucursalId=&employeeId=&status=
// ADMIN: filtra por sucursal (SUCURSAL_ADMIN forzado al propio).
// EMPLOYEE: solo sus propios registros.
// Orden: date desc. Include employee.user.name, employee.sucursal.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  isGeneralAdmin,
} from '@/lib/auth';
import {
  getMexicoNow,
  toISODate,
  buildDateTimeInMexico,
} from '@/lib/timezone';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EARLY_LEAVE';

function periodRange(period: string, dateISO?: string): { gte: Date; lt: Date } {
  const base = dateISO ? buildDateTimeInMexico(dateISO, '00:00') : getMexicoNow().toJSDate();

  const startOfDay = new Date(base);
  startOfDay.setHours(0, 0, 0, 0);

  const gte = startOfDay;
  const lt = new Date(gte);

  if (period === 'day') {
    lt.setDate(lt.getDate() + 1);
  } else if (period === 'week') {
    // Lunes a domingo
    const dow = gte.getDay(); // 0=domingo..6=sábado
    const offsetToMonday = dow === 0 ? -6 : 1 - dow;
    gte.setDate(gte.getDate() + offsetToMonday);
    lt.setTime(gte.getTime());
    lt.setDate(lt.getDate() + 7);
  } else if (period === 'month') {
    gte.setDate(1);
    lt.setMonth(gte.getMonth() + 1);
    lt.setDate(1);
  } else {
    // default día
    lt.setDate(lt.getDate() + 1);
  }

  return { gte, lt };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'week';
    const dateParam = searchParams.get('date') || undefined;
    const querySucursalId = searchParams.get('sucursalId') || undefined;
    const queryEmployeeId = searchParams.get('employeeId') || undefined;
    const statusParam = searchParams.get('status') || undefined;

    const { gte, lt } = periodRange(period, dateParam);

    // Construir filtro
    const where: {
      date: { gte: Date; lt: Date };
      sucursalId?: string;
      employeeId?: string;
      status?: AttendanceStatus;
    } = { date: { gte, lt } };

    // EMPLOYEE solo sus registros
    if (user.role === 'EMPLOYEE') {
      if (!user.employeeId) {
        return NextResponse.json({ records: [] });
      }
      where.employeeId = user.employeeId;
    } else if (queryEmployeeId) {
      where.employeeId = queryEmployeeId;
    }

    // Sucursal
    let effectiveSucursalId: string | undefined;
    if (isGeneralAdmin(user)) {
      effectiveSucursalId = querySucursalId || undefined;
    } else if (user.role === 'SUCURSAL_ADMIN' || user.role === 'SUPERVISOR') {
      effectiveSucursalId = user.sucursalId || undefined;
    }
    if (effectiveSucursalId) {
      where.sucursalId = effectiveSucursalId;
    }

    // Status
    if (
      statusParam &&
      ['PRESENT', 'ABSENT', 'LATE', 'EARLY_LEAVE'].includes(statusParam)
    ) {
      where.status = statusParam as AttendanceStatus;
    }

    const records = await db.attendanceRecord.findMany({
      where,
      include: {
        employee: {
          include: {
            user: { select: { name: true, email: true } },
            sucursal: { select: { id: true, name: true, codigoLocal: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({
      records,
      period,
      from: toISODate(gte),
      to: toISODate(new Date(lt.getTime() - 86400000)),
      sucursalId: effectiveSucursalId || null,
    });
  } catch (error) {
    console.error('Attendance history error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
