import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth-helper';

export async function GET(request: NextRequest) {
  try {
    const user = getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    return NextResponse.json({ user });
  } catch {
    return unauthorizedResponse();
  }
}
