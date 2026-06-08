import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { getMexicoTodayDate, getMexicoNow, buildTodayDateRange } from '@/lib/timezone';

export async function GET(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    
    const { searchParams } = new URL(request.url);
    const sucursalFilter = searchParams.get('sucursal');
    const todayStr = getMexicoTodayDate();
    const todayRange = buildTodayDateRange();

    if (currentUser.role === 'ADMIN') {
      // Filter by employee's current sucursal using two-step approach:
      // 1. Fetch employee IDs for the given sucursal (more reliable than relation filter)
      // 2. Filter attendance records by those employee IDs
      // This avoids the unreliable Supabase relation filter (employee: { sucursal })
      // Use date range instead of exact match to handle timestamptz columns in Supabase
      const where: Record<string, unknown> = { date: todayRange };

      if (sucursalFilter) {
        const sucursalEmployees = await db.employee.findMany({
          where: { sucursal: sucursalFilter },
          select: { id: true }
        });
        const sucursalEmployeeIds = sucursalEmployees.map((e: { id: string }) => e.id);
        if (sucursalEmployeeIds.length > 0) {
          where.employeeId = { in: sucursalEmployeeIds };
        } else {
          return NextResponse.json({ records: [], absent: [], total: 0, checkedIn: 0, sucursal: sucursalFilter || null });
        }
      }

      const records = await db.attendanceRecord.findMany({
        where,
        include: {
          employee: {
            include: {
              user: { select: { name: true, email: true } },
              workSchedules: true
            }
          }
        },
        orderBy: { checkInTime: 'asc' }
      });

      // Post-fetch safety filter: ensure only records from the correct sucursal
      const filteredRecords = sucursalFilter
        ? records.filter((r: Record<string, unknown>) => {
            const emp = r.employee as Record<string, unknown> | undefined;
            const empSuc = emp?.sucursal as string | undefined;
            return empSuc === sucursalFilter || (!empSuc && sucursalFilter === 'Matriz');
          })
        : records;

      // Get active employees filtered by sucursal
      const employeeWhere: Record<string, unknown> = { user: { isActive: true } };
      if (sucursalFilter) employeeWhere.sucursal = sucursalFilter;

      const activeEmployees = await db.employee.findMany({
        where: employeeWhere,
        include: { user: { select: { name: true } } }
      });

      // Find employees who haven't checked in but should have (absent)
      const checkedInIds = new Set(filteredRecords.map((r: { employeeId: string }) => r.employeeId));
      const absent = activeEmployees.filter((e: { id: string }) => !checkedInIds.has(e.id));

      const enrichedRecords = filteredRecords.map((r: Record<string, unknown>) => ({
        ...r,
        // Always use employee's current sucursal for display
        sucursal: (r.employee as Record<string, unknown>)?.sucursal || 'Matriz',
      }));

      return NextResponse.json({ 
        records: enrichedRecords, 
        absent, 
        total: activeEmployees.length, 
        checkedIn: records.length,
        sucursal: sucursalFilter || null,
      });
    } else {
      const employee = await db.employee.findUnique({
        where: { userId: currentUser.id }
      });

      if (!employee) {
        return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
      }

      // Use findMany with date range instead of findUnique with composite key
      // because Supabase date column may be timestamptz, making exact match unreliable
      const todayRecords = await db.attendanceRecord.findMany({
        where: { employeeId: employee.id, date: todayRange },
        take: 1
      });
      const record = todayRecords[0] || null;

      const mexicoNow = getMexicoNow();
      const schedule = await db.workSchedule.findUnique({
        where: { employeeId_dayOfWeek: { employeeId: employee.id, dayOfWeek: mexicoNow.getDay() } }
      });

      return NextResponse.json({ record, schedule, sucursal: employee.sucursal || 'Matriz' });
    }
  } catch (error) {
    console.error('Today attendance error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
