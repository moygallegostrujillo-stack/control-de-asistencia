// ============================================================
// clean-prod-db.ts
// Limpia COMPLETAMENTE la base de datos de producción.
//
// Conserva ÚNICAMENTE:
//   - El usuario GENERAL_ADMIN (admin@control.com)
//   - Restablece sus campos de seguridad (MFA, intentos fallidos, lock)
//
// Borra TODO lo demás:
//   - Company, Users (no-admin), Sucursales, Employees, WorkSchedules,
//     AttendanceRecords, Vacations, Holidays, AuditLogs, DynamicQRs
//
// Nota: NO usa $transaction porque el pooler de Supabase (pgbouncer)
//       no soporta transacciones interactivas largas. Cada delete es
//       autocommit, lo cual es seguro porque el orden respeta las FKs.
//
// Uso:
//   bun run scripts/clean-prod-db.ts            → dry-run
//   bun run scripts/clean-prod-db.ts --confirm  → ejecuta
// ============================================================

import { PrismaClient } from '@prisma/client';

const CONFIRM = process.argv.includes('--confirm');

async function main() {
  const db = new PrismaClient({ log: ['error', 'warn'] });

  console.log('='.repeat(60));
  console.log('  LIMPIEZA DE BASE DE DATOS DE PRODUCCIÓN');
  console.log('='.repeat(60));
  console.log(`   DB host: ${new URL(process.env.DATABASE_URL || '').host}`);
  console.log(`   Modo: ${CONFIRM ? '🔴 EJECUTAR (confirmado)' : '🟡 SIMULACIÓN (dry-run)'}`);
  console.log('');

  // 1. Verificar que existe el admin a conservar
  const adminEmail = 'admin@control.com';
  const admin = await db.user.findFirst({
    where: { email: adminEmail, role: 'GENERAL_ADMIN' },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  if (!admin) {
    console.error(`❌ ERROR: No se encontró el usuario GENERAL_ADMIN con email ${adminEmail}.`);
    console.error('   Por seguridad, el script NO continúa sin un admin que conservar.');
    process.exit(1);
  }

  console.log(`✅ Admin que se conservará:`);
  console.log(`   - ID:    ${admin.id}`);
  console.log(`   - Email: ${admin.email}`);
  console.log(`   - Name:  ${admin.name}`);
  console.log(`   - Role:  ${admin.role}`);
  console.log('');

  // 2. Contar registros antes de la limpieza
  console.log('📊 Registros ANTES de la limpieza:');
  const before = {
    companies: await db.company.count(),
    users: await db.user.count(),
    sucursales: await db.sucursal.count(),
    employees: await db.employee.count(),
    workSchedules: await db.workSchedule.count(),
    attendanceRecords: await db.attendanceRecord.count(),
    vacations: await db.vacation.count(),
    holidays: await db.holiday.count(),
    auditLogs: await db.auditLog.count(),
    dynamicQRs: await db.dynamicQR.count(),
  };
  Object.entries(before).forEach(([k, v]) => console.log(`   - ${k.padEnd(20)} ${v}`));
  console.log('');

  if (!CONFIRM) {
    console.log('⚠️  MODO SIMULACIÓN: No se borrará nada.');
    console.log('   Para ejecutar la limpieza real, agrega --confirm:');
    console.log('   bun run scripts/clean-prod-db.ts --confirm');
    await db.$disconnect();
    return;
  }

  // 3. Ejecutar limpieza — SIN transacción (pgbouncer no la soporta bien)
  //    Orden respeta foreign keys: hijos primero, padres al final.
  console.log('🧹 Ejecutando limpieza...');

  // 3.1 Desvincular referencias al admin en tablas que lo mencionan
  //     (AuditLog.userId es nullable con onDelete: SetNull — se seteará a null automáticamente)
  //     (Vacation.requestedById es obligatoria — pero se borran todas las vacations)

  // 3.2 Hijos sin dependencias circulares
  console.log('   - Borrando DynamicQRs...');
  const qrDeleted = await db.dynamicQR.deleteMany({});
  console.log(`     ${qrDeleted.count} eliminados`);

  console.log('   - Borrando AuditLogs...');
  const auditDeleted = await db.auditLog.deleteMany({});
  console.log(`     ${auditDeleted.count} eliminados`);

  console.log('   - Borrando Vacations...');
  const vacDeleted = await db.vacation.deleteMany({});
  console.log(`     ${vacDeleted.count} eliminados`);

  console.log('   - Borrando AttendanceRecords...');
  const attDeleted = await db.attendanceRecord.deleteMany({});
  console.log(`     ${attDeleted.count} eliminados`);

  console.log('   - Borrando WorkSchedules...');
  const wsDeleted = await db.workSchedule.deleteMany({});
  console.log(`     ${wsDeleted.count} eliminados`);

  console.log('   - Borrando Holidays...');
  const holDeleted = await db.holiday.deleteMany({});
  console.log(`     ${holDeleted.count} eliminados`);

  console.log('   - Borrando Employees...');
  const empDeleted = await db.employee.deleteMany({});
  console.log(`     ${empDeleted.count} eliminados`);

  // 3.3 Users: borrar todos EXCEPTO el admin general
  //     (Esto debe ir ANTES de borrar sucursales porque User.sucursalId → Sucursal.id)
  console.log('   - Borrando Users (excepto admin general)...');
  const userDeleted = await db.user.deleteMany({
    where: { id: { not: admin.id } },
  });
  console.log(`     ${userDeleted.count} eliminados`);

  // 3.4 Sucursales
  console.log('   - Borrando Sucursales...');
  const sucDeleted = await db.sucursal.deleteMany({});
  console.log(`     ${sucDeleted.count} eliminados`);

  // 3.5 Company (singleton)
  console.log('   - Borrando Company...');
  const compDeleted = await db.company.deleteMany({});
  console.log(`     ${compDeleted.count} eliminados`);

  // 3.6 Resetear campos de seguridad del admin (operación independiente)
  console.log('   - Resetando campos de seguridad del admin...');
  await db.user.update({
    where: { id: admin.id },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodesHash: null,
      mfaEnrolledAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      sucursalId: null,
      isActive: true,
    },
  });
  console.log('     Admin reseteado (MFA off, intentos=0, sucursalId=null)');

  // 4. Verificar después
  console.log('');
  console.log('📊 Registros DESPUÉS de la limpieza:');
  const after = {
    companies: await db.company.count(),
    users: await db.user.count(),
    sucursales: await db.sucursal.count(),
    employees: await db.employee.count(),
    workSchedules: await db.workSchedule.count(),
    attendanceRecords: await db.attendanceRecord.count(),
    vacations: await db.vacation.count(),
    holidays: await db.holiday.count(),
    auditLogs: await db.auditLog.count(),
    dynamicQRs: await db.dynamicQR.count(),
  };
  Object.entries(after).forEach(([k, v]) => console.log(`   - ${k.padEnd(20)} ${v}`));
  console.log('');

  const remainingAdmin = await db.user.findFirst({
    where: { email: adminEmail },
    select: { email: true, name: true, role: true, isActive: true, mfaEnabled: true, sucursalId: true, failedLoginAttempts: true },
  });
  console.log('✅ Admin restante:');
  console.log(`   ${JSON.stringify(remainingAdmin, null, 2)}`);

  console.log('');
  console.log('='.repeat(60));
  console.log('  ✅ LIMPIEZA COMPLETADA');
  console.log('  La BD está lista para registrar una nueva empresa.');
  console.log(`  Credenciales admin: ${adminEmail} / (sin cambios)`);
  console.log('='.repeat(60));

  await db.$disconnect();
}

main().catch((err) => {
  console.error('❌ Error durante la limpieza:', err);
  process.exit(1);
});
