import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, createAuditLog } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 });
    }

    const user = await db.user.findUnique({ 
      where: { email }
    });

    if (!user) {
      // Check if this might be a Supabase connection issue
      const isVercel = !!process.env.VERCEL;
      const hasSbKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (isVercel && hasSbKey) {
        // On Vercel with Supabase - keys might be invalid
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
          const testClient = createClient(sbUrl, sbKey, { auth: { autoRefreshToken: false, persistSession: false } });
          const { error: testError } = await testClient.from('users').select('id').limit(1);
          if (testError && testError.message.includes('Invalid API key')) {
            return NextResponse.json({ 
              error: 'Error de conexión con la base de datos. Las claves API de Supabase son inválidas. Contacte al administrador para actualizar las claves en Vercel.',
              code: 'INVALID_SUPABASE_KEYS'
            }, { status: 503 });
          }
        } catch { /* ignore test failure */ }
      }
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await createAuditLog(user.id, 'LOGIN_FAILED', request, 'USER', user.id);
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    await createAuditLog(user.id, 'LOGIN', request, 'USER', user.id, { method: 'PASSWORD' });

    // Fetch employee separately for better compatibility
    let employee = null;
    if (user.role === 'EMPLOYEE') {
      const emp = await db.employee.findUnique({
        where: { userId: user.id }
      });
      if (emp) {
        employee = {
          id: emp.id,
          employeeNumber: emp.employeeNumber,
          position: emp.position,
          department: emp.department,
          sucursal: emp.sucursal || 'Matriz',
        };
      } else {
        // Employee record is missing — this is a data integrity issue
        console.error(`[auth] Employee record missing for user ${user.id} (${user.email}). The employee needs to be created by an admin.`);
        // Still allow login but flag the missing record
        // The frontend will show appropriate warnings
      }
    }

    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      employee
    };

    const response = NextResponse.json({ user: userData });
    response.cookies.set('session_user', JSON.stringify(userData), {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    
    // Check if this is a database connection error
    const isVercel = !!process.env.VERCEL;
    const hasSbUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasSbKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (isVercel && hasSbUrl && !hasSbKey) {
      return NextResponse.json({ 
        error: 'Error de configuración: Las claves API de Supabase no están configuradas en Vercel. Ve a Settings > Environment Variables y agrega SUPABASE_SERVICE_ROLE_KEY y NEXT_PUBLIC_SUPABASE_ANON_KEY con los valores del dashboard de Supabase (Project Settings > API).',
        code: 'MISSING_SUPABASE_KEYS'
      }, { status: 503 });
    }
    
    if (isVercel && hasSbKey) {
      return NextResponse.json({ 
        error: 'Error de conexión con la base de datos. Las claves API de Supabase pueden ser inválidas. Ve a supabase.com/dashboard > Project Settings > API para obtener las claves actualizadas, y actualízalas en Vercel (Settings > Environment Variables).',
        code: 'SUPABASE_CONNECTION_ERROR'
      }, { status: 503 });
    }
    
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
