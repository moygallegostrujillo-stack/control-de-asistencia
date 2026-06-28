// ============================================================
// GET /api/attendance/today
// ADMIN: devuelve registros del día (filtrados por sucursal).
//   ?sucursalId=X (GENERAL_ADMIN puede elegir; SUCURSAL_ADMIN forzado al propio)
//   Calcula ausentes vía computeAbsentsForDate (fix #11)
//   Stats: total, present, late, absent, onBreak, breakExceeded, breakTotalMinutes, overtimeHours
// EMPLOYEE: solo su propio registro + stats mínimos
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  isGeneralAdmin,
} from '@/lib/auth';
import { getMexicoTodayDate, minutesToHours } from '@/lib/timezone';
import { computeAbsentsForDate } from '@/lib/absence-calculator';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const todayDate = getMexicoTodayDate();
    const { searchParams } = new URL(req.url);
    const querySucursalId = searchParams.get('sucursalId');

    // -----------------------------------------------------
    // EMPLOYEE — solo su propio registro
    // -----------------------------------------------------
    if (user.role === 'EMPLOYEE') {
      if (!user.employeeId) {
        return NextResponse.json({ record: null, stats: null });
      }

      const record = await db.attendanceRecord.findUnique({
        where: {
          employeeId_date: {
            employeeId: user.employeeId,
            date: todayDate,
          },
        },
        include: {
          employee: {
            include: {
              user: { select: { name: true, email: true } },
              sucursal: { select: { id: true, name: true, codigoLocal: true } },
            },
          },
        },
      });

      return NextResponse.json({
        record,
        stats: {
          checkedIn: record?.checkInTime ? true : false,
          checkedOut: record?.checkOutTime ? true : false,
          onBreak: !!(record?.mealStart && !record?.mealEnd) ||
            !!(record?.restStart && !record?.restEnd),
          status: record?.status || null,
        },
      });
    }

    // -----------------------------------------------------
    // ADMIN (SUCURSAL_ADMIN o GENERAL_ADMIN)
    // -----------------------------------------------------
    let sucursalId: string | undefined;
    if (isGeneralAdmin(user)) {
      sucursalId = querySucursalId || undefined;
    } else {
      // SUCURSAL_ADMIN forzado a su sucursal
      sucursalId = user.sucursalId || undefined;
    }

    const where: { date: Date; sucursalId?: string } = {
      date: todayDate,
    };
    if (sucursalId) where.sucursalId = sucursalId;

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
      orderBy: { checkInTime: 'asc' },
    });

    // Ausentes (fix #11)
    const absents = await computeAbsentsForDate(todayDate, sucursalId);

    // Stats
    let present = 0;
    let late = 0;
    let absent = absents.length;
    let onBreak = 0;
    let breakExceeded = 0;
    let breakTotalMinutes = 0;
    let overtimeMinutesTotal = 0;

    for (const r of records) {
      if (r.status === 'PRESENT') present++;
      if (r.status === 'LATE') late++;
      if (r.mealExceeded || r.restExceeded) breakExceeded++;
      if (
        (r.mealStart && !r.mealEnd) ||
        (r.restStart && !r.restEnd)
      ) {
        onBreak++;
      }
      if (r.mealDurationMinutes) breakTotalMinutes += r.mealDurationMinutes;
      if (r.restDurationMinutes) breakTotalMinutes += r.restDurationMinutes;
      if (r.overtimeMinutes) overtimeMinutesTotal += r.overtimeMinutes;
    }

    return NextResponse.json({
      date: todayDate,
      sucursalId: sucursalId || null,
      records,
      absents,
      stats: {
        total: records.length + absent,
        present,
        late,
        absent,
        onBreak,
        breakExceeded,
        breakTotalMinutes,
        overtimeMinutes: overtimeMinutesTotal,
        overtimeHours: minutesToHours(overtimeMinutesTotal),
        checkedIn: records.filter((r) => r.checkInTime).length,
        checkedOut: records.filter((r) => r.checkOutTime).length,
      },
    });
  } catch (error) {
    console.error('Today attendance error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
