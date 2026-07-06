// ============================================================
// generate-mfa-code.ts — Genera un código TOTP válido para un usuario
// Lee el mfaSecret encriptado de la DB, lo desencripta y genera el
// código TOTP actual de 6 dígitos.
// ============================================================

import { authenticator } from '@otplib/preset-default';
import { db } from '../src/lib/db';
import { decryptSecret } from '../src/lib/auth.config';

async function main() {
  const email = process.argv[2] || 'admin@control.com';

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      mfaEnabled: true,
      mfaSecret: true,
      mfaEnrolledAt: true,
      mfaBackupCodesHash: true,
    },
  });

  if (!user) {
    console.error(`❌ Usuario no encontrado: ${email}`);
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════');
  console.log('  CÓDIGO MFA PARA ACCESO AL SISTEMA');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Usuario:  ${user.email}`);
  console.log(`  Nombre:   ${user.name}`);
  console.log(`  Rol:      ${user.role}`);
  console.log(`  MFA:      ${user.mfaEnabled ? '✅ Habilitado' : '❌ Deshabilitado'}`);

  if (!user.mfaEnabled || !user.mfaSecret) {
    console.log('');
    console.log('  ⚠️  MFA NO está habilitado para este usuario.');
    console.log('  No debería pedírsele código. Revisa si el login funciona sin MFA.');
    process.exit(0);
  }

  // Desencriptar el secreto
  const secret = decryptSecret(user.mfaSecret);
  console.log(`  Secreto:  ${secret} (desencriptado)`);
  console.log(`  Enrolado: ${user.mfaEnrolledAt?.toISOString() || 'N/A'}`);

  // Generar código TOTP actual
  const token = authenticator.generate(secret);
  const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);

  console.log('');
  console.log('┌─────────────────────────────────────────────┐');
  console.log(`│                                             │`);
  console.log(`│           CÓDIGO DE ACCESO:  ${token}           │`);
  console.log(`│                                             │`);
  console.log(`│  ⏱  Válido por: ${remaining} segundos                  │`);
  console.log(`│                                             │`);
  console.log('└─────────────────────────────────────────────┘');
  console.log('');
  console.log('  Ingresa este código en la pantalla de verificación.');
  console.log('  Si expira, ejecuta este script de nuevo.');
  console.log('');

  // Mostrar códigos de respaldo si los hay (no los podemos desencriptar, son hash)
  if (user.mfaBackupCodesHash) {
    const count = JSON.parse(user.mfaBackupCodesHash).length;
    console.log(`  📋 Códigos de respaldo restantes: ${count} (hash, no legibles)`);
  }

  // Generar otpauth URI por si quiere añadirlo a una app
  const issuer = encodeURIComponent('Control de Asistencia NOM-037');
  const label = encodeURIComponent(`Control de Asistencia:${user.email}`);
  const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  console.log('');
  console.log('  🔗 URI otpauth (para añadir a app autenticadora):');
  console.log(`  ${uri}`);
  console.log('═══════════════════════════════════════════════');
}

main()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
