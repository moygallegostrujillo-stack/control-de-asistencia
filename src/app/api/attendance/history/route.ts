import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parse } from 'date-fns';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { getMexicoTodayDate, getMexicoNow, buildTodayDateRange, endDateToExclusive } from '@/lib/timezone';

export async function GET(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const employeeId = searchParams.get('employeeId');
    const sucursal = searchParams.get('sucursal');

    // Use Mexico timezone for all date calculations
    const mexicoNow = getMexicoNow();
    const todayStr = getMexicoTodayDate();
    let dateFilter: Record<string, unknown> = {};

    if (startDateParam && endDateParam) {
      // Use gte/lt instead of gte/lte to handle timestamptz date columns
      dateFilter = { date: { gte: startDateParam, lt: endDateToExclusive(endDateParam) } };
    } else if (period === 'day') {
      dateFilter = { date: buildTodayDateRange() };
    } else if (period === 'week') {
      const start = format(startOfWeek(mexicoNow, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const end = format(endOfWeek(mexicoNow, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      dateFilter = { date: { gte: start, lt: endDateToExclusive(end) } };
    } else if (period === 'month') {
      const start = format(startOfMonth(mexicoNow), 'yyyy-MM-dd');
      const end = format(endOfMonth(mexicoNow), 'yyyy-MM-dd');
      dateFilter = { date: { gte: start, lt: endDateToExclusive(end) } };
    } else if (period === 'custom' && startDateParam && endDateParam) {
      dateFilter = { date: { gte: startDateParam, lt: endDateToExclusive(endDateParam) } };
    }

    const employeeFilter: Record<string, unknown> = {};
    if (currentUser.role === 'EMPLOYEE') {
      const emp = await db.employee.findUnique({ where: { userId: currentUser.id } });
      if (emp) employeeFilter.employeeId = emp.id;
    } else if (employeeId) {
      employeeFilter.employeeId = employeeId;
    }

    // Filter by employee's current sucursal using two-step approach:
    // 1. Fetch employee IDs for the given sucursal (more reliable than relation filter)
    // 2. Filter attendance records by those employee IDs
    // This avoids the unreliable Supabase relation filter (employee: { sucursal })
    if (sucursal) {
      const sucursalEmployees = await db.employee.findMany({
        where: { sucursal },
        select: { id: true }
      });
      const sucursalEmployeeIds = sucursalEmployees.map((e: { id: string }) => e.id);
      if (sucursalEmployeeIds.length > 0) {
        employeeFilter.employeeId = { in: sucursalEmployeeIds };
      } else {
        return NextResponse.json({ records: [] });
      }
      // If also filtering by specific employee, intersect
      if (employeeId) {
        if (sucursalEmployeeIds.includes(employeeId)) {
          employeeFilter.employeeId = employeeId;
        } else {
          return NextResponse.json({ records: [] });
        }
      }
    }

    const records = await db.attendanceRecord.findMany({
      where: { ...dateFilter, ...employeeFilter },
      include: {
        employee: {
          include: { user: { select: { name: true, email: true } }, workSchedules: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    // Post-fetch safety filter: ensure only records from the correct sucursal
    const filteredRecords = sucursal
      ? records.filter((r: Record<string, unknown>) => {
          const emp = r.employee as Record<string, unknown> | undefined;
          const empSuc = emp?.sucursal as string | undefined;
          return empSuc === sucursal || (!empSuc && sucursal === 'Matriz');
        })
      : records;

    // Enrich records with employee's current sucursal for consistent display
    const enrichedRecords = filteredRecords.map((r: Record<string, unknown>) => ({
      ...r,
      sucursal: (r.employee as Record<string, unknown>)?.sucursal || 'Matriz',
    }));

    return NextResponse.json({ records: enrichedRecords });
  } catch (error) {
    console.error('Attendance history error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
