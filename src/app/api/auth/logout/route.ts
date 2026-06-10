import { NextRequest, NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/auth';
import { getAuthenticatedUser } from '@/lib/auth-helper';

export async function POST(request: NextRequest) {
  try {
    const currentUser = getAuthenticatedUser(request);
    if (currentUser) {
      await createAuditLog(currentUser.id, 'LOGOUT', request, 'USER', currentUser.id);
    }

    const response = NextResponse.json({ message: 'Sesión cerrada' });
    response.cookies.set('session_user', '', {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    // Also clear the auth-token cookie set by quick-login
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
