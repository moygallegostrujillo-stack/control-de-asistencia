// ============================================================
// GET /api/attendance/history
// ?period=day|week|month|custom&date=YYYY-MM-DD&sucursalId=&employeeId=&status=
//   period=custom requiere además startDate=YYYY-MM-DD y endDate=YYYY-MM-DD.
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
import { parseDateRange } from '@/lib/reports';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EARLY_LEAVE';

function periodRange(
  period: string,
  dateISO?: string,
  customStartISO?: string,
  customEndISO?: string
): { gte: Date; lt: Date } {
  // Modo custom — rango libre validado con el helper compartido.
  // La validación de presencia de startDate/endDate la hace el caller.
  if (period === 'custom') {
    const { range } = parseDateRange(customStartISO, customEndISO);
    if (range) {
      // parseDateRange devuelve range.end como 23:59 hora México del último
      // día. Para mantener compatibilidad con el patrón `lt` exclusivo usado
      // por day/week/month (00:00 del día siguiente), sumamos 1 minuto.
      return { gte: range.start, lt: new Date(range.end.getTime() + 60000) };
    }
    // Fallback si el formato es inválido (el caller ya debería haber
    // regresado 400 antes de llegar aquí).
    const today = buildDateTimeInMexico(toISODate(getMexicoNow().toJSDate()), '00:00');
    return { gte: today, lt: new Date(today.getTime() + 86400000) };
  }

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
    const customStartISO = searchParams.get('startDate') || undefined;
    const customEndISO = searchParams.get('endDate') || undefined;
    const querySucursalId = searchParams.get('sucursalId') || undefined;
    const queryEmployeeId = searchParams.get('employeeId') || undefined;
    const statusParam = searchParams.get('status') || undefined;

    // Validar modo custom: requiere startDate + endDate.
    if (period === 'custom') {
      if (!customStartISO || !customEndISO) {
        return NextResponse.json(
          {
            error:
              'startDate y endDate son requeridos cuando period=custom (formato YYYY-MM-DD)',
          },
          { status: 400 }
        );
      }
      // Validar formato/orden del rango con el helper compartido.
      const { errorResponse } = parseDateRange(customStartISO, customEndISO);
      if (errorResponse) return errorResponse;
    }

    const { gte, lt } = periodRange(period, dateParam, customStartISO, customEndISO);

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
