// ============================================================
// /api/attendance/justify
// GET  — ADMIN: lista justificaciones PENDING (filtradas por sucursal)
// POST — ADMIN: actualiza record.justification, justificationStatus='PENDING'
//        Body: { recordId, justification }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
  isGeneralAdmin,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { searchParams } = new URL(req.url);
    const querySucursalId = searchParams.get('sucursalId') || undefined;

    const where: {
      justificationStatus: string;
      sucursalId?: string;
    } = { justificationStatus: 'PENDING' };

    if (isGeneralAdmin(user)) {
      if (querySucursalId) where.sucursalId = querySucursalId;
    } else if (user.role === 'SUCURSAL_ADMIN') {
      where.sucursalId = user.sucursalId || undefined;
    } else {
      return forbiddenResponse();
    }

    const records = await db.attendanceRecord.findMany({
      where,
      include: {
        employee: {
          include: {
            user: { select: { name: true, email: true } },
            sucursal: { select: { id: true, name: true, codigoLocal: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error('Justify GET error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const body = await req.json().catch(() => ({}));
    const { recordId, justification } = body as {
      recordId?: string;
      justification?: string;
    };

    if (!recordId) {
      return NextResponse.json(
        { error: 'recordId es requerido' },
        { status: 400 }
      );
    }

    if (!justification || justification.trim().length < 5) {
      return NextResponse.json(
        { error: 'La justificación es obligatoria (mínimo 5 caracteres)' },
        { status: 400 }
      );
    }

    const record = await db.attendanceRecord.findUnique({
      where: { id: recordId },
      include: {
        employee: {
          include: {
            user: { select: { name: true, email: true } },
            sucursal: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json(
        { error: 'Registro no encontrado' },
        { status: 404 }
      );
    }

    // SUCURSAL_ADMIN solo en su sucursal
    if (
      user.role === 'SUCURSAL_ADMIN' &&
      user.sucursalId !== record.employee.sucursalId
    ) {
      return forbiddenResponse();
    }

    const { ip, ua } = getIpAndUA(req);

    const updated = await db.attendanceRecord.update({
      where: { id: recordId },
      data: {
        justification: justification.trim(),
        justificationStatus: 'PENDING',
        justificationResolvedById: null,
      },
    });

    await auditLog({
      userId: user.id,
      action: 'JUSTIFICATION_SUBMIT',
      entityType: 'ATTENDANCE_RECORD',
      entityId: record.id,
      sucursalId: record.employee.sucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: {
        recordId,
        employeeId: record.employeeId,
        employeeName: record.employee.user.name,
        recordDate: record.date,
        previousStatus: record.status,
        justification: justification.trim(),
        performedBy: user.email,
      },
    });

    return NextResponse.json({
      record: updated,
      message: 'Justificación enviada correctamente',
    });
  } catch (error) {
    console.error('Justify POST error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
