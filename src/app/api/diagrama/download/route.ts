import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Whitelist estricta para prevenir path traversal.
// Si se añade un nuevo diagrama, hay que registrar su slug aquí.
const ALLOWED_FILES = new Set<string>([
  'arquitectura-sistema',
  'flujo-procesos',
  'activacion-mfa-totp',
  'uso-codigo-qr',
]);

const ALLOWED_FORMATS: Record<string, { ext: string; mime: string; disposition: string }> = {
  png: { ext: 'png', mime: 'image/png', disposition: 'attachment' },
  pdf: { ext: 'pdf', mime: 'application/pdf', disposition: 'attachment' },
  // HTML se sirve inline para previsualización en pestaña nueva (no descarga)
  html: { ext: 'html', mime: 'text/html; charset=utf-8', disposition: 'inline' },
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const file = url.searchParams.get('file');
    const format = (url.searchParams.get('format') || 'png').toLowerCase();

    if (!file || !ALLOWED_FILES.has(file)) {
      return NextResponse.json(
        {
          error: 'Archivo inválido.',
          validFiles: Array.from(ALLOWED_FILES),
          received: file,
        },
        { status: 400 }
      );
    }

    const fmt = ALLOWED_FORMATS[format];
    if (!fmt) {
      return NextResponse.json(
        {
          error: 'Formato inválido.',
          validFormats: Object.keys(ALLOWED_FORMATS),
          received: format,
        },
        { status: 400 }
      );
    }

    const filename = `${file}.${fmt.ext}`;
    const filePath = path.join(process.cwd(), 'public', 'diagramas', filename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Archivo no encontrado en el servidor.', filename },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(filePath);

    // Nombre amigable para el usuario al descargar:
    // "NOM-037-arquitectura-sistema.png"
    const downloadName = `NOM-037-${filename}`;

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': fmt.mime,
        'Content-Disposition': `${fmt.disposition}; filename="${downloadName}"`,
        'Content-Length': fileBuffer.length.toString(),
        // Cache de 1 día — los archivos son versionados (Rev. 2) y raramente cambian
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Error al generar descarga', detail: msg },
      { status: 500 }
    );
  }
}
