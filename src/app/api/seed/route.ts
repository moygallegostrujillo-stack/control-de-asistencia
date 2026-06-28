// ============================================================
// /api/seed
//   POST — Ejecuta el seed de la base de datos (prisma/seed.ts).
//          Ruta pública (solo invocable manualmente) — listada en
//          PUBLIC_PATHS del middleware.
//          Ejecuta `bun run prisma/seed.ts` vía child_process y
//          devuelve stdout/stderr y el código de salida.
//          Si bun no está disponible o el script falla, devuelve
//          instrucciones manuales con código 500.
// ============================================================

import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function POST() {
  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    // Ejecutar el seed directamente con bun. El archivo
    // prisma/seed.ts crea Company, Sucursales, usuarios admin,
    // empleados de ejemplo y días feriados oficiales.
    const out = execSync('bun run prisma/seed.ts 2>&1', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      timeout: 120_000, // 2 minutos máximo
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    stdout = out;
  } catch (error: unknown) {
    // execSync lanza cuando el proceso termina con código != 0.
    if (error && typeof error === 'object') {
      const e = error as {
        stdout?: string;
        stderr?: string;
        status?: number;
        message?: string;
      };
      stdout = e.stdout || '';
      stderr = e.stderr || '';
      exitCode = typeof e.status === 'number' ? e.status : 1;
    } else {
      stderr = String(error);
      exitCode = 1;
    }
  }

  if (exitCode !== 0) {
    return NextResponse.json(
      {
        ok: false,
        message: 'El seed falló. Ejecútalo manualmente para diagnóstico.',
        instructions:
          'Ejecuta manualmente en el servidor: `bun run prisma/seed.ts` ' +
          '(o `npx prisma db seed` si configuras el script db:seed en package.json).',
        exitCode,
        stdout,
        stderr,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'Seed ejecutado correctamente.',
    exitCode,
    stdout,
    stderr,
  });
}
