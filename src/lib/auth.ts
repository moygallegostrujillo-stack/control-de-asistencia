import bcrypt from 'bcryptjs';
import { db } from './db';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function ensureAdminUser() {
  const adminEmail = 'admin@asistencias.com';
  const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } });
  
  if (!existingAdmin) {
    const hashedPassword = await hashPassword('Admin123!');
    await db.user.create({
      data: {
        email: adminEmail,
        passwordHash: hashedPassword,
        name: 'Administrador',
        role: 'ADMIN',
        isActive: true,
      }
    });
    console.log('Admin user created: admin@asistencias.com / Admin123!');
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export function getUserAgent(request: Request): string {
  return request.headers.get('user-agent') || 'unknown';
}

export async function createAuditLog(
  userId: string,
  action: string,
  request: Request,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  await db.auditLog.create({
    data: {
      userId,
      action,
      entityType: entityType || null,
      entityId: entityId || null,
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
      details: details ? JSON.stringify(details) : null,
    }
  });
}
