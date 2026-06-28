// ============================================================
// /api/holidays
//   GET  — Cualquier usuario autenticado. Lista todos los días
//          feriados ordenados por fecha asc.
//   POST — Solo GENERAL_ADMIN (middleware-enforced). Crea
//          { date, name, description?, isOfficial? }. Valida
//          unicidad de date.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isGeneralAdmin,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const holidays = await db.holiday.findMany({
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({ holidays });
  } catch (error) {
    console.error('GET /api/holidays error:', error);
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
    if (!isGeneralAdmin(user)) return forbiddenResponse(); // middleware-enforced

    const body = await req.json().catch(() => ({}));
    const { date, name, description, isOfficial } = body as {
      date?: string;
      name?: string;
      description?: string | null;
      isOfficial?: boolean;
    };

    if (!date || !name) {
      return NextResponse.json(
        { error: 'Los campos date y name son requeridos' },
        { status: 400 }
      );
    }

    // Parseo de fecha (formato YYYY-MM-DD).
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: 'Formato de fecha inválido (usar YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // Unicidad de date (schema @unique).
    const conflict = await db.holiday.findUnique({
      where: { date: parsed },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json(
        { error: 'Ya existe un día feriado en esa fecha' },
        { status: 409 }
      );
    }

    const holiday = await db.holiday.create({
      data: {
        date: parsed,
        name: name.trim(),
        description: description ?? null,
        isOfficial: isOfficial ?? true,
      },
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'HOLIDAY_CREATE',
      entityType: 'HOLIDAY',
      entityId: holiday.id,
      sucursalId: null,
      ipAddress: ip,
      userAgent: ua,
      details: { date, name: holiday.name, isOfficial: holiday.isOfficial },
    });

    return NextResponse.json({ holiday }, { status: 201 });
  } catch (error) {
    console.error('POST /api/holidays error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
