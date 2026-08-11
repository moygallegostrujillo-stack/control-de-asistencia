// ============================================================
// GET /api/attendance/monthly-calendar
// Devuelve la asistencia de un empleado en un mes o en un rango libre.
//   ?employeeId=X&month=YYYY-MM  (ej: 2026-07)
//   ?employeeId=X&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD  (rango libre)
// ADMIN: puede consultar cualquier empleado de su sucursal
//   (GA ve todos; SUCURSAL_ADMIN solo su sucursal).
// EMPLOYEE: solo puede consultarse a sí mismo (usa su employeeId).
// Respuesta: { employee, month, days: [...], stats, period? }
//   - Si se usó `month`: month="YYYY-MM" y no hay `period`.
//   - Si se usó rango libre: month=null y period={ start, end }.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  isGeneralAdmin,
} from '@/lib/auth';
import { getMexicoTodayISO, MEXICO_TZ } from '@/lib/timezone';
import { DateTime } from 'luxon';
import { parseDateRange } from '@/lib/reports';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const queryEmployeeId = searchParams.get('employeeId');
    const queryMonth = searchParams.get('month'); // YYYY-MM
    const queryStartDate = searchParams.get('startDate');
    const queryEndDate = searchParams.get('endDate');

    // Determinar empleado a consultar
    let employeeId: string | undefined;
    if (user.role === 'EMPLOYEE') {
      employeeId = user.employeeId || undefined;
    } else {
      employeeId = queryEmployeeId || undefined;
    }

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Se requiere employeeId' },
        { status: 400 }
      );
    }

    // ----- Determinar rango de fechas (modo month o modo range) -----
    const todayISO = getMexicoTodayISO();
    let isRangeMode = false;
    let rangeStartISO = '';
    let rangeEndISO = '';
    let month: string | null = '';

    if (queryStartDate && queryEndDate) {
      // Modo rango libre
      isRangeMode = true;
      const { range, errorResponse } = parseDateRange(queryStartDate, queryEndDate);
      if (!range) return errorResponse!;
      rangeStartISO = range.startISO;
      rangeEndISO = range.endISO;
      month = null;
    } else {
      // Modo mes (default: mes actual)
      const defaultMonth = todayISO.slice(0, 7); // YYYY-MM
      const parsedMonth =
        queryMonth && /^\d{4}-\d{2}$/.test(queryMonth) ? queryMonth : defaultMonth;
      const [yearStr, monthStr] = parsedMonth.split('-');
      const year = parseInt(yearStr, 10);
      const mon = parseInt(monthStr, 10);
      if (!year || !mon || mon < 1 || mon > 12) {
        return NextResponse.json(
          { error: 'Mes inválido. Usa formato YYYY-MM' },
          { status: 400 }
        );
      }
      month = parsedMonth;
      // Día 1 del mes a día último (en UTC+6 para coincidir con la convención
      // del resto del sistema: date se almacena como UTC 06:00 = Mexico 00:00).
      const startDate = new Date(Date.UTC(year, mon - 1, 1, 6, 0, 0));
      const endDate = new Date(Date.UTC(year, mon, 0, 6, 0, 0)); // día 0 del mes siguiente = último día del mes actual
      rangeStartISO = new Date(startDate.getTime() + 6 * 3600000)
        .toISOString()
        .slice(0, 10);
      rangeEndISO = new Date(endDate.getTime() + 6 * 3600000)
        .toISOString()
        .slice(0, 10);
    }

    // Construir startDate/endDate como Date UTC (06:00 = Mexico 00:00)
    // para las queries de Prisma (consistencia con el resto del sistema).
    const startDate = new Date(
      Date.UTC(
        parseInt(rangeStartISO.slice(0, 4), 10),
        parseInt(rangeStartISO.slice(5, 7), 10) - 1,
        parseInt(rangeStartISO.slice(8, 10), 10),
        6,
        0,
        0
      )
    );
    const endDate = new Date(
      Date.UTC(
        parseInt(rangeEndISO.slice(0, 4), 10),
        parseInt(rangeEndISO.slice(5, 7), 10) - 1,
        parseInt(rangeEndISO.slice(8, 10), 10),
        6,
        0,
        0
      )
    );

    // Cargar empleado (con sucursal para validación de permisos)
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      include: {
        user: { select: { name: true, email: true } },
        sucursal: { select: { id: true, name: true, codigoLocal: true } },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Validación de permisos: SUCURSAL_ADMIN solo su sucursal
    if (user.role !== 'EMPLOYEE' && !isGeneralAdmin(user)) {
      if (employee.sucursalId !== user.sucursalId) {
        return NextResponse.json(
          { error: 'No tienes permiso para ver este empleado' },
          { status: 403 }
        );
      }
    }

    // Cargar registros de asistencia del rango
    const records = await db.attendanceRecord.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    // Cargar vacaciones aprobadas que intersectan el rango
    const vacations = await db.vacation.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        type: true,
      },
    });

    // Cargar feriados del rango
    const holidays = await db.holiday.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      select: { date: true, name: true },
    });

    // Construir mapa de registros y feriados por ISO
    const recordMap = new Map<string, any>();
    for (const r of records) {
      const iso = new Date(r.date.getTime() + 6 * 3600000)
        .toISOString()
        .slice(0, 10);
      recordMap.set(iso, r);
    }

    const holidayMap = new Map<string, string>();
    for (const h of holidays) {
      const iso = new Date(h.date.getTime() + 6 * 3600000)
        .toISOString()
        .slice(0, 10);
      holidayMap.set(iso, h.name);
    }

    // Función helper: ¿la fecha está dentro de una vacación aprobada?
    const isInVacation = (isoDate: string) => {
      const d = new Date(isoDate + 'T06:00:00.000Z');
      for (const v of vacations) {
        if (d >= v.startDate && d <= v.endDate) return v.type;
      }
      return null;
    };

    // Enumerar días del rango (en Mexico TZ para respetar DST).
    const startLx = DateTime.fromISO(rangeStartISO, { zone: MEXICO_TZ }).startOf('day');
    const endLx = DateTime.fromISO(rangeEndISO, { zone: MEXICO_TZ }).startOf('day');
    const days: any[] = [];
    let cursor = startLx;
    while (cursor <= endLx) {
      const iso = cursor.toFormat('yyyy-MM-dd');
      const record = recordMap.get(iso);
      const holidayName = holidayMap.get(iso);
      const vacationType = isInVacation(iso);
      // luxon weekday: 1=lunes..7=domingo. Convertimos a 0=domingo..6=sábado.
      const dow = cursor.weekday % 7;
      const isWeekend = dow === 0 || dow === 6;
      const isFuture = iso > todayISO;

      // Determinar el tipo de día para el calendario
      let dayType:
        | 'PRESENT'
        | 'LATE'
        | 'ABSENT'
        | 'EARLY_LEAVE'
        | 'HOLIDAY'
        | 'VACATION'
        | 'WEEKEND'
        | 'NO_DATA' = 'NO_DATA';
      if (holidayName) {
        dayType = 'HOLIDAY';
      } else if (vacationType) {
        dayType = 'VACATION';
      } else if (isWeekend) {
        dayType = 'WEEKEND';
      } else if (record) {
        dayType = record.status as any;
      } else if (!isFuture) {
        dayType = 'ABSENT';
      }

      days.push({
        date: iso,
        day: cursor.day,
        dayOfWeek: dow,
        isWeekend,
        isFuture,
        isHoliday: !!holidayName,
        holidayName: holidayName || null,
        vacationType,
        type: dayType,
        checkInTime: record?.checkInTime || null,
        checkOutTime: record?.checkOutTime || null,
        status: record?.status || null,
        workedMinutes: record?.workedMinutes || null,
        overtimeMinutes: record?.overtimeMinutes || null,
        mealExceeded: record?.mealExceeded || false,
        restExceeded: record?.restExceeded || false,
      });

      cursor = cursor.plus({ days: 1 });
    }

    // Stats del rango
    const stats = {
      totalDays: days.length,
      present: days.filter((d) => d.type === 'PRESENT').length,
      late: days.filter((d) => d.type === 'LATE').length,
      absent: days.filter((d) => d.type === 'ABSENT').length,
      earlyLeave: days.filter((d) => d.type === 'EARLY_LEAVE').length,
      holidays: days.filter((d) => d.type === 'HOLIDAY').length,
      vacations: days.filter((d) => d.type === 'VACATION').length,
      weekends: days.filter((d) => d.type === 'WEEKEND').length,
      totalWorkedMinutes: records.reduce(
        (sum, r) => sum + (r.workedMinutes || 0),
        0
      ),
      totalOvertimeMinutes: records.reduce(
        (sum, r) => sum + (r.overtimeMinutes || 0),
        0
      ),
    };

    const response: any = {
      employee: {
        id: employee.id,
        name: employee.user.name,
        email: employee.user.email,
        employeeNumber: employee.employeeNumber,
        position: employee.position,
        department: employee.department,
        sucursal: employee.sucursal,
      },
      month,
      days,
      stats,
    };

    // Si se usó rango libre, agregamos `period` para que la UI sepa
    // qué rango real se evaluó. En modo month, `month` ya basta.
    if (isRangeMode) {
      response.period = { start: rangeStartISO, end: rangeEndISO };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[monthly-calendar] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
