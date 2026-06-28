// ============================================================
// /api/company/logo
//   POST — Solo GENERAL_ADMIN (middleware-enforced). Recibe
//          multipart/form-data con campo "file" (png/jpeg/svg).
//          Máx 2MB. Guarda el archivo en /public/uploads/logo.<ext>
//          y actualiza Company.logoUrl. Requiere que el singleton
//          Company ya exista (el frontend lo crea primero con PUT
//          /api/company). Devuelve { logoUrl }.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isGeneralAdmin,
} from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';

const COMPANY_ID = 'singleton';
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// Mapa content-type → extensión.
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/svg+xml': 'svg',
};

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isGeneralAdmin(user)) return forbiddenResponse(); // middleware-enforced

    // Verificar que la empresa existe.
    const existing = await db.company.findUnique({
      where: { id: COMPANY_ID },
      select: { id: true, logoUrl: true },
    });
    if (!existing) {
      return NextResponse.json(
        {
          error:
            'Primero debes crear los datos de la empresa (PUT /api/company) antes de subir el logo',
        },
        { status: 404 }
      );
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: 'Se esperaba multipart/form-data' },
        { status: 400 }
      );
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Campo "file" requerido' },
        { status: 400 }
      );
    }

    // Validar tamaño.
    if (file.size === 0) {
      return NextResponse.json(
        { error: 'El archivo está vacío' },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'El archivo supera el máximo de 2MB' },
        { status: 413 }
      );
    }

    // Validar content-type.
    const contentType = (file.type || '').toLowerCase();
    const ext = ALLOWED_TYPES[contentType];
    if (!ext) {
      return NextResponse.json(
        {
          error:
            'Tipo de archivo no soportado. Se aceptan PNG, JPEG o SVG.',
        },
        { status: 415 }
      );
    }

    // Asegurar que /public/uploads existe.
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Guardar como logo.<ext>.
    const filename = `logo.${ext}`;
    const filepath = path.join(uploadsDir, filename);
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(filepath, Buffer.from(arrayBuffer));

    // URL pública servida por Next.
    const logoUrl = `/uploads/${filename}`;

    // Actualizar Company.logoUrl.
    await db.company.update({
      where: { id: COMPANY_ID },
      data: { logoUrl },
    });

    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'COMPANY_LOGO_UPLOAD',
      entityType: 'COMPANY',
      entityId: COMPANY_ID,
      sucursalId: null,
      ipAddress: ip,
      userAgent: ua,
      details: {
        filename,
        contentType,
        sizeBytes: file.size,
        previousLogoUrl: existing.logoUrl,
      },
    });

    return NextResponse.json({ logoUrl }, { status: 201 });
  } catch (error) {
    console.error('POST /api/company/logo error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
