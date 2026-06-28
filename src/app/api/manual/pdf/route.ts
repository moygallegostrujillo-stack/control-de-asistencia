import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse, isAdmin } from '@/lib/auth';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(request: NextRequest) {
  const currentUser = await getAuthUser(request);
  if (!currentUser) return unauthorizedResponse();
  if (!isAdmin(currentUser)) {
    return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
  }

  try {
    const pdfPath = join(process.cwd(), 'public', 'manual-usuario.pdf');
    const pdfBuffer = await readFile(pdfPath);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Manual_Usuario_Control_Asistencia_NOM037.pdf"',
        'Cache-Control': 'no-cache',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Manual no disponible' }, { status: 404 });
  }
}
