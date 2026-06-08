import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parse, eachDayOfInterval, startOfDay } from 'date-fns';
import { getAuthenticatedUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-helper';
import { getMexicoNow, getMexicoTodayDate, endDateToExclusive } from '@/lib/timezone';

export async function GET(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    if (currentUser.role !== 'ADMIN') return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const sucursal = searchParams.get('sucursal');

    const mexicoNow = getMexicoNow();
    let startDate: Date, endDate: Date;
    
    // Custom date range takes priority over period defaults
    if (startDateParam && endDateParam) {
      startDate = parse(startDateParam, 'yyyy-MM-dd', mexicoNow);
      endDate = parse(endDateParam, 'yyyy-MM-dd', mexicoNow);
    } else if (period === 'week') {
      startDate = startOfWeek(mexicoNow, { weekStartsOn: 1 });
      endDate = endOfWeek(mexicoNow, { weekStartsOn: 1 });
    } else if (period === 'month') {
      startDate = startOfMonth(mexicoNow);
      endDate = endOfMonth(mexicoNow);
    } else {
      startDate = startOfMonth(mexicoNow);
      endDate = endOfMonth(mexicoNow);
    }

    // CRITICAL: Limit endDate to today - don't count future days as absences
    // Use getMexicoTodayDate() for reliable timezone-aware comparison
    const todayStr = getMexicoTodayDate();
    const effectiveEndStr = format(endDate, 'yyyy-MM-dd') > todayStr ? todayStr : format(endDate, 'yyyy-MM-dd');
    const effectiveEndDate = parse(effectiveEndStr, 'yyyy-MM-dd', mexicoNow);

    const employeeWhere: Record<string, unknown> = { user: { isActive: true } };
    if (sucursal) employeeWhere.sucursal = sucursal;

    const employees = await db.employee.findMany({
      where: employeeWhere,
      include: { user: { select: { name: true } }, workSchedules: true }
    });

    const records = await db.attendanceRecord.findMany({
      where: {
        date: {
          gte: format(startDate, 'yyyy-MM-dd'),
          lt: endDateToExclusive(effectiveEndStr)
        }
      }
    });

    // Only consider days up to today (exclude future days)
    // Use string comparison for reliable date capping
    const allDays = eachDayOfInterval({ start: startDate, end: effectiveEndDate })
      .filter(d => d.getDay() !== 0) // Exclude Sundays
      .map(d => format(d, 'yyyy-MM-dd'))
      .filter(d => d <= todayStr); // Only past and present days

    const recordMap = new Map<string, Map<string, typeof records[0]>>();
    for (const record of records) {
      if (!recordMap.has(record.employeeId)) {
        recordMap.set(record.employeeId, new Map());
      }
      recordMap.get(record.employeeId)!.set(String(record.date).slice(0, 10), record);
    }

    const absences = employees.map(employee => {
      const employeeSchedules = employee.workSchedules;
      const employeeRecords = recordMap.get(employee.id) || new Map();
      
      const absentDays: { date: string; dayOfWeek: string }[] = [];
      
      for (const day of allDays) {
        const dayDate = parse(day, 'yyyy-MM-dd', mexicoNow);
        const dow = dayDate.getDay();
        
        const hasSchedule = employeeSchedules.some(s => s.dayOfWeek === dow);
        if (!hasSchedule) continue;
        
        const record = employeeRecords.get(day);
        if (!record || record.status === 'ABSENT') {
          absentDays.push({
            date: day,
            dayOfWeek: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dow]
          });
        }
      }

      return {
        employeeId: employee.id,
        employeeNumber: employee.employeeNumber,
        name: employee.user.name,
        department: employee.department,
        sucursal: employee.sucursal || 'Matriz',
        totalAbsentDays: absentDays.length,
        absentDays
      };
    }).filter(a => a.totalAbsentDays > 0);

    let bySucursal: Record<string, {
      sucursal: string;
      totalEmployees: number;
      totalAbsentDays: number;
      employees: { name: string; totalAbsentDays: number }[];
    }> | undefined;

    if (!sucursal) {
      const sucursalMap = new Map<string, typeof absences>();
      for (const absence of absences) {
        const suc = absence.sucursal;
        if (!sucursalMap.has(suc)) sucursalMap.set(suc, []);
        sucursalMap.get(suc)!.push(absence);
      }

      bySucursal = {};
      for (const [suc, emps] of sucursalMap.entries()) {
        bySucursal[suc] = {
          sucursal: suc,
          totalEmployees: emps.length,
          totalAbsentDays: emps.reduce((sum, e) => sum + e.totalAbsentDays, 0),
          employees: emps.map(e => ({ name: e.name, totalAbsentDays: e.totalAbsentDays })),
        };
      }
    }

    return NextResponse.json({ 
      absences,
      bySucursal,
      period: { start: format(startDate, 'yyyy-MM-dd'), end: effectiveEndStr },
      totalWorkDays: allDays.length
    });
  } catch (error) {
    console.error('Absences report error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
