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

    // Filter by employee's current sucursal using a two-step approach:
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
          summary: { totalEmployees: 0, totalRecords: 0, present: 0, late: 0, absent: 0, earlyLeave: 0, totalWorkedHours: 0, totalOvertimeHours: 0 },
          bySucursal: undefined,
          period: { start: format(startDate, 'yyyy-MM-dd'), end: format(endDate, 'yyyy-MM-dd') }
        });
      }
      // If also filtering by specific employee, intersect
      if (employeeId) {
        if (sucursalEmployeeIds.includes(employeeId)) {
          employeeFilter.employeeId = employeeId;
        } else {
          // Requested employee is not in this sucursal
          return NextResponse.json({
            records: [],
            summary: { totalEmployees: 0, totalRecords: 0, present: 0, late: 0, absent: 0, earlyLeave: 0, totalWorkedHours: 0, totalOvertimeHours: 0 },
            bySucursal: undefined,
            period: { start: format(startDate, 'yyyy-MM-dd'), end: format(endDate, 'yyyy-MM-dd') }
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
            user: { select: { name: true, email: true } },
            workSchedules: true
          }
        }
      },
      orderBy: { date: 'desc' }
    });

    // Post-fetch safety filter: ensure only records from the correct sucursal are included
    // This handles edge cases where the employee's sucursal might not match the filter
    const filteredRecords = sucursal
      ? records.filter((r: Record<string, unknown>) => {
          const emp = r.employee as Record<string, unknown> | undefined;
          const empSuc = emp?.sucursal as string | undefined;
          return empSuc === sucursal || (!empSuc && sucursal === 'Matriz');
        })
      : records;

    const enrichedRecords = filteredRecords.map(record => {
      let workedMinutes = 0;
      let overtimeMinutes = 0;
      let lateMinutes = 0;

      if (record.checkInTime && record.checkOutTime) {
        const checkIn = new Date(record.checkInTime);
        const checkOut = new Date(record.checkOutTime);
        workedMinutes = differenceInMinutes(checkOut, checkIn);
        
        // Calculate overtime based on employee's schedule for that day
        const dayDate = parse(String(record.date).slice(0, 10), 'yyyy-MM-dd', mexicoNow);
        const schedule = record.employee.workSchedules.find(s => s.dayOfWeek === dayDate.getDay());
        const scheduleMinutes = schedule 
          ? (parseInt(schedule.endTime.split(':')[0]) * 60 + parseInt(schedule.endTime.split(':')[1])) 
            - (parseInt(schedule.startTime.split(':')[0]) * 60 + parseInt(schedule.startTime.split(':')[1]))
          : 480;
        overtimeMinutes = Math.max(0, workedMinutes - scheduleMinutes);
      }

      if (record.checkInTime && record.status === 'LATE') {
        const dayDate = parse(String(record.date).slice(0, 10), 'yyyy-MM-dd', mexicoNow);
        const schedule = record.employee.workSchedules.find(s => s.dayOfWeek === dayDate.getDay());
        if (schedule) {
          const [sHour, sMin] = schedule.startTime.split(':').map(Number);
          const scheduleTime = new Date(record.checkInTime);
          scheduleTime.setHours(sHour, sMin, 0, 0);
          lateMinutes = differenceInMinutes(new Date(record.checkInTime), scheduleTime);
        }
      }

      return {
        ...record,
        // Always use employee's current sucursal for display
        sucursal: record.employee.sucursal || 'Matriz',
        workedMinutes,
        workedHours: +(workedMinutes / 60).toFixed(2),
        overtimeMinutes,
        overtimeHours: +(overtimeMinutes / 60).toFixed(2),
        lateMinutes,
      };
    });

    const summary = {
      totalEmployees: new Set(filteredRecords.map(r => r.employeeId)).size,
      totalRecords: filteredRecords.length,
      present: filteredRecords.filter(r => r.status === 'PRESENT').length,
      late: filteredRecords.filter(r => r.status === 'LATE').length,
      absent: filteredRecords.filter(r => r.status === 'ABSENT').length,
      earlyLeave: filteredRecords.filter(r => r.status === 'EARLY_LEAVE').length,
      totalWorkedHours: +(enrichedRecords.reduce((sum, r) => sum + r.workedMinutes, 0) / 60).toFixed(2),
      totalOvertimeHours: +(enrichedRecords.reduce((sum, r) => sum + r.overtimeMinutes, 0) / 60).toFixed(2),
    };

    let bySucursal: Record<string, {
      sucursal: string;
      totalEmployees: number;
      totalRecords: number;
      present: number;
      late: number;
      absent: number;
      earlyLeave: number;
      totalWorkedHours: number;
      totalOvertimeHours: number;
    }> | undefined;

    if (!sucursal) {
      const sucursalMap = new Map<string, typeof enrichedRecords>();
      for (const record of enrichedRecords) {
        const suc = record.sucursal || 'Matriz';
        if (!sucursalMap.has(suc)) sucursalMap.set(suc, []);
        sucursalMap.get(suc)!.push(record);
      }

      bySucursal = {};
      for (const [suc, recs] of sucursalMap.entries()) {
        bySucursal[suc] = {
          sucursal: suc,
          totalEmployees: new Set(recs.map(r => r.employeeId)).size,
          totalRecords: recs.length,
          present: recs.filter(r => r.status === 'PRESENT').length,
          late: recs.filter(r => r.status === 'LATE').length,
          absent: recs.filter(r => r.status === 'ABSENT').length,
          earlyLeave: recs.filter(r => r.status === 'EARLY_LEAVE').length,
          totalWorkedHours: +(recs.reduce((sum, r) => sum + r.workedMinutes, 0) / 60).toFixed(2),
          totalOvertimeHours: +(recs.reduce((sum, r) => sum + r.overtimeMinutes, 0) / 60).toFixed(2),
        };
      }
    }

    return NextResponse.json({ 
      records: enrichedRecords, 
      summary,
      bySucursal,
      period: { start: format(startDate, 'yyyy-MM-dd'), end: format(endDate, 'yyyy-MM-dd') }
    });
  } catch (error) {
    console.error('Daily report error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
