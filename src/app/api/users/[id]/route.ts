import { NextResponse } from 'next/server';
import { getCurrentUser, hasRole, hashPassword, generatePassword } from '@/lib/auth';
import { getUserById, updateUserRole, updateUserPassword, deleteUser, deleteUserSessions, type UserRole } from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/users/[id] - Get single user (admin only)
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (!hasRole(currentUser.role, 'admin')) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const user = getUserById(parseInt(id));
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Don't return password hash
  const { password_hash: _, ...safeUser } = user;
  return NextResponse.json({ user: safeUser });
}

// PATCH /api/users/[id] - Update user role (admin only)
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const userId = parseInt(id);
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (!hasRole(currentUser.role, 'admin')) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  // Can't modify yourself
  if (currentUser.id === userId) {
    return NextResponse.json({ error: 'Cannot modify your own account' }, { status: 400 });
  }

  const user = getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { role, resetPassword } = body;

    if (role) {
      const validRoles: UserRole[] = ['view', 'edit', 'admin'];
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      updateUserRole(userId, role);
    }

    let newPassword: string | undefined;
    if (resetPassword) {
      // Generate new password and update
      newPassword = generatePassword();
      const hash = await hashPassword(newPassword);
      updateUserPassword(userId, hash);
      deleteUserSessions(userId);
    }

    return NextResponse.json({
      success: true,
      ...(newPassword && { 
        password: newPassword,
        message: 'Password reset. Send this to the user - it will not be shown again.',
      }),
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Delete user (admin only)
export async function DELETE(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const userId = parseInt(id);
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (!hasRole(currentUser.role, 'admin')) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  // Can't delete yourself
  if (currentUser.id === userId) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  const user = getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  try {
    deleteUser(userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
