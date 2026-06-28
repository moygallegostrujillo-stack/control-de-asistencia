import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed v2.2...');

  // 1. Company (singleton) — fix #3
  console.log('  → Company');
  await prisma.company.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      razonSocial: 'Mi Empresa S.A. de C.V.',
      rfc: 'EMP850101AAA',
      registroPatronal: 'Y5556789012',
      domicilioFiscal: 'Av. Reforma 1, Col. Centro, CDMX 06000',
      telefono: '+52 55 1234 5678',
      email: 'contacto@miempresa.com',
      representanteLegal: 'Juan Pérez González',
    },
  });

  // 2. Sucursales — fix #9 (codigoLocal "261" para Matriz)
  console.log('  → Sucursales');
  const matriz = await prisma.sucursal.upsert({
    where: { name: 'Matriz' },
    update: {},
    create: {
      name: 'Matriz',
      codigoLocal: '261',
      address: 'Av. Reforma 1, Col. Centro, CDMX 06000',
      latitude: 19.4326,
      longitude: -99.1332,
      geofenceRadiusMeters: 150,
      enforceGeofence: false,
      mealToleranceMinutes: 5,
      restToleranceMinutes: 3,
      mealDurationMinutes: 30,
      restDurationMinutes: 15,
      checkoutToleranceMinutes: 10,
    },
  });

  const sucursal1 = await prisma.sucursal.upsert({
    where: { name: 'Sucursal 1' },
    update: {},
    create: {
      name: 'Sucursal 1',
      codigoLocal: null,
      address: 'Av. Insurgentes 100, Col. Roma Norte, CDMX 06700',
      latitude: 19.4355,
      longitude: -99.183,
      geofenceRadiusMeters: 150,
      enforceGeofence: false,
      mealToleranceMinutes: 5,
      restToleranceMinutes: 3,
      mealDurationMinutes: 30,
      restDurationMinutes: 15,
      checkoutToleranceMinutes: 10,
    },
  });

  // 3. Holidays 2025 (oficiales México) — fix #1
  console.log('  → Holidays 2025');
  const holidays = [
    { date: new Date('2025-01-01'), name: 'Año Nuevo', description: 'Festivo oficial' },
    { date: new Date('2025-02-03'), name: 'Día de la Constitución', description: 'Primer lunes de febrero' },
    { date: new Date('2025-03-17'), name: 'Natalicio de Benito Juárez', description: 'Tercer lunes de marzo' },
    { date: new Date('2025-05-01'), name: 'Día del Trabajo', description: 'Festivo oficial' },
    { date: new Date('2025-09-16'), name: 'Independencia de México', description: 'Festivo oficial' },
    { date: new Date('2025-11-17'), name: 'Revolución Mexicana', description: 'Tercer lunes de noviembre' },
    { date: new Date('2025-12-25'), name: 'Navidad', description: 'Festivo oficial' },
  ];
  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { date: h.date },
      update: {},
      create: h,
    });
  }

  // 4. Usuarios admin
  console.log('  → Usuarios admin');
  const adminGeneralPwd = await bcrypt.hash('Admin#2025', 12);
  const adminMatrizPwd = await bcrypt.hash('Matriz#2025', 12);
  const adminSuc1Pwd = await bcrypt.hash('Suc1#2025', 12);
  const empleadoPwd = await bcrypt.hash('Empleado#2025', 12);

  const adminGeneral = await prisma.user.upsert({
    where: { email: 'admin@control.com' },
    update: {},
    create: {
      email: 'admin@control.com',
      passwordHash: adminGeneralPwd,
      name: 'Administrador General',
      role: 'GENERAL_ADMIN',
      sucursalId: null,
      isActive: true,
    },
  });

  const adminMatriz = await prisma.user.upsert({
    where: { email: 'admin.matriz@control.com' },
    update: {},
    create: {
      email: 'admin.matriz@control.com',
      passwordHash: adminMatrizPwd,
      name: 'Admin Matriz',
      role: 'SUCURSAL_ADMIN',
      sucursalId: matriz.id,
      isActive: true,
    },
  });

  const adminSuc1 = await prisma.user.upsert({
    where: { email: 'admin.sucursal1@control.com' },
    update: {},
    create: {
      email: 'admin.sucursal1@control.com',
      passwordHash: adminSuc1Pwd,
      name: 'Admin Sucursal 1',
      role: 'SUCURSAL_ADMIN',
      sucursalId: sucursal1.id,
      isActive: true,
    },
  });

  // 5. Empleados (4 Matriz, 4 Sucursal 1) — fix #8 se ordenan por nombre en API
  console.log('  → Empleados');
  const empleadosData = [
    // Matriz (4)
    { name: 'Ana López Martínez', email: 'ana.lopez@control.com', num: 'EMP-001', pos: 'Gerente', dept: 'Administración', suc: matriz.id },
    { name: 'Carlos Ramírez Soto', email: 'carlos.ramirez@control.com', num: 'EMP-002', pos: 'Contador', dept: 'Finanzas', suc: matriz.id },
    { name: 'Beatriz Torres Ruiz', email: 'beatriz.torres@control.com', num: 'EMP-003', pos: 'Asistente', dept: 'Recursos Humanos', suc: matriz.id },
    { name: 'Diego Hernández Vargas', email: 'diego.hernandez@control.com', num: 'EMP-004', pos: 'Analista', dept: 'Operaciones', suc: matriz.id },
    // Sucursal 1 (4)
    { name: 'Elena Castro Mendoza', email: 'elena.castro@control.com', num: 'EMP-005', pos: 'Vendedora', dept: 'Ventas', suc: sucursal1.id },
    { name: 'Fernando Díaz Ortega', email: 'fernando.diaz@control.com', num: 'EMP-006', pos: 'Cajero', dept: 'Ventas', suc: sucursal1.id },
    { name: 'Gabriela Mora Pérez', email: 'gabriela.mora@control.com', num: 'EMP-007', pos: 'Almacenista', dept: 'Logística', suc: sucursal1.id },
    { name: 'Hugo Vázquez Cruz', email: 'hugo.vazquez@control.com', num: 'EMP-008', pos: 'Auxiliar', dept: 'Operaciones', suc: sucursal1.id },
  ];

  for (const e of empleadosData) {
    const user = await prisma.user.upsert({
      where: { email: e.email },
      update: {},
      create: {
        email: e.email,
        passwordHash: empleadoPwd,
        name: e.name,
        role: 'EMPLOYEE',
        isActive: true,
      },
    });

    const employee = await prisma.employee.upsert({
      where: { employeeNumber: e.num },
      update: {},
      create: {
        employeeNumber: e.num,
        position: e.pos,
        department: e.dept,
        sucursalId: e.suc,
        userId: user.id,
        hireDate: new Date('2024-01-15'),
        vacationBalanceDays: 12,
      },
    });

    // Horarios L-V (1-5) 9:00-18:00, tolerancia 10 min; sábado (6) y domingo (0) descanso
    // upsert para que el seed sea idempotente (seguro de correr múltiples veces)
    for (let day = 0; day <= 6; day++) {
      const isWeekday = day >= 1 && day <= 5;
      await prisma.workSchedule.upsert({
        where: { employeeId_dayOfWeek: { employeeId: employee.id, dayOfWeek: day } },
        update: {},
        create: {
          employeeId: employee.id,
          dayOfWeek: day,
          startTime: isWeekday ? '09:00' : '00:00',
          endTime: isWeekday ? '18:00' : '00:00',
          toleranceMinutes: 10,
          isWeeklyRest: !isWeekday,
        },
      });
    }
  }

  console.log('✅ Seed completado:');
  console.log('   • 1 Empresa (singleton)');
  console.log('   • 2 Sucursales (Matriz=codigoLocal 261, Sucursal 1)');
  console.log('   • 7 Días feriados 2025');
  console.log('   • 3 Admins (1 general + 2 sucursal)');
  console.log('   • 8 Empleados con horarios L-V 9-18');
  console.log('');
  console.log('   Admin General:    admin@control.com / Admin#2025');
  console.log('   Admin Matriz:     admin.matriz@control.com / Matriz#2025');
  console.log('   Admin Sucursal 1: admin.sucursal1@control.com / Suc1#2025');
  console.log('   Empleados:        EMP-001..EMP-008 / Empleado#2025');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
