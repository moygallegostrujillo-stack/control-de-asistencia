// ============================================================
// scripts/check-public-files.ts
//
// ⚠️ TAREA 4 (AUDIT DE SEGURIDAD):
// Script de prebuild que falla el build si encuentra archivos
// sensibles en /public. Next.js sirve /public como estáticos
// sin auth, así que NUNCA debe haber .env, .env.*, *.zip con
// configuración, ni archivos de texto con credenciales ahí.
//
// Se ejecuta automáticamente antes de `next build` (ver
// package.json → script "prebuild").
// ============================================================

import { readdirSync, statSync } from 'fs';
import { join } from 'path';

const PUBLIC_DIR = join(process.cwd(), 'public');

// Patrones de archivos prohibidos en /public.
// - Cualquier .env o .env.* (incluye .env.local, .env.production, etc.)
// - Cualquier *.zip que contenga "env" en el nombre (env-files.zip, env.zip, etc.)
// - Cualquier archivo que se llame igual que los .env conocidos del repo
const FORBIDDEN_PATTERNS: RegExp[] = [
  /^\.env(\..*)?$/i, // .env, .env.local, .env.production, .env.example (este último igual lo bloqueamos por seguridad)
  /^env.*\.zip$/i, // env-files.zip, env.zip, env-config.zip
  /^env-files\..*$/i, // env-files.txt, env-files.json, etc.
  /^usuarios-contrasenas\.txt$/i, // known credential dump file
  /^secrets?\.(json|txt|yaml|yml|key)$/i, // secrets.json, secret.txt, etc.
  /^.*\.(pem|key)$/i, // private keys
];

function walkDir(dir: string): string[] {
  const out: string[] = [];
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    let st;
    try {
      st = statSync(fullPath);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      out.push(...walkDir(fullPath));
    } else {
      out.push(fullPath);
    }
  }
  return out;
}

const files = walkDir(PUBLIC_DIR);
const violations: string[] = [];

for (const file of files) {
  const base = file.split('/').pop() || '';
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(base)) {
      violations.push(file);
      break;
    }
  }
}

if (violations.length > 0) {
  console.error('\n❌ BUILD ABORTADO: archivos sensibles detectados en /public\n');
  console.error('Next.js sirve /public sin auth. Estos archivos quedarían expuestos:\n');
  for (const v of violations) {
    console.error('  - ' + v);
  }
  console.error('\nMuévelos fuera de /public o elimínalos. Si son legítimos,');
  console.error('ajusta scripts/check-public-files.ts con cuidado.\n');
  process.exit(1);
}

console.log('✓ check-public-files: ningún archivo sensible en /public');
