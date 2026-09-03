// ============================================================
// /api/download/manual-notificaciones
//   GET — Devuelve el PDF "Manual del Sistema de Notificaciones"
//          con Content-Disposition: attachment para forzar la
//          descarga en el navegador.
//
//          Ruta pública (sin auth) — cubierta por PUBLIC_PATHS
//          en src/middleware.ts (prefijo '/api/download').
//
//          El PDF se genera estáticamente con
//          scripts/gen-notifications-pdf.py y vive en
//          public/documentos/manual-de-notificaciones.pdf.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { readFile } from 'fs/promises';

const PDF_RELATIVE = 'documentos/manual-de-notificaciones.pdf';
const PDF_FILENAME = 'manual-de-notificaciones.pdf';

export async function GET(_req: NextRequest) {
  try {
    const pdfPath = join(process.cwd(), 'public', PDF_RELATIVE);

    if (!existsSync(pdfPath)) {
      return NextResponse.json(
        {
          error: 'PDF no encontrado',
          message:
            'El archivo manual-de-notificaciones.pdf no existe en /public/documentos. ' +
            'Ejecuta `python3 scripts/gen-notifications-pdf.py` para generarlo.',
          expectedPath: pdfPath,
        },
        { status: 404 }
      );
    }

    const data = await readFile(pdfPath);
    const stat = statSync(pdfPath);

    // Content-Disposition: attachment  →  el navegador descarga el archivo
    // en vez de intentar mostrarlo inline. filename*=UTF-8''... asegura
    // que el nombre con acentos/tildes se conserve en todos los navegadores.
    const filenameEncoded = encodeURIComponent(PDF_FILENAME);

    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(stat.size),
        'Content-Disposition': `attachment; filename="${PDF_FILENAME}"; filename*=UTF-8''${filenameEncoded}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('GET /api/download/manual-notificaciones error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
