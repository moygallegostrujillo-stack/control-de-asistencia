// ============================================================
// Rate Limiting — Upstash Redis (producción) + memoria (dev)
// ============================================================
//
// ⚠️ TAREA 6 (AUDIT DE SEGURIDAD):
// En Vercel serverless, cada instancia tiene su propia memoria.
// Si el rate limiting es solo en memoria, un atacante puede
// bypassar el límite distribuyendo requests entre instancias.
//
// SOLUCIÓN: usar Upstash Redis (REST API, serverless-friendly)
// como backend compartido para @upstash/ratelimit. Upstash ofrece
// una capa gratis suficiente para este proyecto.
//
// Si UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN NO están
// configurados, se usa un limiter en memoria con un warning en
// logs. Esto es aceptable para dev local pero INSEGURO en prod.
//
// SETUP PARA PRODUCCIÓN (obligatorio):
// 1. Crear cuenta gratis en https://upstash.com (free tier: 10K
//    commands/día, suficiente para este sistema).
// 2. Crear una Redis database, copiar REST URL y REST TOKEN.
// 3. En Vercel Dashboard > Settings > Environment Variables,
//    agregar:
//      UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
//      UPSTASH_REDIS_REST_TOKEN=xxxxx
// 4. Redeploy. Verificar el log: si dice "RATE LIMIT: usando
//    memoria" en producción, las variables NO se cargaron.
//
// ENDPOINTS PROTEGIDOS:
// - /api/auth/login — 10 intentos por IP cada 60s (brute force)
// - /api/auth/qr-login — 20 intentos por IP cada 60s
// - /api/auth/quick-login — 20 intentos por IP cada 60s
// ============================================================

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Limiter en memoria (fallback para dev sin Upstash).
// No usar en producción: no persiste entre instancias serverless.
interface MemEntry {
  count: number;
  resetAt: number;
}
const memStore = new Map<string, MemEntry>();

function memLimit(identifier: string, limit: number, window: number): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const entry = memStore.get(identifier);
  if (!entry || entry.resetAt < now) {
    memStore.set(identifier, { count: 1, resetAt: now + window * 1000 });
    return { success: true, remaining: limit - 1, reset: now + window * 1000 };
  }
  if (entry.count >= limit) {
    return { success: false, remaining: 0, reset: entry.resetAt };
  }
  entry.count++;
  return { success: true, remaining: limit - entry.count, reset: entry.resetAt };
}

// Inicialización lazy del cliente Upstash (solo si las vars existen).
let redisClient: Redis | null = null;
let redisInitTried = false;

function getRedis(): Redis | null {
  if (redisInitTried) return redisClient;
  redisInitTried = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[rate-limit] ⚠️ PRODUCCIÓN SIN UPSTASH REDIS: rate limiting en memoria. ' +
        'No persiste entre instancias serverless de Vercel. Configura ' +
        'UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN en Vercel Dashboard.'
      );
    }
    return null;
  }
  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (e) {
    console.error('[rate-limit] Error inicializando Upstash Redis:', e);
    return null;
  }
}

// Caché de limiters por nombre (para no recrear en cada request).
const limiters = new Map<string, Ratelimit>();

/**
 * Crea o recupera un limiter para una ruta nombrada.
 * Si Upstash está configurado, usa el limiter distribuido.
 * Si no, usa el fallback en memoria (solo dev).
 */
function getLimiter(name: string, limit: number, windowSec: number): Ratelimit | null {
  const key = `${name}:${limit}:${windowSec}`;
  if (limiters.has(key)) return limiters.get(key)!;
  const redis = getRedis();
  if (!redis) {
    return null; // El caller debe usar memLimit en su lugar.
  }
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(windowSec, 's', limit),
    prefix: `ratelimit:${name}`,
    analytics: true,
  });
  limiters.set(key, limiter);
  return limiter;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms
}

/**
 * Aplica rate limiting a un identificador (ej: IP + ruta).
 * Devuelve success=false si se excede el límite.
 *
 * @param name Nombre de la política (ej: 'login', 'qr-login').
 * @param identifier Identificador único (ej: IP del cliente).
 * @param limit Máximo de requests permitidos en la ventana.
 * @param windowSec Ventana de tiempo en segundos.
 */
export async function rateLimit(
  name: string,
  identifier: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const limiter = getLimiter(name, limit, windowSec);
  if (limiter) {
    try {
      const r = await limiter.limit(identifier);
      return {
        success: r.success,
        limit,
        remaining: r.remaining,
        reset: r.reset,
      };
    } catch (e) {
      // Si Upstash falla (red, quota), fallback a memoria para no
      // bloquear usuarios legítimos. Logged pero no fatal.
      console.error('[rate-limit] Upstash error, fallback a memoria:', e);
    }
  }
  // Fallback memoria
  const r = memLimit(identifier, limit, windowSec);
  return { success: r.success, limit, remaining: r.remaining, reset: r.reset };
}

/**
 * Extrae IP del cliente desde headers de Vercel/Next.
 * Vercel pone la IP real en `x-vercel-forwarded-for` o `x-real-ip`.
 */
export function getClientIp(req: Request): string {
  const headers = req.headers;
  return (
    headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}
