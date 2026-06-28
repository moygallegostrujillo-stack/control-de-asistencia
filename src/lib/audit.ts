import { NextRequest } from 'next/server';
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

export async function auditLog(params: AuditParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        sucursalId: params.sucursalId || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        details: params.details ? JSON.stringify(params.details) : null,
      },
    });
  } catch (e) {
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
