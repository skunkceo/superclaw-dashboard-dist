import { NextResponse } from 'next/server';
import { login, needsSetup } from '@/lib/auth';

export async function POST(request: Request) {
  // Check if setup is needed first
  if (needsSetup()) {
    return NextResponse.json(
      { error: 'No users exist. Run `superclaw setup` to create the first admin.' },
      { status: 403 }
    );
  }

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const result = await login(email, password);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      user: result.user 
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
