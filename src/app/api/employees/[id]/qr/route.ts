import { NextRequest, NextResponse } from 'next/server';
import { generateEmployeeQR } from '@/lib/qr';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (!currentUser) return unauthorizedResponse();

    const { id } = await params;
    
    // Dynamic import to avoid circular deps
    const { db } = await import('@/lib/db');
    const employee = await db.employee.findUnique({
      where: { id },
      include: { user: { select: { name: true } } }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    const qrDataUrl = await generateEmployeeQR(employee.employeeNumber, employee.user.name);

    return NextResponse.json({ qrDataUrl, employeeNumber: employee.employeeNumber, name: employee.user.name });
  } catch (error) {
    console.error('Employee QR error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
