import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-static';

export async function GET(_req: NextRequest) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'diagrama', 'sistema-diagrama.png');

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Diagrama no encontrado', path: filePath },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="diagrama-control-asistencia-NOM-037.png"',
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Error al generar descarga', detail: msg }, { status: 500 });
  }
}
