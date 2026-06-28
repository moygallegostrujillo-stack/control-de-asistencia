import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';

export async function GET() {
  try {
    // Read both env files
    const [envContent, envExampleContent] = await Promise.all([
      readFile('/home/z/my-project/.env', 'utf-8').catch(() => ''),
      readFile('/home/z/my-project/.env.example', 'utf-8').catch(() => ''),
    ]);

    // Build a readable text file with both contents clearly separated
    const combinedContent = `═══════════════════════════════════════════════════════════════
 CONTROL DE ASISTENCIA — ARCHIVOS DE ENTORNO
═══════════════════════════════════════════════════════════════

Este archivo contiene los dos archivos de configuración de entorno
del proyecto: .env (configuración activa) y .env.example (plantilla
documentada con todas las variables posibles).

───────────────────────────────────────────────────────────────
 ARCHIVO 1: .env  (configuración activa actual)
───────────────────────────────────────────────────────────────

${envContent}

───────────────────────────────────────────────────────────────
 ARCHIVO 2: .env.example  (plantilla completa documentada)
───────────────────────────────────────────────────────────────

${envExampleContent}

═══════════════════════════════════════════════════════════════
 FIN DEL ARCHIVO
═══════════════════════════════════════════════════════════════
`;

    return new NextResponse(combinedContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="env-files.txt"',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating env file:', error);
    return NextResponse.json(
      { error: 'Error al generar el archivo de entorno' },
      { status: 500 }
    );
  }
}
