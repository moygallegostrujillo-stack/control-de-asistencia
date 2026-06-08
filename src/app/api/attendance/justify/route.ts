import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/auth';
import { getAuthenticatedUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-helper';

/**
 * POST /api/attendance/justify
 * Employee submits justification for an inconsistent attendance record.
 * Required for NOM-037 compliance.
 * 
 * Body: {
 *   recordId: string,
 *   justification: string (mandatory, min 10 chars),
 *   estimatedCheckInTime?: string (HH:mm, required for ERROR_JORNADA),
 *   estimatedCheckOutTime?: string (HH:mm, required for SALIDA_OMITIDA),
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();
    
    // Both employees and admins can submit justifications
    const body = await request.json();
    const { recordId, justification, estimatedCheckInTime, estimatedCheckOutTime } = body;

    if (!recordId) {
      return NextResponse.json({ error: 'ID de registro es requerido' }, { status: 400 });
    }

    // Justification is mandatory and must be at least 10 characters
    if (!justification || justification.trim().length < 10) {
      return NextResponse.json({ 
        error: 'La justificación es obligatoria y debe tener al menos 10 caracteres' 
      }, { status: 400 });
    }

    // Find the record
    const record = await db.attendanceRecord.findUnique({
      where: { id: recordId },
      include: { employee: { include: { user: true } } }
    });

    if (!record) {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }

    // Employees can only justify their own records
    if (currentUser.role === 'EMPLOYEE') {
      const emp = await db.employee.findUnique({ where: { userId: currentUser.id } });
      if (!emp || emp.id !== record.employeeId) {
        return forbiddenResponse();
      }
    }

    // Check if the record actually needs justification
    if (!record.needsJustification && record.status !== 'ERROR_JORNADA' && record.status !== 'SALIDA_OMITIDA') {
      return NextResponse.json({ 
        error: 'Este registro no requiere justificación' 
      }, { status: 400 });
    }

    // Validate estimated times based on status
    if (record.status === 'ERROR_JORNADA' && !estimatedCheckInTime) {
      return NextResponse.json({ 
        error: 'Debe ingresar la hora real estimada de entrada para registros con Error en Jornada' 
      }, { status: 400 });
    }

    if (record.status === 'SALIDA_OMITIDA' && !estimatedCheckOutTime) {
      return NextResponse.json({ 
        error: 'Debe ingresar la hora real estimada de salida para registros con Salida Omitida' 
      }, { status: 400 });
    }

    // Validate time format (HH:mm)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (estimatedCheckInTime && !timeRegex.test(estimatedCheckInTime)) {
      return NextResponse.json({ error: 'Hora de entrada inválida. Use formato HH:mm' }, { status: 400 });
    }
    if (estimatedCheckOutTime && !timeRegex.test(estimatedCheckOutTime)) {
      return NextResponse.json({ error: 'Hora de salida inválida. Use formato HH:mm' }, { status: 400 });
    }

    // Update the record with justification
    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      justification: justification.trim(),
      justificationSubmittedAt: now,
      needsJustification: false, // Mark as justified
      notes: record.notes 
        ? `${record.notes}\n[JUSTIFICACIÓN] ${justification.trim()} - por ${currentUser.name}`
        : `[JUSTIFICACIÓN] ${justification.trim()} - por ${currentUser.name}`,
    };

    if (estimatedCheckInTime) {
      updateData.estimatedCheckInTime = estimatedCheckInTime;
    }
    if (estimatedCheckOutTime) {
      updateData.estimatedCheckOutTime = estimatedCheckOutTime;
    }

    const updatedRecord = await db.attendanceRecord.update({
      where: { id: recordId },
      data: updateData,
    });

    // Audit log for NOM-037 compliance
    await createAuditLog(currentUser.id, 'JUSTIFY_ATTENDANCE', request, 'ATTENDANCE_RECORD', recordId, {
      employeeName: record.employee.user.name,
      employeeNumber: record.employee.employeeNumber,
      recordDate: record.date,
      recordStatus: record.status,
      justification: justification.trim(),
      estimatedCheckInTime: estimatedCheckInTime || null,
      estimatedCheckOutTime: estimatedCheckOutTime || null,
      submittedBy: currentUser.name,
    });

    return NextResponse.json({ 
      record: updatedRecord,
      message: 'Justificación enviada correctamente'
    });

  } catch (error) {
    console.error('Justify attendance error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

/**
 * GET /api/attendance/justify?employeeId=xxx
 * Get all records that need justification for the current employee
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    let employeeId = searchParams.get('employeeId');

    // Employees can only see their own pending justifications
    if (currentUser.role === 'EMPLOYEE') {
      const emp = await db.employee.findUnique({ where: { userId: currentUser.id } });
      if (emp) employeeId = emp.id;
    }

    if (!employeeId) {
      return NextResponse.json({ error: 'ID de empleado requerido' }, { status: 400 });
    }

    // Find records that need justification
    const records = await db.attendanceRecord.findMany({
      where: {
        employeeId,
        needsJustification: true,
      },
      include: {
        employee: {
          include: { user: { select: { name: true } }, workSchedules: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    return NextResponse.json({ records });

  } catch (error) {
    console.error('Get pending justifications error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
