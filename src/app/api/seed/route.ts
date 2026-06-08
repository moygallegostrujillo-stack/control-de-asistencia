import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST() {
  try {
    // Create admin user
    const adminEmail = 'admin@asistencias.com';
    const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } });
    
    if (!existingAdmin) {
      const hashedPassword = await hashPassword('Admin123!');
      await db.user.create({
        data: {
          email: adminEmail,
          passwordHash: hashedPassword,
          name: 'Administrador General',
          role: 'ADMIN',
          isActive: true,
        }
      });
    }

    // Create default "Matriz" sucursal if it doesn't exist
    const existingMatriz = await db.sucursal.findUnique({ where: { name: 'Matriz' } });
    if (!existingMatriz) {
      await db.sucursal.create({
        data: {
          name: 'Matriz',
          address: 'Oficina Principal',
          isActive: true,
        }
      });
    }

    // Sample employees are no longer auto-created.
    // The admin should register employees manually through the UI.

    return NextResponse.json({ 
      message: 'Base de datos inicializada correctamente',
      admin: { email: 'admin@asistencias.com', password: 'Admin123!' },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Error al inicializar la base de datos' }, { status: 500 });
  }
}
