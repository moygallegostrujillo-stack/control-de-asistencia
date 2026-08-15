// ============================================================
// /api/audit/verify
//   GET — Valida la integridad de la cadena de hashes del AuditLog.
//          Requiere ADMIN (SUCURSAL_ADMIN o GENERAL_ADMIN) — mismo
//          patrón de auth que /api/audit/route.ts.
//
//          Query params:
//            ?limit=     — cantidad máxima de registros a verificar
//                          (default 10000, máximo 50000).
//            ?startDate= — filtra por createdAt >= (fecha ISO).
//            ?endDate=   — filtra por createdAt <= (fecha ISO).
//
//          Recorre los registros en orden cronológico ASC y recalcula
//          el recordHash esperado para cada uno, comparándolo con el
//          hash almacenado. Si no coinciden → se detectó manipulación.
//
//          Registra la verificación en el propio AuditLog (acción
//          'AUDIT_VERIFY', entityType 'AUDIT_LOG').
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
} from '@/lib/auth';
import { auditLog, computeAuditRecordHash } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorizedResponse();
    if (!isAdmin(user)) return forbiddenResponse();

    const { searchParams } = new URL(req.url);

    // ----------------------------------------------------------------
    // Limit: default 10000, máximo 50000. Examina los registros más
    // recientes (orden DESC + take), luego se invierten en memoria para
    // procesarlos en orden cronológico ASC (requerido para verificar la
    // cadena de previousHash → recordHash).
    // ----------------------------------------------------------------
    const limit = Math.min(
      50000,
      Math.max(1, parseInt(searchParams.get('limit') || '10000', 10) || 10000)
    );

    // Filtros opcionales por rango de fechas.
    const startDateStr = searchParams.get('startDate')?.trim() || null;
    const endDateStr = searchParams.get('endDate')?.trim() || null;

    const where: { createdAt?: { gte?: Date; lte?: Date } } = {};
    if (startDateStr || endDateStr) {
      where.createdAt = {};
      if (startDateStr) {
        const start = new Date(startDateStr);
        if (!isNaN(start.getTime())) {
          start.setHours(0, 0, 0, 0);
          where.createdAt.gte = start;
        }
      }
      if (endDateStr) {
        const end = new Date(endDateStr);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }
    }

    // ----------------------------------------------------------------
    // Fetch de los registros: tomamos los `limit` más recientes en
    // orden DESC y luego invertimos para procesar ASC.
    // Seleccionamos todos los campos que entran en el hash input.
    // ----------------------------------------------------------------
    const recordsRaw = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        userId: true,
        action: true,
        entityType: true,
        entityId: true,
        sucursalId: true,
        ipAddress: true,
        userAgent: true,
        details: true,
        previousHash: true,
        recordHash: true,
      },
    });
    const records = recordsRaw.slice().reverse();

    const totalRecords = records.length;
    let verifiedRecords = 0;
    let preChainRecords = 0;
    let tamperedCount = 0;
    const brokenRecords: Array<{
      id: string;
      createdAt: Date;
      expectedHash: string;
      actualHash: string;
    }> = [];
    let firstBrokenAt: Date | null = null;

    // ----------------------------------------------------------------
    // Track previousHash mientras iteramos.
    //
    // IMPORTANTE: usamos el recordHash ALMACENADO del registro anterior
    // (NO el recalculado) como previousHash para el siguiente. Así, si
    // un atacante manipula el registro N (cambiando campos Y
    // actualizando recordHash[N] para que coincida), pero NO actualiza
    // previousHash[N+1], la manipulación se PROPAGA y se detecta en
    // N+1: el hash esperado de N+1 se calcula con el NUEVO recordHash
    // almacenado de N, que ya no coincide con recordHash[N+1] (que fue
    // calculado con el recordHash ORIGINAL de N).
    // ----------------------------------------------------------------
    let trackedPreviousHash: string | null = null;

    for (const record of records) {
      // Saltar registros pre-chain (recordHash IS NULL) — se consideran
      // válidos por definición (son previos a esta mejora).
      if (record.recordHash === null) {
        preChainRecords++;
        continue;
      }

      // Recalcular el hash esperado usando el previousHash trackeado.
      const expectedHash = computeAuditRecordHash({
        previousHash: trackedPreviousHash,
        userId: record.userId,
        action: record.action,
        entityType: record.entityType,
        entityId: record.entityId,
        sucursalId: record.sucursalId,
        ipAddress: record.ipAddress,
        userAgent: record.userAgent,
        details: record.details,
      });

      if (expectedHash !== record.recordHash) {
        // Manipulación detectada en este registro.
        tamperedCount++;
        if (firstBrokenAt === null) {
          firstBrokenAt = record.createdAt;
        }
        // Cap de 10 entradas en brokenRecords (según spec).
        if (brokenRecords.length < 10) {
          brokenRecords.push({
            id: record.id,
            createdAt: record.createdAt,
            expectedHash,
            actualHash: record.recordHash,
          });
        }
        // Avanzamos la cadena con el hash ALMACENADO (no el recalculado)
        // para que la manipulación se propague al siguiente registro.
        trackedPreviousHash = record.recordHash;
      } else {
        // Cadena intacta para este registro.
        verifiedRecords++;
        trackedPreviousHash = record.recordHash;
      }
    }

    const chainIntact = tamperedCount === 0;

    // ----------------------------------------------------------------
    // Registrar la verificación en el propio AuditLog. Esto genera un
    // nuevo registro encadenado (con su propio recordHash) que deja
    // constancia de quién y cuándo se ejecutó la verificación.
    // ----------------------------------------------------------------
    try {
      await auditLog({
        userId: user.id,
        action: 'AUDIT_VERIFY',
        entityType: 'AUDIT_LOG',
        entityId: null,
        sucursalId: user.sucursalId || null,
        ipAddress: null,
        userAgent: null,
        details: {
          chainIntact,
          totalRecords,
          verifiedRecords,
          preChainRecords,
          tamperedRecords: tamperedCount,
          firstBrokenAt: firstBrokenAt ? firstBrokenAt.toISOString() : null,
          filter: { limit, startDate: startDateStr, endDate: endDateStr },
        },
      });
    } catch (e) {
      // El logging no debe romper la respuesta de verificación.
      console.error('auditLog(AUDIT_VERIFY) error:', e);
    }

    return NextResponse.json({
      totalRecords,
      verifiedRecords,
      preChainRecords,
      tamperedRecords: tamperedCount,
      chainIntact,
      firstBrokenAt,
      brokenRecords,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GET /api/audit/verify error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
