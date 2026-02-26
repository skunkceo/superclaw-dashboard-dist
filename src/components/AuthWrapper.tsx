'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { LobsterLogo } from './LobsterLogo';

type UserRole = 'view' | 'edit' | 'admin';

interface User {
  id: number;
  email: string;
  role: UserRole;
  created_at: number;
  last_login: number | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  hasRole: () => false,
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthWrapperProps {
  children: ReactNode;
  requiredRole?: UserRole;
}

const roleHierarchy: Record<UserRole, number> = {
  view: 1,
  edit: 2,
  admin: 3,
};

export function AuthWrapper({ children, requiredRole = 'view' }: AuthWrapperProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();

        if (data.needsSetup || !data.authenticated) {
          if (pathname !== '/login') {
            router.push('/login');
          }
          setLoading(false);
          return;
        }

        setUser(data.user);
      } catch {
        if (pathname !== '/login') {
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [pathname, router]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/login');
  };

  const hasRole = (role: UserRole): boolean => {
    if (!user) return false;
    return roleHierarchy[user.role] >= roleHierarchy[role];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <LobsterLogo className="w-16 h-16 animate-pulse" />
      </div>
    );
  }

  // If on login page, just render children
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Check if user has required role
  if (user && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-zinc-400 mb-4">
            You need {requiredRole} access to view this page.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}
