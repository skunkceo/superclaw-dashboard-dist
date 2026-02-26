'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LobsterLogo } from '@/components/LobsterLogo';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check auth status
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(async (data) => {
        if (data.authenticated) {
          // Check if workspace setup is complete before landing on dashboard
          try {
            const statusRes = await fetch('/api/setup/status');
            const statusData = await statusRes.json();
            router.push(statusData.needsSetup ? '/setup' : '/');
          } catch {
            router.push('/');
          }
        } else if (data.needsSetup) {
          setNeedsSetup(true);
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      // Check if workspace setup is complete — redirect to /setup if not
      try {
        const statusRes = await fetch('/api/setup/status');
        const statusData = await statusRes.json();
        if (statusData.needsSetup) {
          router.push('/setup');
          return;
        }
      } catch {
        // If status check fails, proceed to dashboard
      }

      router.push('/');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <LobsterLogo className="w-16 h-16 animate-pulse" />
      </div>
    );
  }

  if (needsSetup) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <LobsterLogo className="w-16 h-16 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white">Welcome to Superclaw</h1>
            <p className="text-zinc-400 mt-2">First-time setup required</p>
          </div>

          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <div className="text-center">
              <div className="text-6xl mb-4">🚀</div>
              <h2 className="text-lg font-semibold text-white mb-2">Setup Required</h2>
              <p className="text-zinc-400 mb-6">
                Run the setup command in your terminal to create the first admin user:
              </p>
              <div className="bg-zinc-800 rounded-lg p-4 font-mono text-sm text-orange-400">
                superclaw setup
              </div>
              <p className="text-zinc-500 text-sm mt-4">
                This will generate a secure password for your admin account.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <LobsterLogo className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">Sign in to Superclaw</h1>
          <p className="text-zinc-400 mt-2">Your OpenClaw Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg p-3 mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-2">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-zinc-400 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              placeholder="••••••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-all duration-200"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
