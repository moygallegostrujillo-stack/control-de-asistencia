// ============================================================
// POST /api/attendance/check-in
// Registra la entrada del empleado (o de un empleado por parte del admin)
// Body: { lat, long, method: 'GPS'|'QR', qrCode?, employeeId? }
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';
import { emitCheckIn } from '@/lib/realtime';
import {
  getMexicoTodayDate,
  getMexicoTodayISO,
  getDayOfWeek,
  buildDateTimeInMexico,
} from '@/lib/timezone';
import { validateQRToken, validateStaticEmployeeQR } from '@/lib/qr';
import { isWithinGeofence, type GeoPoint } from '@/lib/geo';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const body = await req.json().catch(() => ({}));
    const { lat, long, method, qrCode, employeeId: bodyEmployeeId } = body as {
      lat?: number;
      long?: number;
      method?: 'GPS' | 'QR';
      qrCode?: string;
      employeeId?: string;
    };

    // Resolver employeeId
    let employeeId: string | undefined;
    if (bodyEmployeeId) {
      // Admin registrando para un empleado
      if (!isAdmin(user)) {
        return forbiddenResponse();
      }
      employeeId = bodyEmployeeId;
    } else if (user.role === 'EMPLOYEE' && user.employeeId) {
      employeeId = user.employeeId;
    }

    if (!employeeId) {
      return NextResponse.json(
        { error: 'ID de empleado es requerido' },
        { status: 400 }
      );
    }

    // Validar método
    const checkMethod = method === 'QR' ? 'QR' : 'GPS';

    // Validar QR si aplica
    if (checkMethod === 'QR' && qrCode) {
      // Probar primero QR dinámico (HMAC)
      const dyn = validateQRToken(qrCode);
      if (!dyn.valid) {
        // Probar QR estático de empleado
        const stat = validateStaticEmployeeQR(qrCode);
        if (!stat.valid) {
          return NextResponse.json(
            { error: dyn.reason || 'Código QR inválido' },
            { status: 400 }
          );
        }
      }
    }

    // Cargar empleado + sucursal + schedules
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true } },
        sucursal: true,
        workSchedules: true,
      },
    });

    if (!employee || !employee.user.isActive) {
      return NextResponse.json(
        { error: 'Empleado no encontrado o inactivo' },
        { status: 404 }
      );
    }

    // SUCURSAL_ADMIN solo puede registrar empleados de su sucursal
    if (user.role === 'SUCURSAL_ADMIN' && user.sucursalId !== employee.sucursalId) {
      return forbiddenResponse();
    }

    const sucursal = employee.sucursal;

    // Geofence (si enforceGeofence=true)
    if (
      sucursal.enforceGeofence &&
      sucursal.latitude != null &&
      sucursal.longitude != null &&
      typeof lat === 'number' &&
      typeof long === 'number'
    ) {
      const point: GeoPoint = { latitude: lat, longitude: long };
      const center: GeoPoint = {
        latitude: sucursal.latitude,
        longitude: sucursal.longitude,
      };
      const geo = isWithinGeofence(point, center, sucursal.geofenceRadiusMeters);
      if (!geo.within) {
        return NextResponse.json(
          {
            error: `Fuera del geofence de la sucursal (distancia: ${Math.round(
              geo.distance
            )}m, radio permitido: ${sucursal.geofenceRadiusMeters}m)`,
            distance: geo.distance,
            radius: sucursal.geofenceRadiusMeters,
          },
          { status: 403 }
        );
      }
    }

    // Validar que no exista ya un registro hoy
    const todayISO = getMexicoTodayISO();
    const todayDate = getMexicoTodayDate();
    const existing = await db.attendanceRecord.findUnique({
      where: {
        employeeId_date: { employeeId, date: todayDate },
      },
    });

    if (existing && existing.checkInTime) {
      return NextResponse.json(
        { error: 'Ya se ha registrado la entrada hoy', record: existing },
        { status: 409 }
      );
    }

    // Momento actual (UTC)
    const now = new Date();

    // Determinar status: PRESENT o LATE según WorkSchedule del día
    let status: 'PRESENT' | 'LATE' = 'PRESENT';
    const dow = getDayOfWeek(todayDate);
    const todaySchedule = employee.workSchedules.find(
      (s) => s.dayOfWeek === dow && !s.isWeeklyRest
    );

    if (todaySchedule) {
      try {
        const expectedCheckIn = buildDateTimeInMexico(todayISO, todaySchedule.startTime);
        const tolMs = (todaySchedule.toleranceMinutes || 0) * 60_000;
        if (now.getTime() > expectedCheckIn.getTime() + tolMs) {
          status = 'LATE';
        }
      } catch {
        // Si falla el cálculo de hora, asumir PRESENT
      }
    }

    const { ip, ua } = getIpAndUA(req);

    // Crear o actualizar registro
    const record = existing
      ? await db.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            checkInTime: now,
            checkInLat: typeof lat === 'number' ? lat : null,
            checkInLong: typeof long === 'number' ? long : null,
            checkInMethod: checkMethod,
            checkInIp: ip,
            checkInUserAgent: ua,
            status,
            isLocked: true,
          },
        })
      : await db.attendanceRecord.create({
          data: {
            employeeId,
            sucursalId: employee.sucursalId,
            date: todayDate,
            checkInTime: now,
            checkInLat: typeof lat === 'number' ? lat : null,
            checkInLong: typeof long === 'number' ? long : null,
            checkInMethod: checkMethod,
            checkInIp: ip,
            checkInUserAgent: ua,
            status,
            isLocked: true,
          },
        });

    await auditLog({
      userId: user.id,
      action: 'CHECK_IN',
      entityType: 'ATTENDANCE_RECORD',
      entityId: record.id,
      sucursalId: employee.sucursalId,
      ipAddress: ip,
      userAgent: ua,
      details: {
        employeeId,
        employeeName: employee.user.name,
        checkInTime: now.toISOString(),
        method: checkMethod,
        lat,
        long,
        status,
        performedBy: user.email,
      },
    });

    // Emitir evento tiempo real (Socket.io) — no bloquea la respuesta
    emitCheckIn({
      employeeId,
      employeeName: employee.user.name,
      employeeNumber: employee.employeeNumber,
      sucursalId: employee.sucursalId,
      time: now.toISOString(),
      method: checkMethod,
      status,
    }).catch(() => {});

    return NextResponse.json({ record }, { status: 201 });
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
