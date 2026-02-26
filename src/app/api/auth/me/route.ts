import { NextResponse } from 'next/server';
import { getCurrentUser, needsSetup } from '@/lib/auth';

export async function GET() {
  // Check if setup is needed
  if (needsSetup()) {
    return NextResponse.json({
      needsSetup: true,
      authenticated: false,
      user: null,
    });
  }

  const user = await getCurrentUser();
  
  if (!user) {
    return NextResponse.json({
      needsSetup: false,
      authenticated: false,
      user: null,
    });
  }

  return NextResponse.json({
    needsSetup: false,
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
      last_login: user.last_login,
    },
  });
}
