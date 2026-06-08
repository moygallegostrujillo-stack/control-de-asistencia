import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog, getClientIp } from '@/lib/auth';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';
import { getMexicoTodayDate, getMexicoNow, buildTodayDateRange } from '@/lib/timezone';

export async function POST(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    
    const body = await request.json();
    let { employeeId, latitude, longitude, method, qrCode } = body;

    // If employeeId not provided, resolve it from the authenticated user
    if (!employeeId) {
      if (currentUser.role === 'EMPLOYEE') {
        const emp = await db.employee.findUnique({
          where: { userId: currentUser.id }
        });
        if (emp) employeeId = emp.id;
      }
    }

    if (!employeeId) {
      return NextResponse.json({ error: 'ID de empleado es requerido' }, { status: 400 });
    }

    if (latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'La geolocalización es obligatoria para registrar asistencia' }, { status: 400 });
    }

    const checkMethod = method || (qrCode ? 'QR' : 'PASSWORD');

    // If QR code provided, validate it
    if (qrCode) {
      const { validateDynamicQR } = await import('@/lib/qr');
      const validation = await validateDynamicQR(qrCode);
      if (!validation.valid) {
        return NextResponse.json({ 
          error: validation.expired ? 'El código QR ha expirado' : 'Código QR inválido' 
        }, { status: 400 });
      }
      // Mark QR as used
      const { markQRUsed } = await import('@/lib/qr');
      await markQRUsed(qrCode);
    }

    // Verify employee exists
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      include: { user: true, workSchedules: true }
    });

    if (!employee || !employee.user.isActive) {
      return NextResponse.json({ error: 'Empleado no encontrado o inactivo' }, { status: 404 });
    }

    const now = new Date();
    const todayStr = getMexicoTodayDate();
    const todayRange = buildTodayDateRange();
    const checkInTime = now.toISOString();

    // Check if already checked in today
    // Use findMany with date range instead of findUnique with composite key
    // because Supabase date column may be timestamptz, making exact match unreliable
    const existingRecords = await db.attendanceRecord.findMany({
      where: { employeeId, date: todayRange },
      take: 1
    });
    const existingRecord = existingRecords[0] || null;

    if (existingRecord && existingRecord.checkInTime) {
      return NextResponse.json({ 
        error: 'Ya se ha registrado la entrada hoy',
        record: existingRecord 
      }, { status: 409 });
    }

    // Determine status based on schedule - use Mexico timezone for day of week
    let status = 'PRESENT';
    const mexicoNow = getMexicoNow();
    const dayOfWeek = mexicoNow.getDay();
    const todaySchedule = employee.workSchedules.find(s => s.dayOfWeek === dayOfWeek);
    
    if (todaySchedule) {
      const [scheduleHour, scheduleMin] = todaySchedule.startTime.split(':').map(Number);
      const scheduleTime = new Date(mexicoNow);
      scheduleTime.setHours(scheduleHour, scheduleMin, 0, 0);
      const toleranceMs = (todaySchedule.toleranceMinutes || 10) * 60 * 1000;
      
      if (mexicoNow > new Date(scheduleTime.getTime() + toleranceMs)) {
        status = 'LATE';
      }
    }

    const ipAddress = getClientIp(request);

    // Record the employee's sucursal on the attendance record
    const employeeSucursal = employee.sucursal || 'Matriz';

    const record = await db.attendanceRecord.create({
      data: {
        employeeId,
        date: todayStr,
        sucursal: employeeSucursal,
        checkInTime,
        checkInLatitude: latitude,
        checkInLongitude: longitude,
        checkInMethod: checkMethod,
        checkInIpAddress: ipAddress,
        status,
        isLocked: true,
      }
    });

    await createAuditLog(currentUser.id, 'CHECK_IN', request, 'ATTENDANCE_RECORD', record.id, {
      employeeId, employeeName: employee.user.name, checkInTime, method: checkMethod, latitude, longitude
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
