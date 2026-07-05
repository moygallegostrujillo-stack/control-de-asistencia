// ============================================================
// NextAuth.js v4 — Config & Types (Phase A)
// ============================================================
// Estrategia: JWT firmado con NEXTAUTH_SECRET (HMAC-SHA512).
// Esto reemplaza la cookie base64 sin firma anterior.
//
// Backward-compat: el middleware y getAuthUser() aceptan AMBOS:
//   1. JWT de NextAuth (next-auth.session-token) — preferido
//   2. Cookie legacy `session_user` (base64 JSON) — transición
//
// MFA: TOTP (RFC 6238) opcional para admins, usando otplib.
// ============================================================

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { authenticator } from '@otplib/preset-default';
import { db } from './db';
import { auditLog, getIpAndUA } from './audit';
import { getMexicoNow } from './timezone';

export const SESSION_MAX_AGE = 8 * 3600; // 8 horas
export const REFRESH_INTERVAL = 30 * 60; // rotar JWT cada 30 min

export interface SessionPayload {
  id: string;
  email: string;
  name: string;
  role: 'GENERAL_ADMIN' | 'SUCURSAL_ADMIN' | 'SUPERVISOR' | 'EMPLOYEE';
  sucursalId: string | null;
  employeeId: string | null;
  sucursalName?: string | null;
  sucursalCodigoLocal?: string | null;
  mfaVerified?: boolean;
  // Rotación de sesión
  iat?: number;
  exp?: number;
}

/**
 * Valida credenciales (email + password + opcional MFA TOTP o backup code).
 * Retorna el payload del usuario o null.
 *
 * MFA: si el usuario tiene MFA activo, debe proveer `mfaToken` (TOTP 6 dígitos)
 * o `backupCode` (código de respaldo de un solo uso). Si no viene ninguno,
 * retorna `{ needsMfa: true }` para que el caller pida el segundo factor.
 *
 * Backup codes: son case-insensitive (se normalizan a upper-case). Si se
 * encuentra un match, se remueve el hash correspondiente del array en DB
 * (one-time use).
 */
export async function validateCredentials(
  email: string,
  password: string,
  mfaToken?: string,
  req?: any,
  backupCode?: string
): Promise<{ user: SessionPayload | null; error?: string; needsMfa?: boolean }> {
  const normalizedEmail = email.toLowerCase().trim();
  const now = getMexicoNow().toJSDate();

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    include: { sucursal: true, employee: true },
  });

  if (!user) {
    return { user: null, error: 'Credenciales inválidas' };
  }

  if (!user.isActive) {
    return { user: null, error: 'Usuario inactivo. Contacta al administrador.' };
  }

  // Lockout check
  if (user.lockedUntil && user.lockedUntil > now) {
    const mins = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000);
    return { user: null, error: `Cuenta bloqueada. Intenta en ${mins} min.` };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    const lock = attempts >= 5;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: lock ? new Date(Date.now() + 15 * 60_000) : null,
      },
    });

    const { ip, ua } = req ? getIpAndUA(req) : { ip: null, ua: null };
    await auditLog({
      userId: user.id,
      action: 'LOGIN_FAILED',
      entityType: 'User',
      entityId: user.id,
      sucursalId: user.sucursalId || undefined,
      ipAddress: ip || undefined,
      userAgent: ua || undefined,
    }).catch(() => {});

    return { user: null, error: 'Credenciales inválidas' };
  }

  // MFA verification (si está habilitado)
  if (user.mfaEnabled && user.mfaSecret) {
    // Si no viene ni TOTP ni backup code → pedir segundo factor
    if (!mfaToken && !backupCode) {
      return { user: null, needsMfa: true, error: 'Se requiere código MFA' };
    }

    // 1. Probar TOTP primero (si viene)
    let mfaVerified = false;
    if (mfaToken) {
      try {
        const secret = decryptSecret(user.mfaSecret);
        mfaVerified = authenticator.verify({ token: mfaToken, secret });
      } catch {
        // Continuar al fallback de backup code si también vino uno
      }
      if (!mfaVerified) {
        // Si el token vino pero es inválido y no hay backup code, error claro
        if (!backupCode) {
          return { user: null, error: 'Código MFA inválido' };
        }
      }
    }

    // 2. Fallback (o ruta principal) — backup code
    if (!mfaVerified && backupCode) {
      const codes: string[] = user.mfaBackupCodesHash
        ? (() => { try { return JSON.parse(user.mfaBackupCodesHash); } catch { return []; } })()
        : [];
      const normalized = backupCode.trim().toUpperCase();
      let matchedHash: string | null = null;
      for (const hash of codes) {
        try {
          if (await bcrypt.compare(normalized, hash)) {
            matchedHash = hash;
            break;
          }
        } catch {
          // hash corrupto — seguir
        }
      }
      if (matchedHash) {
        // One-time use: remover el hash consumido
        const remaining = codes.filter((h) => h !== matchedHash);
        await db.user.update({
          where: { id: user.id },
          data: { mfaBackupCodesHash: JSON.stringify(remaining) },
        });
        mfaVerified = true;
      } else {
        return { user: null, error: 'Código de respaldo inválido' };
      }
    }

    if (!mfaVerified) {
      return { user: null, error: 'Código MFA inválido' };
    }
  }

  // Reset failed attempts + update lastLogin
  await db.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: now,
    },
  });

  const payload: SessionPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as SessionPayload['role'],
    sucursalId: user.sucursalId,
    employeeId: user.employee?.id ?? null,
    sucursalName: user.sucursal?.name ?? null,
    sucursalCodigoLocal: user.sucursal?.codigoLocal ?? null,
    mfaVerified: !!(user.mfaEnabled && user.mfaSecret),
  };

  return { user: payload };
}

// ============================================================
// Encriptación del secreto TOTP (AES-256-GCM)
// ============================================================

import crypto from 'crypto';

const MFA_ENC_KEY = process.env.NEXTAUTH_SECRET || 'fallback-dev-key-not-secure';

function deriveKey(): Buffer {
  return crypto.createHash('sha256').update(MFA_ENC_KEY).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(stored: string): string {
  const buf = Buffer.from(stored, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

/**
 * Genera un secreto TOTP nuevo para un usuario.
 */
export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Verifica un token TOTP contra un secreto.
 */
export function verifyMfaToken(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/**
 * Construye el otpauth:// URI para QR code.
 */
export function buildOtpauthUri(email: string, secret: string): string {
  const issuer = encodeURIComponent('Control de Asistencia');
  const label = encodeURIComponent(`Control de Asistencia:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Genera 10 códigos de backup (hashed con bcrypt para almacenamiento).
 */
export function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  for (let i = 0; i < 10; i++) {
    plain.push(crypto.randomBytes(5).toString('hex').toUpperCase().replace(/(.{4})/g, '$1-').slice(0, -1));
  }
  return { plain, hashed: plain.map((c) => bcrypt.hashSync(c, 10)) };
}

// ============================================================
// NextAuth Options
// ============================================================

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        mfaToken: { label: 'MFA Token', type: 'text' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;
        const result = await validateCredentials(
          credentials.email,
          credentials.password,
          credentials.mfaToken,
          req
        );
        if (result.error || !result.user) return null;
        return result.user as any;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE,
    updateAge: REFRESH_INTERVAL,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE,
  },
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      // Inicializar token con datos del usuario en primer login
      if (user) {
        const u = user as unknown as SessionPayload;
        token.id = u.id;
        token.email = u.email;
        token.name = u.name;
        token.role = u.role;
        token.sucursalId = u.sucursalId;
        token.employeeId = u.employeeId;
        token.sucursalName = u.sucursalName;
        token.sucursalCodigoLocal = u.sucursalCodigoLocal;
        token.mfaVerified = u.mfaVerified ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).sucursalId = token.sucursalId;
        (session.user as any).employeeId = token.employeeId;
        (session.user as any).sucursalName = token.sucursalName;
        (session.user as any).sucursalCodigoLocal = token.sucursalCodigoLocal;
        (session.user as any).mfaVerified = token.mfaVerified;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: false,
};

/**
 * Tipos extendidos para NextAuth.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: 'GENERAL_ADMIN' | 'SUCURSAL_ADMIN' | 'SUPERVISOR' | 'EMPLOYEE';
      sucursalId: string | null;
      employeeId: string | null;
      sucursalName?: string | null;
      sucursalCodigoLocal?: string | null;
      mfaVerified?: boolean;
    };
  }
  interface User {
    role?: 'GENERAL_ADMIN' | 'SUCURSAL_ADMIN' | 'SUPERVISOR' | 'EMPLOYEE';
    sucursalId?: string | null;
    employeeId?: string | null;
    mfaVerified?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: 'GENERAL_ADMIN' | 'SUCURSAL_ADMIN' | 'SUPERVISOR' | 'EMPLOYEE';
    sucursalId?: string | null;
    employeeId?: string | null;
    sucursalName?: string | null;
    sucursalCodigoLocal?: string | null;
    mfaVerified?: boolean;
  }
}
