// ============================================================
// backup-prod-db.ts
// Hace backup completo de la BD de producción (Supabase PostgreSQL)
// Exporta todas las tablas a JSON en backups/prod-backup-YYYY-MM-DD.json
// ============================================================
//
// Uso:
//   DATABASE_URL="<prod-url>" DIRECT_URL="<prod-direct>" \
//   bun run scripts/backup-prod-db.ts
// ============================================================

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const db = new PrismaClient({
    log: ['error', 'warn'],
  });

  const timestamp = new Date().toISOString().split('T')[0];
  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `prod-backup-${timestamp}.json`);

  console.log('📋 Iniciando backup de la base de datos de producción...');
  console.log(`   DB URL host: ${new URL(process.env.DATABASE_URL || '').host}`);

  try {
    const [
      companies,
      users,
      sucursales,
      employees,
      workSchedules,
      attendanceRecords,
      vacations,
      holidays,
      auditLogs,
      dynamicQRs,
    ] = await Promise.all([
      db.company.findMany(),
      db.user.findMany({
        select: {
          id: true, email: true, name: true, role: true, sucursalId: true,
          isActive: true, mfaEnabled: true, mfaEnrolledAt: true,
          lastLoginAt: true, failedLoginAttempts: true, lockedUntil: true,
          createdAt: true, updatedAt: true,
          // Excluir campos sensibles: passwordHash, mfaSecret, mfaBackupCodesHash
        },
      }),
      db.sucursal.findMany(),
      db.employee.findMany(),
      db.workSchedule.findMany(),
      db.attendanceRecord.findMany(),
      db.vacation.findMany(),
      db.holiday.findMany(),
      db.auditLog.findMany(),
      db.dynamicQR.findMany(),
    ]);

    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'production (Supabase PostgreSQL)',
        host: new URL(process.env.DATABASE_URL || '').host,
        counts: {
          companies: companies.length,
          users: users.length,
          sucursales: sucursales.length,
          employees: employees.length,
          workSchedules: workSchedules.length,
          attendanceRecords: attendanceRecords.length,
          vacations: vacations.length,
          holidays: holidays.length,
          auditLogs: auditLogs.length,
          dynamicQRs: dynamicQRs.length,
        },
      },
      data: {
        companies,
        users,
        sucursales,
        employees,
        workSchedules,
        attendanceRecords,
        vacations,
        holidays,
        auditLogs,
        dynamicQRs,
      },
    };

    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

    console.log('\n✅ Backup completado:');
    console.log(`   📁 Archivo: ${backupPath}`);
    console.log(`   📊 Registros respaldados:`);
    console.log(`      - Empresas:       ${backup.metadata.counts.companies}`);
    console.log(`      - Usuarios:       ${backup.metadata.counts.users}`);
    console.log(`      - Sucursales:     ${backup.metadata.counts.sucursales}`);
    console.log(`      - Empleados:      ${backup.metadata.counts.employees}`);
    console.log(`      - Horarios:       ${backup.metadata.counts.workSchedules}`);
    console.log(`      - Asistencias:    ${backup.metadata.counts.attendanceRecords}`);
    console.log(`      - Vacaciones:     ${backup.metadata.counts.vacations}`);
    console.log(`      - Feriados:       ${backup.metadata.counts.holidays}`);
    console.log(`      - Audit logs:     ${backup.metadata.counts.auditLogs}`);
    console.log(`      - QRs dinámicos:  ${backup.metadata.counts.dynamicQRs}`);

    const sizeKB = (fs.statSync(backupPath).size / 1024).toFixed(1);
    console.log(`   💾 Tamaño: ${sizeKB} KB`);
  } catch (err) {
    console.error('❌ Error durante el backup:', err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
