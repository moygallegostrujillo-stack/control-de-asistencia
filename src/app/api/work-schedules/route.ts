import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const cookie = request.cookies.get('session_user');
    if (!cookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const currentUser = JSON.parse(cookie.value);
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    if (currentUser.role === 'EMPLOYEE') {
      const emp = await db.employee.findUnique({ where: { userId: currentUser.id } });
      if (emp) {
        const schedules = await db.workSchedule.findMany({ where: { employeeId: emp.id } });
        return NextResponse.json({ schedules });
      }
    }

    const where = employeeId ? { employeeId } : {};
    const schedules = await db.workSchedule.findMany({
      where,
      include: { employee: { include: { user: { select: { name: true } } } } },
      orderBy: [{ employeeId: 'asc' }, { dayOfWeek: 'asc' }]
    });

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('Work schedules error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
