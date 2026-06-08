import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/auth';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parse, differenceInMinutes, eachDayOfInterval } from 'date-fns';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { getMexicoNow, getMexicoTodayDate, endDateToExclusive } from '@/lib/timezone';

export async function GET(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    
    const { searchParams } = new URL(request.url);
    const format_type = searchParams.get('format') || 'csv';
    const period = searchParams.get('period') || 'month';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const employeeId = searchParams.get('employeeId');
    const sucursal = searchParams.get('sucursal');
    const reportType = searchParams.get('reportType') || 'daily';

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
      startDate = startOfMonth(mexicoNow);
      endDate = endOfMonth(mexicoNow);
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
        if (format_type === 'csv') {
          return NextResponse.json({ error: 'No hay datos para exportar' }, { status: 404 });
        }
        return NextResponse.json({ data: [], filename: `reporte_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}` });
      }
      if (employeeId) {
        if (sucursalEmployeeIds.includes(employeeId)) {
          employeeFilter.employeeId = employeeId;
        } else {
          if (format_type === 'csv') {
            return NextResponse.json({ error: 'No hay datos para exportar' }, { status: 404 });
          }
          return NextResponse.json({ data: [], filename: `reporte_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}` });
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
      orderBy: { date: 'asc' }
    });

    // Post-fetch safety filter: ensure only records from the correct sucursal are included
    const filteredRecords = sucursal
      ? records.filter((r: Record<string, unknown>) => {
          const emp = r.employee as Record<string, unknown> | undefined;
          const empSuc = emp?.sucursal as string | undefined;
          return empSuc === sucursal || (!empSuc && sucursal === 'Matriz');
        })
      : records;

    // Build export data based on report type
    let exportData: Record<string, unknown>[];

    if (reportType === 'overtime') {
      // Overtime report: only records with complete check-in AND check-out AND overtime > 0
      const overtimeRecords = filteredRecords
        .filter(record => record.checkInTime && record.checkOutTime)
        .map(record => {
          let workedHours = 0;
          let overtimeHours = 0;
          let scheduleMinutes = 480;

          const workedMinutes = differenceInMinutes(new Date(record.checkOutTime!), new Date(record.checkInTime!));
          workedHours = +(workedMinutes / 60).toFixed(2);
          
          // Use schedule-based overtime
          try {
            const dayDate = parse(String(record.date).slice(0, 10), 'yyyy-MM-dd', mexicoNow);
            const schedule = record.employee.workSchedules.find(s => s.dayOfWeek === dayDate.getDay());
            if (schedule) {
              const [startH, startM] = schedule.startTime.split(':').map(Number);
              const [endH, endM] = schedule.endTime.split(':').map(Number);
              scheduleMinutes = (endH * 60 + endM) - (startH * 60 + startM);
            }
          } catch { /* use default 480 */ }
          
          overtimeHours = +Math.max(0, (workedMinutes - scheduleMinutes) / 60).toFixed(2);

          return { record, workedHours, overtimeHours };
        })
        .filter(r => r.overtimeHours > 0);

      exportData = overtimeRecords.map(({ record, workedHours, overtimeHours }) => ({
        'Número de Empleado': record.employee.employeeNumber,
        'Nombre': record.employee.user.name,
        'Sucursal': record.employee.sucursal || 'Matriz',
        'Departamento': record.employee.department,
        'Puesto': record.employee.position,
        'Fecha': record.date,
        'Hora de Entrada': record.checkInTime ? format(new Date(record.checkInTime), 'HH:mm:ss') : '—',
        'Hora de Salida': record.checkOutTime ? format(new Date(record.checkOutTime), 'HH:mm:ss') : '—',
        'Horas Trabajadas': workedHours,
        'Horas Extra': overtimeHours,
        'Método Entrada': record.checkInMethod || '—',
        'Método Salida': record.checkOutMethod || '—',
      }));

    } else if (reportType === 'absences') {
      // Absences report: employees who were absent during the period
      // Only count absences up to today - NOT future days
      const todayStr = getMexicoTodayDate();
      const effectiveEndStr = format(endDate, 'yyyy-MM-dd') > todayStr ? todayStr : format(endDate, 'yyyy-MM-dd');
      
      // Get all active employees filtered by sucursal
      const employeeWhere: Record<string, unknown> = { user: { isActive: true } };
      if (sucursal) employeeWhere.sucursal = sucursal;
      
      const employees = await db.employee.findMany({
        where: employeeWhere,
        include: { user: { select: { name: true } }, workSchedules: true }
      });

      // Get attendance records only up to today
      const absencesRecords = await db.attendanceRecord.findMany({
        where: {
          date: {
            gte: format(startDate, 'yyyy-MM-dd'),
            lt: endDateToExclusive(effectiveEndStr)
          }
        }
      });

      const recordMap = new Map<string, Map<string, typeof absencesRecords[0]>>();
      for (const record of absencesRecords) {
        if (!recordMap.has(record.employeeId)) recordMap.set(record.employeeId, new Map());
        recordMap.get(record.employeeId)!.set(String(record.date).slice(0, 10), record);
      }

      // Generate work days up to today only
      const effectiveEndDate = parse(effectiveEndStr, 'yyyy-MM-dd', mexicoNow);
      const allWorkDays = eachDayOfInterval({ start: startDate, end: effectiveEndDate })
        .filter(d => d.getDay() !== 0) // Exclude Sundays
        .map(d => format(d, 'yyyy-MM-dd'))
        .filter(d => d <= todayStr); // Only past and present days

      exportData = [];
      for (const emp of employees) {
        const empRecords = recordMap.get(emp.id) || new Map();
        const absentDates: string[] = [];

        for (const day of allWorkDays) {
          const dayDate = parse(day, 'yyyy-MM-dd', mexicoNow);
          const dow = dayDate.getDay();
          const hasSchedule = emp.workSchedules.some(s => s.dayOfWeek === dow);
          
          if (!hasSchedule) continue;
          
          const rec = empRecords.get(day);
          if (!rec || rec.status === 'ABSENT') {
            absentDates.push(day);
          }
        }

        if (absentDates.length > 0) {
          exportData.push({
            'Número de Empleado': emp.employeeNumber,
            'Nombre': emp.user.name,
            'Sucursal': emp.sucursal || 'Matriz',
            'Departamento': emp.department,
            'Puesto': emp.position,
            'Total Ausencias': absentDates.length,
            'Fechas de Ausencia': absentDates.sort().join(', '),
          });
        }
      }

    } else {
      // Daily report (default)
      exportData = filteredRecords.map(record => {
        let workedHours = 0;
        let overtimeHours = 0;
        let scheduleMinutes = 480;

        if (record.checkInTime && record.checkOutTime) {
          const workedMinutes = differenceInMinutes(new Date(record.checkOutTime), new Date(record.checkInTime));
          workedHours = +(workedMinutes / 60).toFixed(2);
          
          // Use schedule-based overtime
          try {
            const dayDate = parse(String(record.date).slice(0, 10), 'yyyy-MM-dd', mexicoNow);
            const schedule = record.employee.workSchedules.find(s => s.dayOfWeek === dayDate.getDay());
            if (schedule) {
              const [startH, startM] = schedule.startTime.split(':').map(Number);
              const [endH, endM] = schedule.endTime.split(':').map(Number);
              scheduleMinutes = (endH * 60 + endM) - (startH * 60 + startM);
            }
          } catch { /* use default 480 */ }
          
          overtimeHours = +Math.max(0, (workedMinutes - scheduleMinutes) / 60).toFixed(2);
        }

        const baseData: Record<string, unknown> = {
          'Número de Empleado': record.employee.employeeNumber,
          'Nombre': record.employee.user.name,
          'Departamento': record.employee.department,
          'Puesto': record.employee.position,
          'Sucursal': record.employee.sucursal || 'Matriz',
          'Fecha': record.date,
          'Hora de Entrada': record.checkInTime ? format(new Date(record.checkInTime), 'HH:mm:ss') : '—',
          'Hora de Salida': record.checkOutTime ? format(new Date(record.checkOutTime), 'HH:mm:ss') : '—',
          'Comida Inicio': record.mealStart ? format(new Date(record.mealStart), 'HH:mm') : '—',
          'Comida Fin': record.mealEnd ? format(new Date(record.mealEnd), 'HH:mm') : '—',
          'Comida Duración (min)': record.mealDuration || '—',
          'Excedió Comida': record.exceededMeal ? 'Sí' : 'No',
          'Descanso Inicio': record.restStart ? format(new Date(record.restStart), 'HH:mm') : '—',
          'Descanso Fin': record.restEnd ? format(new Date(record.restEnd), 'HH:mm') : '—',
          'Descanso Duración (min)': record.restDuration || '—',
          'Excedió Descanso': record.exceededRest ? 'Sí' : 'No',
          'Horas Trabajadas': workedHours,
          'Horas Extra': overtimeHours,
          'Estado': {
            'PRESENT': 'Presente',
            'LATE': 'Retardo',
            'ABSENT': 'Ausente',
            'EARLY_LEAVE': 'Salida Anticipada'
          }[record.status] || record.status,
          'Método Entrada': record.checkInMethod || '—',
          'Método Salida': record.checkOutMethod || '—',
          'Latitud Entrada': record.checkInLatitude || '—',
          'Longitud Entrada': record.checkInLongitude || '—',
          'Latitud Salida': record.checkOutLatitude || '—',
          'Longitud Salida': record.checkOutLongitude || '—',
        };

        return baseData;
      });
    }

    await createAuditLog(currentUser.id, 'EXPORT_REPORT', request, 'REPORT', undefined, {
      format: format_type, period, reportType, startDate: format(startDate, 'yyyy-MM-dd'), endDate: format(endDate, 'yyyy-MM-dd'),
      sucursal,
    });

    if (format_type === 'csv') {
      if (exportData.length === 0) {
        return NextResponse.json({ error: 'No hay datos para exportar' }, { status: 404 });
      }
      
      const headers = Object.keys(exportData[0]);
      const csvRows = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(h => {
            const val = String(row[h as keyof typeof row] || '');
            return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
          }).join(',')
        )
      ];
      
      const csvContent = csvRows.join('\n');
      const reportLabel = reportType === 'overtime' ? 'horas_extra' : reportType === 'absences' ? 'ausencias' : 'asistencias';
      
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${reportLabel}_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}.csv"`,
        }
      });
    }

    return NextResponse.json({ 
      data: exportData,
      filename: `reporte_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}`
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
