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
      const { markQRUsed } = await import('@/lib/qr');
      await markQRUsed(qrCode);
    }

    const now = new Date();
    const todayStr = getMexicoTodayDate();
    const todayRange = buildTodayDateRange();
    const checkOutTime = now.toISOString();

    // Find today's record using date range (handles timestamptz columns)
    const existingRecords = await db.attendanceRecord.findMany({
      where: { employeeId, date: todayRange },
      include: { employee: { include: { user: true, workSchedules: true } } },
      take: 1
    });
    const existingRecord = existingRecords[0] || null;

    if (!existingRecord) {
      return NextResponse.json({ error: 'No se ha registrado la entrada hoy' }, { status: 404 });
    }

    if (existingRecord.checkOutTime) {
      return NextResponse.json({ 
        error: 'Ya se ha registrado la salida hoy',
        record: existingRecord 
      }, { status: 409 });
    }

    const ipAddress = getClientIp(request);

    // Determine if early leave - use Mexico timezone for day of week
    let finalStatus = existingRecord.status;
    const mexicoNow = getMexicoNow();
    const dayOfWeek = mexicoNow.getDay();
    const todaySchedule = existingRecord.employee.workSchedules.find(s => s.dayOfWeek === dayOfWeek);
    
    if (todaySchedule && existingRecord.status !== 'LATE') {
      const [scheduleHour, scheduleMin] = todaySchedule.endTime.split(':').map(Number);
      const scheduleTime = new Date(mexicoNow);
      scheduleTime.setHours(scheduleHour, scheduleMin, 0, 0);
      
      if (mexicoNow < scheduleTime) {
        finalStatus = 'EARLY_LEAVE';
      }
    }

    const record = await db.attendanceRecord.update({
      where: { id: existingRecord.id },
      data: {
        checkOutTime,
        checkOutLatitude: latitude,
        checkOutLongitude: longitude,
        checkOutMethod: checkMethod,
        checkOutIpAddress: ipAddress,
        status: finalStatus,
      }
    });

    await createAuditLog(currentUser.id, 'CHECK_OUT', request, 'ATTENDANCE_RECORD', record.id, {
      employeeId, employeeName: existingRecord.employee.user.name, checkOutTime, method: checkMethod, latitude, longitude
    });

    return NextResponse.json({ record });
  } catch (error) {
    console.error('Check-out error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
