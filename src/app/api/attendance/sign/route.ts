// ============================================================
// POST /api/attendance/sign
//   Empleado firma (acknowledge) sus registros de un periodo.
//   Reforma LFT 2027 — art. 132 XXXIV: "El contenido del registro
//   electrónico hará prueba plena si se acredita que fue acordado entre
//   la persona trabajadora y empleadora".
//
//   Body: {
//     startDate: 'YYYY-MM-DD',
//     endDate: 'YYYY-MM-DD',
//     signaturePin: string  // PIN del empleado (4+ dígitos) como firma electrónica simple
//   }
//   Marca employeeSignedAt + signatureHash en todos los registros no firmados
//   del periodo que pertenezcan al empleado.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { toISODate } from '@/lib/timezone';

const MAX_RANGE_DAYS = 92; // trimestre

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    if (!user.employeeId) {
      return NextResponse.json(
        { error: 'Su usuario no tiene empleado asociado' },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { startDate, endDate, signaturePin } = body as {
      startDate?: string;
      endDate?: string;
      signaturePin?: string;
    };

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Se requiere startDate y endDate (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    if (!signaturePin || signaturePin.length < 4) {
      return NextResponse.json(
        { error: 'Se requiere un PIN de firma de al menos 4 caracteres' },
        { status: 400 }
      );
    }

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Fechas inválidas (use YYYY-MM-DD)' },
        { status: 400 }
      );
    }
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays < 0) {
      return NextResponse.json(
        { error: 'La fecha de inicio no puede ser posterior a la de fin' },
        { status: 400 }
      );
    }
    if (diffDays > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `El rango máximo para firmar es de ${MAX_RANGE_DAYS} días` },
        { status: 400 }
      );
    }

    // Cargar registros del periodo (solo los que tienen check-out y no están firmados)
    const records = await db.attendanceRecord.findMany({
      where: {
        employeeId: user.employeeId,
        date: { gte: start, lte: end },
        checkOutTime: { not: null },
        employeeSignedAt: null,
      },
      orderBy: { date: 'asc' },
    });

    if (records.length === 0) {
      return NextResponse.json(
        {
          signed: 0,
          message: 'No hay registros nuevos para firmar en el periodo.',
        },
        { status: 200 }
      );
    }

    // Construir el contenido canónico a firmar: lista de (date|checkIn|checkOut|workedMinutes)
    const canonical = records
      .map((r) =>
        [
          toISODate(r.date),
          r.checkInTime?.toISOString() || '',
          r.checkOutTime?.toISOString() || '',
          r.workedMinutes?.toString() || '0',
          r.overtimeMinutes?.toString() || '0',
        ].join('|')
      )
      .join('\n');

    // Hash del contenido + PIN del empleado (HMAC-SHA256).
    // El PIN no se guarda, solo se usa como sal para evitar reuso del hash.
    const secret =
      process.env.NEXTAUTH_SECRET ||
      process.env.SIGNATURE_SECRET ||
      'dev-only-fallback-secret-change-in-prod';
    const sigHash = createHmac('sha256', `${secret}:${signaturePin}`)
      .update(canonical)
      .digest('hex');

    const { ip, ua } = getIpAndUA(req);
    const now = new Date();

    // Marcar todos los registros del periodo como firmados
    const result = await db.attendanceRecord.updateMany({
      where: {
        id: { in: records.map((r) => r.id) },
      },
      data: {
        employeeSignedAt: now,
        employeeSignatureHash: sigHash,
        employeeSignedIp: ip,
      },
    });

    await auditLog({
      userId: user.id,
      action: 'ATTENDANCE_SIGN',
      entityType: 'ATTENDANCE_RECORD',
      entityId: user.employeeId,
      sucursalId: user.sucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: {
        employeeId: user.employeeId,
        startDate,
        endDate,
        signedCount: result.count,
        signatureHash: sigHash,
        signatureHashPreview: sigHash.slice(0, 16) + '...',
        performedBy: user.email,
      },
    });

    return NextResponse.json({
      signed: result.count,
      signatureHash: sigHash,
      signedAt: now.toISOString(),
      message: `Se firmaron ${result.count} registro(s) del periodo ${startDate} a ${endDate}.`,
    });
  } catch (error) {
    console.error('Attendance sign error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
