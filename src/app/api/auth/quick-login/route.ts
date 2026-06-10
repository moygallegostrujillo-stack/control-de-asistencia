import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-key-change-in-production');

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido' }, { status: 400 });
    }

    // Find the user
    const user = await db.user.findUnique({
      where: { id: userId, isActive: true },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        employee: {
          select: {
            id: true,
            employeeNumber: true,
            department: true,
            position: true,
            sucursal: true,
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Create JWT token
    const token = await new SignJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('8h')
      .setIssuedAt()
      .sign(JWT_SECRET);

    // Build user response object
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      employee: user.employee ? {
        id: user.employee.id,
        employeeNumber: user.employee.employeeNumber,
        department: user.employee.department,
        position: user.employee.position,
        sucursal: user.employee.sucursal,
      } : null
    };

    const response = NextResponse.json({
      success: true,
      user: userResponse,
    });

    // Set the auth token cookie (JWT for server verification)
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/',
    });

    // Also set the session_user cookie (for getAuthenticatedUser compatibility)
    response.cookies.set('session_user', JSON.stringify(userResponse), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60, // 8 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Quick login error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
