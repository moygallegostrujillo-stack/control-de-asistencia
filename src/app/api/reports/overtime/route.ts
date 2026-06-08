import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parse, differenceInMinutes } from 'date-fns';
import { getAuthenticatedUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-helper';
import { getMexicoNow, endDateToExclusive } from '@/lib/timezone';

export async function GET(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    if (currentUser.role !== 'ADMIN') return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const employeeId = searchParams.get('employeeId');
    const sucursal = searchParams.get('sucursal');

    // Use Mexico timezone for all date calculations
    const mexicoNow = getMexicoNow();
    let startDate: Date, endDate: Date;
    
    // Custom date range takes priority over period defaults
    if (startDateParam && endDateParam) {
      startDate = parse(startDateParam, 'yyyy-MM-dd', mexicoNow);
      endDate = parse(endDateParam, 'yyyy-MM-dd', mexicoNow);
    } else if (period === 'day') {
      startDate = endDate = mexicoNow;
    } else if (period === 'week') {
      startDate = startOfWeek(mexicoNow, { weekStartsOn: 1 });
      endDate = endOfWeek(mexicoNow, { weekStartsOn: 1 });
    } else if (period === 'month') {
      startDate = startOfMonth(mexicoNow);
      endDate = endOfMonth(mexicoNow);
    } else {
      startDate = startOfWeek(mexicoNow, { weekStartsOn: 1 });
      endDate = endOfWeek(mexicoNow, { weekStartsOn: 1 });
    }

    const dateFilter = {
      date: {
        gte: format(startDate, 'yyyy-MM-dd'),
        lt: endDateToExclusive(format(endDate, 'yyyy-MM-dd'))
      }
    };

    // Filter by employee's current sucursal using two-step approach:
    // 1. Fetch employee IDs for the given sucursal (more reliable than relation filter)
    // 2. Filter attendance records by those employee IDs
    // This avoids the unreliable Supabase relation filter (employee: { sucursal })
    const employeeFilter: Record<string, unknown> = {};

    if (sucursal) {
      const sucursalEmployees = await db.employee.findMany({
        where: { sucursal },
        select: { id: true }
      });
      const sucursalEmployeeIds = sucursalEmployees.map((e: { id: string }) => e.id);
      if (sucursalEmployeeIds.length > 0) {
        employeeFilter.employeeId = { in: sucursalEmployeeIds };
      } else {
        // No employees in this sucursal
        return NextResponse.json({
          records: [],
          summary: { totalRecords: 0, totalWorkedHours: 0, totalOvertimeHours: 0, period: { start: format(startDate, 'yyyy-MM-dd'), end: format(endDate, 'yyyy-MM-dd') } },
          bySucursal: undefined
        });
      }
      // If also filtering by specific employee, intersect
      if (employeeId) {
        if (sucursalEmployeeIds.includes(employeeId)) {
          employeeFilter.employeeId = employeeId;
        } else {
          return NextResponse.json({
            records: [],
            summary: { totalRecords: 0, totalWorkedHours: 0, totalOvertimeHours: 0, period: { start: format(startDate, 'yyyy-MM-dd'), end: format(endDate, 'yyyy-MM-dd') } },
            bySucursal: undefined
          });
        }
      }
    } else if (employeeId) {
      employeeFilter.employeeId = employeeId;
    }

    const records = await db.attendanceRecord.findMany({
      where: { ...dateFilter, ...employeeFilter },
      include: {
        employee: {
          include: {
            user: { select: { name: true } },
            workSchedules: true
          }
        }
      },
      orderBy: { date: 'desc' }
    });

    // Post-fetch safety filter: ensure only records from the correct sucursal are included
    const filteredRecords = sucursal
      ? records.filter((r: Record<string, unknown>) => {
          const emp = r.employee as Record<string, unknown> | undefined;
          const empSuc = emp?.sucursal as string | undefined;
          return empSuc === sucursal || (!empSuc && sucursal === 'Matriz');
        })
      : records;

    // Calculate overtime for each record using employee's schedule
    // Only include records with BOTH check-in AND check-out (complete overtime)
    const overtimeRecords = filteredRecords
      .filter(record => record.checkInTime && record.checkOutTime)
      .map(record => {
        let overtimeMinutes = 0;
        let regularMinutes = 0;
        let workedMinutes = 0;
        let scheduleMinutes = 480; // default 8 hours

        const checkIn = new Date(record.checkInTime!);
        const checkOut = new Date(record.checkOutTime!);
        workedMinutes = differenceInMinutes(checkOut, checkIn);
        
        // Get the employee's scheduled hours for this day
        const dayDate = parse(String(record.date).slice(0, 10), 'yyyy-MM-dd', mexicoNow);
        const dayOfWeek = dayDate.getDay();
        const schedule = record.employee.workSchedules.find(s => s.dayOfWeek === dayOfWeek);
        if (schedule) {
          const [startH, startM] = schedule.startTime.split(':').map(Number);
          const [endH, endM] = schedule.endTime.split(':').map(Number);
          scheduleMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        }

        regularMinutes = Math.min(workedMinutes, scheduleMinutes);
        overtimeMinutes = Math.max(0, workedMinutes - scheduleMinutes);

        return {
          ...record,
          sucursal: record.employee.sucursal || 'Matriz',
          workedMinutes,
          regularMinutes,
          overtimeMinutes,
          overtimeHours: +(overtimeMinutes / 60).toFixed(2),
          workedHours: +(workedMinutes / 60).toFixed(2),
        };
      });

    // Filter: Only show records that have overtime (overtimeMinutes > 0)
    // This ensures we only show personnel WITH overtime, not all personnel
    const withOvertime = overtimeRecords.filter(r => r.overtimeMinutes > 0);

    const totalOvertimeHours = +(withOvertime.reduce((sum, r) => sum + r.overtimeMinutes, 0) / 60).toFixed(2);
    const totalWorkedHours = +(withOvertime.reduce((sum, r) => sum + r.workedMinutes, 0) / 60).toFixed(2);

    // BySucursal breakdown (from overtime-only records)
    let bySucursal: Record<string, {
      sucursal: string;
      totalRecords: number;
      totalWorkedHours: number;
      totalOvertimeHours: number;
    }> | undefined;

    if (!sucursal) {
      const sucursalMap = new Map<string, typeof withOvertime>();
      for (const record of withOvertime) {
        const suc = record.sucursal as string || 'Matriz';
        if (!sucursalMap.has(suc)) sucursalMap.set(suc, []);
        sucursalMap.get(suc)!.push(record);
      }

      bySucursal = {};
      for (const [suc, recs] of sucursalMap.entries()) {
        bySucursal[suc] = {
          sucursal: suc,
          totalRecords: recs.length,
          totalWorkedHours: +(recs.reduce((sum, r) => sum + r.workedMinutes, 0) / 60).toFixed(2),
          totalOvertimeHours: +(recs.reduce((sum, r) => sum + r.overtimeMinutes, 0) / 60).toFixed(2),
        };
      }
    }

    return NextResponse.json({ 
      records: withOvertime, 
      summary: {
        totalRecords: withOvertime.length,
        totalWorkedHours,
        totalOvertimeHours,
        period: { start: format(startDate, 'yyyy-MM-dd'), end: format(endDate, 'yyyy-MM-dd') }
      },
      bySucursal
    });
  } catch (error) {
    console.error('Overtime report error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
