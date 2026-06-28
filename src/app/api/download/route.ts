// ============================================================
// /api/download
//   GET — Redirige al ZIP público del proyecto si existe en
//          public/control-de-asistencia.zip. Si no existe,
//          devuelve 404 con un mensaje explicativo.
//          Ruta pública (sin auth) — listada en PUBLIC_PATHS
//          del middleware.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { join } from 'path';

const ZIP_PUBLIC_PATH = '/control-de-asistencia.zip';

export async function GET(req: NextRequest) {
  try {
    const zipPath = join(process.cwd(), 'public', 'control-de-asistencia.zip');

    if (existsSync(zipPath)) {
      // Redirigir al archivo estático servido por Next.js desde /public.
      // Cache-buster con timestamp para evitar redirecciones cacheadas.
      const target = new URL(
        `${ZIP_PUBLIC_PATH}?t=${Date.now()}`,
        req.nextUrl.origin
      );
      return NextResponse.redirect(target, 302);
    }

    return NextResponse.json(
      {
        error: 'Archivo no encontrado',
        message:
          'El archivo control-de-asistencia.zip no está disponible en /public. ' +
          'Genera el ZIP del proyecto y colócalo en public/control-de-asistencia.zip.',
        expectedPath: zipPath,
      },
      { status: 404 }
    );
  } catch (error) {
    console.error('GET /api/download error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
