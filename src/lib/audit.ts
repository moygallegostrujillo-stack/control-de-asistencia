import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { db } from './db';

interface AuditParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  sucursalId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: any;
}

// ============================================================
// RT-P0.7 — Tamper-evident hash chaining for AuditLog
// ============================================================
// Cada registro de AuditLog almacena dos campos de hash:
//
//   previousHash  →  recordHash del registro más reciente de AuditLog
//                    al momento de INSERTAR este registro (null si no
//                    existe registro previo, o si el registro previo
//                    era "pre-chain" con recordHash NULL).
//
//   recordHash    →  sha256 de una concatenación determinista de campos
//                    separados por '|'. El formato EXACTO es:
//
//     sha256(previousHash + '|' + userId   + '|' + action      + '|' +
//            entityType + '|' + entityId   + '|' + sucursalId  + '|' +
//            ipAddress  + '|' + userAgent  + '|' + details)
//
//   Reglas de canonicalización (CRÍTICAS para que el endpoint
//   /api/audit/verify pueda recalcular el mismo hash):
//     - Todos los campos null se vuelven el literal 'null'
//       (NO string vacío, NO undefined).
//     - `details` es el resultado de JSON.stringify(params.details)
//       (o 'null' si params.details es falsy).
//     - El ORDEN de los campos y el delimitador '|' son FIJOS y no
//       deben cambiarse: cualquier cambio rompe la verificación de la
//       cadena existente.
//
//   Por qué importa: cualquier modificación a un campo del registro
//   (action, userId, details, etc.) SIN recalcular recordHash Y
//   actualizar el previousHash de TODOS los registros subsecuentes
//   será detectada por /api/audit/verify. Esto hace la bitácora
//   tamper-evident, satisfaciendo el art. 132 XXXIV LFT (prueba plena
//   ante pericial laboral).
//
//   Registros pre-chain (recordHash IS NULL, existentes antes de
//   esta mejora) NO se modifican. Solo los registros NUEVOS reciben
//   hash. El endpoint /api/audit/verify los salta y los cuenta como
//   "preChainRecords" (válidos por definición).
// ============================================================

/**
 * Input fields for hash computation. `details` debe ser el string JSON
 * ya canonicalizado (o null). `previousHash` es el hash del registro
 * anterior en la cadena (o null si no hay).
 */
export interface AuditHashInput {
  previousHash: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  sucursalId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: string | null;
}

/**
 * Construye el string de entrada determinista para el sha256.
 *
 * Formato (ORDEN FIJO — no cambiar):
 *   previousHash|userId|action|entityType|entityId|sucursalId|ipAddress|userAgent|details
 *
 * Los valores null se vuelven el literal 'null'.
 *
 * Esta función es compartida entre auditLog() (inserción) y
 * /api/audit/verify (verificación) para garantizar que ambos lados
 * calculen exactamente el mismo hash.
 */
export function computeAuditHashInput(input: AuditHashInput): string {
  const parts: string[] = [
    input.previousHash ?? 'null',
    input.userId ?? 'null',
    input.action ?? 'null',
    input.entityType ?? 'null',
    input.entityId ?? 'null',
    input.sucursalId ?? 'null',
    input.ipAddress ?? 'null',
    input.userAgent ?? 'null',
    input.details ?? 'null',
  ];
  return parts.join('|');
}

/**
 * Calcula el recordHash (sha256 hex) para un registro de auditoría.
 * Usa computeAuditHashInput para garantizar el formato determinista.
 */
export function computeAuditRecordHash(input: AuditHashInput): string {
  const payload = computeAuditHashInput(input);
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

export async function auditLog(params: AuditParams): Promise<void> {
  try {
    // Canonicalizamos los campos UNA sola vez para que la inserción y
    // el cálculo del hash usen exactamente los mismos valores.
    const userId = params.userId || null;
    const action = params.action;
    const entityType = params.entityType;
    const entityId = params.entityId || null;
    const sucursalId = params.sucursalId || null;
    const ipAddress = params.ipAddress || null;
    const userAgent = params.userAgent || null;
    const details = params.details ? JSON.stringify(params.details) : null;

    // ----------------------------------------------------------------
    // RT-P0.7: Obtener el recordHash del registro más reciente para
    // usarlo como previousHash. Si no existe registro previo, o si el
    // registro previo era pre-chain (recordHash IS NULL), previousHash
    // queda en null y el primer campo del hash será el literal 'null'.
    // ----------------------------------------------------------------
    const lastLog = await db.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { recordHash: true },
    });
    const previousHash = lastLog?.recordHash ?? null;

    // Calcular el recordHash determinista para ESTE registro.
    const recordHash = computeAuditRecordHash({
      previousHash,
      userId,
      action,
      entityType,
      entityId,
      sucursalId,
      ipAddress,
      userAgent,
      details,
    });

    await db.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        sucursalId,
        ipAddress,
        userAgent,
        details,
        previousHash,
        recordHash,
      },
    });
  } catch (e) {
    // El logging de auditoría NUNCA debe romper la operación principal.
    console.error('auditLog error:', e);
  }
}

export function getIpAndUA(req: NextRequest | any): { ip: string; ua: string } {
  const headers = req?.headers || {};
  const ip =
    headers.get?.('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    headers.get?.('x-real-ip') ||
    headers['x-real-ip'] ||
    'unknown';
  const ua = headers.get?.('user-agent') || headers['user-agent'] || 'unknown';
  return { ip: String(ip), ua: String(ua) };
}
