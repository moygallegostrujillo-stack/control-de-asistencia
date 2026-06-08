import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog, getClientIp } from '@/lib/auth';
import { getAuthenticatedUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-helper';
import { getMexicoNow, getMexicoTodayDate } from '@/lib/timezone';

/**
 * PUT /api/attendance/[id]
 * Admin-only endpoint for manually registering/correcting attendance records.
 * Complies with NOM-037: all corrections are audit-logged with justification.
 * 
 * Supported actions:
 * - registerCheckout: Add checkout time to a record that only has check-in
 * - registerCheckin: Add check-in time to a record that has no check-in (e.g., ABSENT record)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    
    // Only admins can make manual corrections
    if (currentUser.role !== 'ADMIN') {
      return forbiddenResponse();
    }

    const { id } = await params;
    const body = await request.json();
    const { action, checkOutTime, checkInTime, justification, status } = body;

    // Justification is mandatory for NOM-037 compliance
    if (!justification || justification.trim().length < 5) {
      return NextResponse.json({ 
        error: 'La justificación es obligatoria (mínimo 5 caracteres) para cumplir con NOM-037' 
      }, { status: 400 });
    }

    // Find the existing record
    const existingRecord = await db.attendanceRecord.findUnique({
      where: { id },
      include: { employee: { include: { user: true, workSchedules: true } } }
    });

    if (!existingRecord) {
      return NextResponse.json({ error: 'Registro de asistencia no encontrado' }, { status: 404 });
    }

    const ipAddress = getClientIp(request);
    let updatedRecord;
    let auditDetails: Record<string, unknown> = {
      recordId: id,
      employeeName: existingRecord.employee.user.name,
      employeeNumber: existingRecord.employee.employeeNumber,
      justification: justification.trim(),
      action,
    };

    if (action === 'registerCheckout') {
      // === REGISTER MANUAL CHECKOUT ===
      if (existingRecord.checkOutTime) {
        return NextResponse.json({ 
          error: 'Este registro ya tiene una hora de salida registrada' 
        }, { status: 409 });
      }

      if (!existingRecord.checkInTime) {
        return NextResponse.json({ 
          error: 'No se puede registrar salida sin entrada. Use "registerCheckin" primero.' 
        }, { status: 400 });
      }

      // Validate the checkout time
      let checkoutDate: Date;
      if (checkOutTime) {
        // Admin provides a specific time (e.g., "18:00" for that day)
        const recordDate = String(existingRecord.date).slice(0, 10); // Always extract YYYY-MM-DD
        checkoutDate = new Date(`${recordDate}T${checkOutTime}:00`);
        if (isNaN(checkoutDate.getTime())) {
          return NextResponse.json({ 
            error: 'Hora de salida inválida. Use formato HH:mm (ej. 18:00)' 
          }, { status: 400 });
        }
      } else {
        return NextResponse.json({ 
          error: 'Debe especificar la hora de salida (formato HH:mm)' 
        }, { status: 400 });
      }

      // Determine the final status
      let finalStatus = existingRecord.status;
      const recordDate = new Date(String(existingRecord.date).slice(0, 10) + 'T12:00:00');
      const dayOfWeek = recordDate.getDay();
      const schedule = existingRecord.employee.workSchedules.find(s => s.dayOfWeek === dayOfWeek);

      if (schedule) {
        const [scheduleHour, scheduleMin] = schedule.endTime.split(':').map(Number);
        
        // Create a comparable time for checkout
        const [checkOutHour, checkOutMin] = [checkoutDate.getHours(), checkoutDate.getMinutes()];
        
        // If checkout is before scheduled end time → EARLY_LEAVE
        if (checkOutHour < scheduleHour || (checkOutHour === scheduleHour && checkOutMin < scheduleMin)) {
          if (existingRecord.status !== 'LATE') {
            finalStatus = 'EARLY_LEAVE';
          }
        } else {
          // Checked out on time or after → keep existing status unless it was ABSENT
          if (existingRecord.status === 'ABSENT') {
            finalStatus = 'PRESENT';
          }
        }
      } else {
        // No schedule for this day, just mark as PRESENT if was ABSENT
        if (existingRecord.status === 'ABSENT') {
          finalStatus = 'PRESENT';
        }
      }

      // Override status if provided (admin override)
      if (status && ['PRESENT', 'LATE', 'EARLY_LEAVE'].includes(status)) {
        finalStatus = status;
      }

      updatedRecord = await db.attendanceRecord.update({
        where: { id },
        data: {
          checkOutTime: checkoutDate.toISOString(),
          checkOutMethod: 'MANUAL',
          checkOutIpAddress: ipAddress,
          status: finalStatus,
          notes: existingRecord.notes 
            ? `${existingRecord.notes}\n[SALIDA MANUAL] ${justification.trim()} - por ${currentUser.name}`
            : `[SALIDA MANUAL] ${justification.trim()} - por ${currentUser.name}`,
        }
      });

      auditDetails = {
        ...auditDetails,
        previousStatus: existingRecord.status,
        newStatus: finalStatus,
        checkOutTime: checkoutDate.toISOString(),
        method: 'MANUAL',
      };

    } else if (action === 'registerCheckin') {
      // === REGISTER MANUAL CHECK-IN ===
      if (existingRecord.checkInTime) {
        return NextResponse.json({ 
          error: 'Este registro ya tiene una hora de entrada registrada' 
        }, { status: 409 });
      }

      if (!checkInTime) {
        return NextResponse.json({ 
          error: 'Debe especificar la hora de entrada (formato HH:mm)' 
        }, { status: 400 });
      }

      // Validate the check-in time
      const recordDate = String(existingRecord.date).slice(0, 10);
      const checkinDate = new Date(`${recordDate}T${checkInTime}:00`);
      if (isNaN(checkinDate.getTime())) {
        return NextResponse.json({ 
          error: 'Hora de entrada inválida. Use formato HH:mm (ej. 09:00)' 
        }, { status: 400 });
      }

      // Determine if late
      let finalStatus = 'PRESENT';
      const dateForDayOfWeek = new Date(String(existingRecord.date).slice(0, 10) + 'T12:00:00');
      const dayOfWeek = dateForDayOfWeek.getDay();
      const schedule = existingRecord.employee.workSchedules.find(s => s.dayOfWeek === dayOfWeek);

      if (schedule) {
        const [scheduleHour, scheduleMin] = schedule.startTime.split(':').map(Number);
        const toleranceMs = schedule.toleranceMinutes * 60 * 1000;
        const scheduledStart = new Date(`${String(existingRecord.date).slice(0, 10)}T${schedule.startTime}:00`);
        const deadline = new Date(scheduledStart.getTime() + toleranceMs);
        
        if (checkinDate > deadline) {
          finalStatus = 'LATE';
        }
      }

      // Override status if provided
      if (status && ['PRESENT', 'LATE'].includes(status)) {
        finalStatus = status;
      }

      updatedRecord = await db.attendanceRecord.update({
        where: { id },
        data: {
          checkInTime: checkinDate.toISOString(),
          checkInMethod: 'MANUAL',
          checkInIpAddress: ipAddress,
          status: finalStatus,
          notes: existingRecord.notes 
            ? `${existingRecord.notes}\n[ENTRADA MANUAL] ${justification.trim()} - por ${currentUser.name}`
            : `[ENTRADA MANUAL] ${justification.trim()} - por ${currentUser.name}`,
        }
      });

      auditDetails = {
        ...auditDetails,
        previousStatus: existingRecord.status,
        newStatus: finalStatus,
        checkInTime: checkinDate.toISOString(),
        method: 'MANUAL',
      };

    } else {
      return NextResponse.json({ 
        error: 'Acción no válida. Use "registerCheckout" o "registerCheckin"' 
      }, { status: 400 });
    }

    // Create audit log for NOM-037 compliance
    await createAuditLog(
      currentUser.id,
      'MANUAL_ATTENDANCE_CORRECTION',
      request,
      'ATTENDANCE_RECORD',
      id,
      auditDetails
    );

    return NextResponse.json({ 
      record: updatedRecord,
      message: 'Registro actualizado correctamente'
    });

  } catch (error) {
    console.error('Manual attendance correction error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

/**
 * GET /api/attendance/[id]
 * Get a specific attendance record (for admin to review before correction)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    
    const { id } = await params;

    const record = await db.attendanceRecord.findUnique({
      where: { id },
      include: {
        employee: {
          include: { user: { select: { name: true, email: true } }, workSchedules: true }
        }
      }
    });

    if (!record) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    // Employees can only see their own records
    if (currentUser.role === 'EMPLOYEE') {
      const emp = await db.employee.findUnique({ where: { userId: currentUser.id } });
      if (!emp || emp.id !== record.employeeId) {
        return forbiddenResponse();
      }
    }

    return NextResponse.json({ record });
  } catch (error) {
    console.error('Get attendance record error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
