// ============================================================
// /api/download/tabla-cumplimiento-legal
//   GET — Devuelve el PDF "Tabla Comparativa de Cumplimiento
//          Legal" con Content-Disposition: attachment para forzar
//          la descarga en el navegador (en lugar de intentar
//          mostrarlo inline, que es lo que falla en algunos
//          navegadores / iframes de preview).
//
//          Ruta pública (sin auth) — cubierta por PUBLIC_PATHS
//          en src/middleware.ts (prefijo '/api/download').
//
//          El PDF se genera estáticamente con
//          scripts/gen-legal-compliance-pdf.py y vive en
//          public/tabla-comparativa-cumplimiento-legal.pdf.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { readFile } from 'fs/promises';

const PDF_RELATIVE = 'tabla-comparativa-cumplimiento-legal.pdf';
const PDF_FILENAME = 'tabla-comparativa-cumplimiento-legal.pdf';

export async function GET(_req: NextRequest) {
  try {
    const pdfPath = join(process.cwd(), 'public', PDF_RELATIVE);

    if (!existsSync(pdfPath)) {
      return NextResponse.json(
        {
          error: 'PDF no encontrado',
          message:
            'El archivo tabla-comparativa-cumplimiento-legal.pdf no existe en /public. ' +
            'Ejecuta `python3 scripts/gen-legal-compliance-pdf.py` para generarlo.',
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
    console.error('GET /api/download/tabla-cumplimiento-legal error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
