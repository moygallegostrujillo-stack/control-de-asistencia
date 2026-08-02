// ============================================================
// GET /api/attendance/monthly-calendar
// Devuelve la asistencia de un empleado en todo un mes.
//   ?employeeId=X&month=YYYY-MM  (ej: 2026-07)
// ADMIN: puede consultar cualquier empleado de su sucursal
//   (GA ve todos; SUCURSAL_ADMIN solo su sucursal).
// EMPLOYEE: solo puede consultarse a sí mismo (usa su employeeId).
// Respuesta: { employee, month, days: [{ date, status, checkInTime, checkOutTime, ... }] }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  isGeneralAdmin,
} from '@/lib/auth';
import { getMexicoTodayISO } from '@/lib/timezone';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const queryEmployeeId = searchParams.get('employeeId');
    const queryMonth = searchParams.get('month'); // YYYY-MM

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

    // Validar mes (default: mes actual)
    const todayISO = getMexicoTodayISO();
    const defaultMonth = todayISO.slice(0, 7); // YYYY-MM
    const month = queryMonth && /^\d{4}-\d{2}$/.test(queryMonth) ? queryMonth : defaultMonth;

    // Validar formato
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const mon = parseInt(monthStr, 10);
    if (!year || !mon || mon < 1 || mon > 12) {
      return NextResponse.json(
        { error: 'Mes inválido. Usa formato YYYY-MM' },
        { status: 400 }
      );
    }

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

    // Rango de fechas del mes (en UTC+6 para coincidir con getMexicoTodayDate)
    // Día 1 del mes a día último
    const startDate = new Date(Date.UTC(year, mon - 1, 1, 6, 0, 0));
    const endDate = new Date(Date.UTC(year, mon, 0, 6, 0, 0)); // día 0 del mes siguiente = último día del mes actual

    // Cargar registros de asistencia del mes
    const records = await db.attendanceRecord.findMany({
      where: {
        employeeId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    // Cargar vacaciones aprobadas que intersectan el mes
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

    // Cargar feriados del mes
    const holidays = await db.holiday.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      select: { date: true, name: true },
    });

    // Construir mapa de días
    const daysInMonth = new Date(year, mon, 0).getDate();
    const recordMap = new Map<string, any>();
    for (const r of records) {
      const iso = new Date(r.date.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 10);
      recordMap.set(iso, r);
    }

    const holidayMap = new Map<string, string>();
    for (const h of holidays) {
      const iso = new Date(h.date.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 10);
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

    // Construir array de días
    const days: any[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${month}-${String(day).padStart(2, '0')}`;
      const record = recordMap.get(iso);
      const holidayName = holidayMap.get(iso);
      const vacationType = isInVacation(iso);
      const dow = new Date(iso + 'T06:00:00.000Z').getUTCDay(); // 0=domingo
      const isWeekend = dow === 0 || dow === 6;
      const isFuture = iso > todayISO;

      // Determinar el tipo de día para el calendario
      let dayType: 'PRESENT' | 'LATE' | 'ABSENT' | 'EARLY_LEAVE' | 'HOLIDAY' | 'VACATION' | 'WEEKEND' | 'NO_DATA' = 'NO_DATA';
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
        day,
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
    }

    // Stats del mes
    const stats = {
      totalDays: daysInMonth,
      present: days.filter((d) => d.type === 'PRESENT').length,
      late: days.filter((d) => d.type === 'LATE').length,
      absent: days.filter((d) => d.type === 'ABSENT').length,
      earlyLeave: days.filter((d) => d.type === 'EARLY_LEAVE').length,
      holidays: days.filter((d) => d.type === 'HOLIDAY').length,
      vacations: days.filter((d) => d.type === 'VACATION').length,
      weekends: days.filter((d) => d.type === 'WEEKEND').length,
      totalWorkedMinutes: records.reduce((sum, r) => sum + (r.workedMinutes || 0), 0),
      totalOvertimeMinutes: records.reduce((sum, r) => sum + (r.overtimeMinutes || 0), 0),
    };

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error('[monthly-calendar] error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
