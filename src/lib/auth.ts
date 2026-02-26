import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { 
  getUserByEmail, 
  getUserById, 
  createUser, 
  updateLastLogin, 
  createSession, 
  getSession, 
  deleteSession,
  getUserCount,
  type UserRole,
  type User 
} from './db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.SUPERCLAW_JWT_SECRET || 'superclaw-default-secret-change-me'
);
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const SALT_ROUNDS = 12;

// Generate a secure random password
export function generatePassword(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

// Generate a session ID
function generateSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Create JWT token
async function createToken(sessionId: string): Promise<string> {
  return new SignJWT({ sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(JWT_SECRET);
}

// Verify JWT token
async function verifyToken(token: string): Promise<{ sessionId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { sessionId: string };
  } catch {
    return null;
  }
}

// Login user
export async function login(email: string, password: string): Promise<{ success: boolean; error?: string; user?: Omit<User, 'password_hash'> }> {
  const user = getUserByEmail(email);
  if (!user) {
    return { success: false, error: 'Invalid email or password' };
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return { success: false, error: 'Invalid email or password' };
  }

  // Create session
  const sessionId = generateSessionId();
  const expiresAt = Date.now() + SESSION_DURATION;
  createSession(user.id, sessionId, expiresAt);
  updateLastLogin(user.id);

  // Create JWT and set cookie
  const token = await createToken(sessionId);
  const cookieStore = await cookies();
  cookieStore.set('superclaw_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });

  return { 
    success: true, 
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
      last_login: user.last_login,
      created_by: user.created_by,
    }
  };
}

// Logout user
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get('superclaw_session')?.value;
  
  if (token) {
    const payload = await verifyToken(token);
    if (payload?.sessionId) {
      deleteSession(payload.sessionId);
    }
  }
  
  cookieStore.delete('superclaw_session');
}

// Get current user from session
export async function getCurrentUser(): Promise<(Omit<User, 'password_hash'> & { sessionId: string }) | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('superclaw_session')?.value;
  
  if (!token) return null;
  
  const payload = await verifyToken(token);
  if (!payload?.sessionId) return null;
  
  const session = getSession(payload.sessionId);
  if (!session) return null;
  
  return { ...session.user, sessionId: session.id };
}

// Check if user has required role
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    view: 1,
    edit: 2,
    admin: 3,
  };
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

// Register new user (admin only or first user)
export async function registerUser(
  email: string, 
  password: string, 
  role: UserRole, 
  createdBy?: number
): Promise<{ success: boolean; error?: string; userId?: number }> {
  const existing = getUserByEmail(email);
  if (existing) {
    return { success: false, error: 'Email already registered' };
  }

  const hash = await hashPassword(password);
  const userId = createUser(email, hash, role, createdBy);
  
  return { success: true, userId };
}

// Check if initial setup is needed
export function needsSetup(): boolean {
  return getUserCount() === 0;
}

// Role descriptions for UI
export const roleDescriptions: Record<UserRole, string> = {
  view: 'Can view dashboard and chat with OpenClaw',
  edit: 'Can also edit workspace files (SOUL.md, etc.)',
  admin: 'Full access including user management',
};
