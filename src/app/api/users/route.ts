import { NextResponse } from 'next/server';
import { getCurrentUser, hasRole, registerUser, generatePassword, roleDescriptions } from '@/lib/auth';
import { getAllUsers, type UserRole } from '@/lib/db';

// GET /api/users - List all users (admin only)
export async function GET() {
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (!hasRole(currentUser.role, 'admin')) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const users = getAllUsers();
  return NextResponse.json({ 
    users,
    roleDescriptions,
  });
}

// POST /api/users - Create new user (admin only)
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (!hasRole(currentUser.role, 'admin')) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, role } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const validRoles: UserRole[] = ['view', 'edit', 'admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Generate a strong password
    const password = generatePassword();
    
    const result = await registerUser(email, password, role, currentUser.id);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      userId: result.userId,
      email,
      role,
      password, // Only returned on creation - user must save it!
      message: 'User created. Send them this password - it will not be shown again.',
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
