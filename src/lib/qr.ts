// ============================================================
// QR Dinámico — HMAC-SHA256
// Formato: NOM037:<hex>:<epochSeconds>:<hmac>
// ============================================================

import crypto from 'crypto';

const SECRET = process.env.QR_HMAC_SECRET || 'dev-secret-change-in-production-32b';
const EXPIRY_SECONDS = 5 * 60; // 5 minutos

export function generateQRToken(): { code: string; expiresAt: Date } {
  const randomHex = crypto.randomBytes(16).toString('hex');
  const epoch = Math.floor(Date.now() / 1000);
  const payload = `${randomHex}:${epoch}`;
  const hmac = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  const code = `NOM037:${randomHex}:${epoch}:${hmac}`;
  const expiresAt = new Date((epoch + EXPIRY_SECONDS) * 1000);
  return { code, expiresAt };
}

export function validateQRToken(code: string): { valid: boolean; reason?: string } {
  const parts = code.split(':');
  if (parts.length !== 4 || parts[0] !== 'NOM037') {
    return { valid: false, reason: 'Formato inválido' };
  }
  const [, randomHex, epochStr, hmac] = parts;
  const epoch = parseInt(epochStr, 10);
  if (isNaN(epoch)) {
    return { valid: false, reason: 'Timestamp inválido' };
  }
  // Verificar expiración
  const now = Math.floor(Date.now() / 1000);
  if (now - epoch > EXPIRY_SECONDS) {
    return { valid: false, reason: 'Código expirado' };
  }
  // Verificar HMAC
  const payload = `${randomHex}:${epochStr}`;
  const expectedHmac = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  if (hmac !== expectedHmac) {
    return { valid: false, reason: 'Firma inválida' };
  }
  return { valid: true };
}

/**
 * Genera un QR estático por empleado (basado en employeeNumber + HMAC).
 */
export function generateStaticEmployeeQR(employeeNumber: string): string {
  const payload = `EMP:${employeeNumber}`;
  const hmac = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${payload}:${hmac}`;
}

export function validateStaticEmployeeQR(code: string): { valid: boolean; employeeNumber?: string } {
  const parts = code.split(':');
  if (parts.length !== 3 || parts[0] !== 'EMP') {
    return { valid: false };
  }
  const [, employeeNumber, hmac] = parts;
  const payload = `EMP:${employeeNumber}`;
  const expectedHmac = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  if (hmac !== expectedHmac) {
    return { valid: false };
  }
  return { valid: true, employeeNumber };
}
