// Database adapter - auto-detects Prisma (local) vs Supabase (Vercel)
// When on Vercel (VERCEL env var) → ALWAYS use Supabase (SQLite doesn't work serverless)
// When DATABASE_URL is available locally → use Prisma
// When only NEXT_PUBLIC_SUPABASE_URL is available → use Supabase adapter

const isVercel = !!process.env.VERCEL;
const hasDatabaseUrl = !!process.env.DATABASE_URL;
const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!hasDatabaseUrl && !hasSupabase) {
  console.warn('[db] Warning: No database configuration found.');
}

if (isVercel && !hasSupabase) {
  console.error('[db] ERROR: Running on Vercel but Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

// Lazy-initialized database client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDb(): any {
  if (_db) return _db;

  // On Vercel, ALWAYS use Supabase (SQLite doesn't work in serverless)
  if (isVercel && hasSupabase) {
    console.log('[db] Vercel detected — using Supabase adapter');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const supabaseModule = require('./db-supabase');
    _db = supabaseModule.db;
    return _db;
  }

  // If Supabase is configured and no local DB, use Supabase
  if (hasSupabase && !hasDatabaseUrl) {
    console.log('[db] Using Supabase adapter');
    // Dynamic require for Supabase adapter (must be lazy to avoid bundling in local dev)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const supabaseModule = require('./db-supabase');
    _db = supabaseModule.db;
    return _db;
  }

  // Local development with SQLite
  if (hasDatabaseUrl && !isVercel) {
    console.log('[db] Using Prisma adapter');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaClient } = require('@prisma/client');

    const globalForPrisma = globalThis as unknown as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: any | undefined;
      prismaVersion?: string;
    };

    const SCHEMA_VERSION = 'v2-sucursal';
    if (globalForPrisma.prismaVersion !== SCHEMA_VERSION) {
      globalForPrisma.prisma = undefined;
      globalForPrisma.prismaVersion = SCHEMA_VERSION;
    }

    const prismaDb =
      globalForPrisma.prisma ??
      new PrismaClient({ log: ['query'] });

    if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prismaDb;
    _db = prismaDb;
    return _db;
  }

  throw new Error(
    'No database configuration found. Set DATABASE_URL for Prisma/SQLite (local only) or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for Supabase (Vercel/production).'
  );
}

// Proxy that forwards all property accesses to the lazy-initialized client
export const db = new Proxy({} as Record<string, unknown>, {
  get(_target, prop: string) {
    const client = getDb() as Record<string, unknown>;
    const value = client[prop];
    if (value === undefined) {
      console.error(`[db] Property "${prop}" not found on db client`);
    }
    return value;
  }
});
