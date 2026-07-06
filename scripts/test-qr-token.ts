import { generateQRToken, validateQRToken } from '../src/lib/qr';

const { code, expiresAt } = generateQRToken();
console.log('=== Token generado ===');
console.log('Código:', code);
console.log('Longitud:', code.length, 'caracteres');
console.log('Expira:', expiresAt.toISOString());
console.log('');

const valid = validateQRToken(code);
console.log('=== Validación ===');
console.log('Válido:', valid.valid, valid.reason ? `(razón: ${valid.reason})` : '');
console.log('');

const truncated = code.substring(0, 60);
const invalidTrunc = validateQRToken(truncated);
console.log('=== Validación de token truncado (60 chars) ===');
console.log('Token truncado:', truncated + '...');
console.log('Válido:', invalidTrunc.valid, `(razón: ${invalidTrunc.reason})`);
console.log('');

const tampered = code.split(':');
tampered[3] = 'a'.repeat(32);
const tamperedCode = tampered.join(':');
const invalidTamper = validateQRToken(tamperedCode);
console.log('=== Validación de token con HMAC alterado ===');
console.log('Válido:', invalidTamper.valid, `(razón: ${invalidTamper.reason})`);
