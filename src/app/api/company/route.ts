// ============================================================
// /api/company
//   GET — Cualquier usuario autenticado puede leer el singleton
//         de la empresa. Devuelve null si aún no se ha creado.
//   PUT — Solo GENERAL_ADMIN (middleware-enforced). Upsert del
//         singleton con id="singleton". Actualiza los campos
//         enviados. fix #3 datos de la empresa.
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

const COMPANY_ID = 'singleton';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();

    const company = await db.company.findUnique({
      where: { id: COMPANY_ID },
    });

    // Si no existe aún, devolvemos null para que el frontend
    // promptee al GENERAL_ADMIN para crearla.
    return NextResponse.json({ company: company ?? null });
  } catch (error) {
    console.error('GET /api/company error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isGeneralAdmin(user)) return forbiddenResponse(); // middleware-enforced

    const body = await req.json().catch(() => ({}));
    const {
      razonSocial,
      rfc,
      registroPatronal,
      domicilioFiscal,
      telefono,
      email,
      representanteLegal,
      logoUrl,
    } = body as {
      razonSocial?: string;
      rfc?: string;
      registroPatronal?: string | null;
      domicilioFiscal?: string | null;
      telefono?: string | null;
      email?: string | null;
      representanteLegal?: string | null;
      logoUrl?: string | null;
    };

    // Validación: si se está creando (no existe), razonSocial y rfc son obligatorios.
    const existing = await db.company.findUnique({
      where: { id: COMPANY_ID },
      select: { id: true, razonSocial: true, rfc: true },
    });

    if (!existing) {
      if (!razonSocial || !rfc) {
        return NextResponse.json(
          {
            error:
              'Para crear la empresa se requieren razonSocial y rfc',
          },
          { status: 400 }
        );
      }
    }

    // Construir payload de datos. Para upsert, "create" requiere los
    // campos obligatorios (razonSocial, rfc); "update" acepta cualquier subset.
    const createData = {
      id: COMPANY_ID,
      razonSocial: razonSocial ?? existing?.razonSocial ?? '',
      rfc: rfc ?? existing?.rfc ?? '',
      registroPatronal: registroPatronal ?? null,
      domicilioFiscal: domicilioFiscal ?? null,
      telefono: telefono ?? null,
      email: email ?? null,
      representanteLegal: representanteLegal ?? null,
      logoUrl: logoUrl ?? null,
    };

    const updateData: Record<string, unknown> = {};
    if (razonSocial !== undefined) updateData.razonSocial = razonSocial;
    if (rfc !== undefined) updateData.rfc = rfc;
    if (registroPatronal !== undefined) updateData.registroPatronal = registroPatronal;
    if (domicilioFiscal !== undefined) updateData.domicilioFiscal = domicilioFiscal;
    if (telefono !== undefined) updateData.telefono = telefono;
    if (email !== undefined) updateData.email = email;
    if (representanteLegal !== undefined) updateData.representanteLegal = representanteLegal;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;

    const company = await db.company.upsert({
      where: { id: COMPANY_ID },
      create: createData,
      update: updateData,
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: existing ? 'UPDATE_COMPANY' : 'CREATE_COMPANY',
      entityType: 'COMPANY',
      entityId: COMPANY_ID,
      sucursalId: null,
      ipAddress: ip,
      userAgent: ua,
      details: { changes: body, created: !existing },
    });

    return NextResponse.json({ company });
  } catch (error) {
    console.error('PUT /api/company error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
