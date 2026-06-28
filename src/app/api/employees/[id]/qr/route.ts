// ============================================================
// GET /api/employees/[id]/qr
//   Devuelve el QR estático del empleado (PNG data URL) generado
//   con generateStaticEmployeeQR(employeeNumber) y renderizado
//   a PNG con la librería 'qrcode'.
//   Permisos:
//     - EMPLOYEE: solo su propio QR (id === user.employeeId).
//     - SUCURSAL_ADMIN: cualquier empleado de su sucursal.
//     - GENERAL_ADMIN: cualquiera.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isGeneralAdmin,
} from '@/lib/auth';
import { generateStaticEmployeeQR } from '@/lib/qr';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const { id } = await params;

    // EMPLOYEE: solo puede ver su propio QR.
    if (user.role === 'EMPLOYEE') {
      if (!user.employeeId || user.employeeId !== id) {
        return forbiddenResponse();
      }
    } else if (!isGeneralAdmin(user)) {
      // SUCURSAL_ADMIN — validación de sucursal se hace más abajo.
    }

    const employee = await db.employee.findUnique({
      where: { id },
      select: {
        id: true,
        employeeNumber: true,
        sucursalId: true,
        user: { select: { name: true } },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // SUCURSAL_ADMIN: solo puede ver QR de empleados de su sucursal.
    // (EMPLOYEE ya se validó arriba con user.employeeId === id.)
    if (
      user.role === 'SUCURSAL_ADMIN' &&
      employee.sucursalId !== user.sucursalId
    ) {
      return forbiddenResponse();
    }

    const qrToken = generateStaticEmployeeQR(employee.employeeNumber);

    // Render a PNG data URL.
    const qrDataUrl = await QRCode.toDataURL(qrToken, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
    });

    return NextResponse.json({
      qrDataUrl,
      qrToken,
      employeeNumber: employee.employeeNumber,
      name: employee.user.name,
    });
  } catch (error) {
    console.error('GET /api/employees/[id]/qr error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
