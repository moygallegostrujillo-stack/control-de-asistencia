// Verifica todos los usuarios y su estado MFA en la DB local
import { db } from '../src/lib/db';

async function main() {
  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      mfaEnabled: true,
      mfaSecret: true,
      mfaEnrolledAt: true,
      lockedUntil: true,
      failedLoginAttempts: true,
    },
    orderBy: { email: 'asc' },
  });

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  USUARIOS EN DB LOCAL (SQLite)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total: ${users.length} usuarios\n`);

  for (const u of users) {
    const status = u.isActive ? '✅ Activo' : '❌ Inactivo';
    const mfa = u.mfaEnabled ? '🔐 MFA ON' : '🔓 MFA OFF';
    const locked = u.lockedUntil && u.lockedUntil > new Date() ? `🔒 LOCKED (${u.failedLoginAttempts} intentos)` : '';
    console.log(`  ${u.email.padEnd(35)} | ${u.role.padEnd(15)} | ${status} | ${mfa} ${locked}`);
  }

  const mfaUsers = users.filter((u) => u.mfaEnabled);
  if (mfaUsers.length > 0) {
    console.log('\n⚠️  Usuarios CON MFA habilitado (necesitan código TOTP):');
    for (const u of mfaUsers) {
      console.log(`   - ${u.email}`);
    }
  } else {
    console.log('\n✅ NINGÚN usuario tiene MFA habilitado en la DB local.');
    console.log('   Si ves la pantalla 2FA, estás viendo PRODUCCIÓN (Vercel) o un estado cacheado del navegador.');
  }
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(console.error).finally(() => db.$disconnect());
