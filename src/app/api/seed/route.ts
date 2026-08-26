// ============================================================
// /api/seed
//   POST — Ejecuta el seed de la base de datos (prisma/seed.ts).
//
//   ⚠️  TAREA 2 (AUDIT DE SEGURIDAD):
//   Este endpoint ANTES era público (listado en PUBLIC_PATHS del
//   middleware) y ejecutaba `bun run prisma/seed.ts` vía execSync
//   SIN autenticación. Cualquiera podía reinicializar la BD.
//
//   Ahora:
//   - Removido de PUBLIC_PATHS → el middleware exige sesión válida.
//   - Además, este handler re-valida explícitamente rol GENERAL_ADMIN.
//   - Si no hay sesión o el rol no es GENERAL_ADMIN → 401/403.
//
//   ⚠️  CLEANUP (26-ago-2026): bloqueo adicional con env var ALLOW_SEED.
//   En producción, ALLOW_SEED no está definida (o es 'false'), por lo que
//   el endpoint rechaza la ejecución aunque el admin esté autenticado.
//   Para habilitar en dev/staging: setear ALLOW_SEED=true en .env.
//   Esto evita que un error humano o token filtrado reseedee la BD
//   de producción.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { getAuthUser, forbiddenResponse, unauthorizedResponse } from '@/lib/auth';
import { auditLog, getIpAndUA } from '@/lib/audit';

export async function POST(req: NextRequest) {
  // --- Tarea 2: Autenticación obligatoria + rol GENERAL_ADMIN ---
  const user = await getAuthUser(req);
  if (!user) {
    return unauthorizedResponse();
  }
  if (user.role !== 'GENERAL_ADMIN') {
    // Auditoría: registrar intento de invocación por rol no autorizado.
    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'SEED_FORBIDDEN',
      entityType: 'System',
      entityId: 'seed',
      sucursalId: user.sucursalId || undefined,
      ipAddress: ip,
      userAgent: ua,
      details: { role: user.role },
    }).catch(() => undefined);
    return forbiddenResponse();
  }

  // --- Cleanup (26-ago-2026): bloqueo en producción vía env var ---
  // ALLOW_SEED debe ser 'true' para permitir la ejecución. En producción
  // (Vercel) NO se setea, así que el endpoint siempre rechaza.
  if (process.env.ALLOW_SEED !== 'true') {
    const { ip, ua } = getIpAndUA(req);
    await auditLog({
      userId: user.id,
      action: 'SEED_BLOCKED',
      entityType: 'System',
      entityId: 'seed',
      sucursalId: user.sucursalId || undefined,
      ipAddress: ip,
      userAgent: ua,
      details: {
        reason: 'ALLOW_SEED env var no es "true" — endpoint bloqueado en producción',
      },
    }).catch(() => undefined);
    return NextResponse.json(
      {
        error: 'Seed bloqueado en este entorno',
        hint: 'Para habilitar, setea ALLOW_SEED=true en las variables de entorno (solo dev/staging).',
      },
      { status: 403 }
    );
  }

  // Auditoría: registrar ejecución autorizada.
  const { ip, ua } = getIpAndUA(req);
  await auditLog({
    userId: user.id,
    action: 'SEED_EXECUTED',
    entityType: 'System',
    entityId: 'seed',
    sucursalId: user.sucursalId || undefined,
    ipAddress: ip,
    userAgent: ua,
    details: {},
  }).catch(() => undefined);

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
