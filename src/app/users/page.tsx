'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LobsterLogo } from '@/components/LobsterLogo';

type UserRole = 'view' | 'edit' | 'admin';

interface User {
  id: number;
  email: string;
  role: UserRole;
  created_at: number;
  last_login: number | null;
  created_by: number | null;
}

interface RoleDescriptions {
  [key: string]: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roleDescriptions, setRoleDescriptions] = useState<RoleDescriptions>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('view');
  const [createdPassword, setCreatedPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [hasProAccess, setHasProAccess] = useState(false);
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<number | null>(null);

  const checkLicense = async () => {
    try {
      const res = await fetch('/api/license/status');
      const data = await res.json();
      setHasProAccess(data.hasLicense && data.tier === 'pro');
    } catch (error) {
      console.error('License check failed:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (res.status === 403) {
        setError('Admin access required');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setUsers(data.users);
      setRoleDescriptions(data.roleDescriptions || {});
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkLicense();
    fetchUsers();
  }, [router]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreatedPassword('');

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newUserEmail, role: newUserRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setCreatedPassword(data.password);
      fetchUsers();
    } catch {
      setError('Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = (userId: number) => {
    setDeleteConfirmUserId(userId);
  };

  const confirmDeleteUser = async () => {
    if (deleteConfirmUserId === null) return;
    const userId = deleteConfirmUserId;
    setDeleteConfirmUserId(null);
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } catch {
      setError('Failed to delete user');
    }
  };

  const handleRoleChange = async (userId: number, newRole: UserRole) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } catch {
      setError('Failed to update role');
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const roleColors: Record<UserRole, string> = {
    view: 'bg-zinc-700 text-zinc-300',
    edit: 'bg-blue-500/20 text-blue-400',
    admin: 'bg-orange-500/20 text-orange-400',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <LobsterLogo className="w-16 h-16 animate-pulse" />
      </div>
    );
  }

  if (!hasProAccess) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-8">
        <div className="max-w-2xl text-center">
          <LobsterLogo className="w-20 h-20 mx-auto mb-6 opacity-50" />
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
            Pro Feature
          </h1>
          <p className="text-xl text-zinc-400 mb-8">
            Multi-user team management is available in SuperClaw Pro.
          </p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
            <h3 className="font-semibold text-lg mb-3 text-white">What you'll get:</h3>
            <ul className="text-left space-y-2 text-zinc-400">
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-0.5">✓</span>
                <span>Add unlimited team members</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-0.5">✓</span>
                <span>Role-based permissions (view, edit, admin)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-0.5">✓</span>
                <span>Shared tasks and progress tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-0.5">✓</span>
                <span>Team collaboration features</span>
              </li>
            </ul>
          </div>
          <a
            href="/upgrade"
            className="inline-block px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-lg transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 font-semibold text-white text-lg"
          >
            Upgrade to Pro
          </a>
        </div>
      </div>
    );
  }

  if (error === 'Admin access required') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-zinc-400 mb-4">Admin access is required to manage users.</p>
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
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-4 sm:px-6 py-3 sm:py-4 bg-zinc-900/50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="text-zinc-400 hover:text-white">
              ← Back
            </button>
            <h1 className="text-lg font-semibold">User Management</h1>
          </div>
          <button
            onClick={() => {
              setShowAddModal(true);
              setCreatedPassword('');
              setNewUserEmail('');
              setNewUserRole('view');
            }}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 px-4 py-2 rounded-lg font-medium text-sm transition-all"
          >
            Add User
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {error && error !== 'Admin access required' && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg p-3 mb-4 text-sm">
            {error}
            <button onClick={() => setError('')} className="ml-2 text-red-300">×</button>
          </div>
        )}

        {/* Role Legend */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 mb-6">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Role Permissions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(roleDescriptions).map(([role, desc]) => (
              <div key={role} className="flex items-start gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${roleColors[role as UserRole]}`}>
                  {role}
                </span>
                <span className="text-xs text-zinc-500">{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Email</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400">Role</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-zinc-400 hidden sm:table-cell">Last Login</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-zinc-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-zinc-800/50 last:border-0">
                  <td className="px-4 py-3">
                    <span className="text-white">{user.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                      className={`px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer ${roleColors[user.role]}`}
                    >
                      <option value="view">view</option>
                      <option value="edit">edit</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-sm hidden sm:table-cell">
                    {formatDate(user.last_login)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold mb-4">Add New User</h2>

            {createdPassword ? (
              <div>
                <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4 mb-4">
                  <p className="text-green-400 text-sm mb-2">User created successfully!</p>
                  <p className="text-zinc-400 text-xs mb-3">
                    Send them this password. It will not be shown again.
                  </p>
                  <div className="bg-zinc-800 rounded-lg p-3 font-mono text-orange-400 break-all">
                    {createdPassword}
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddUser}>
                <div className="mb-4">
                  <label className="block text-sm text-zinc-400 mb-2">Email</label>
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500"
                    required
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm text-zinc-400 mb-2">Role</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="view">view - Can view dashboard and chat</option>
                    <option value="edit">edit - Can also edit workspace files</option>
                    <option value="admin">admin - Full access including user management</option>
                  </select>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 text-white py-2 rounded-lg"
                  >
                    {creating ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {deleteConfirmUserId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirmUserId(null)} />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-sm w-full p-6">
            <h2 className="text-base font-semibold text-white mb-2">Delete user?</h2>
            <p className="text-sm text-zinc-400 mb-6">This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirmUserId(null)} className="px-4 py-2 text-sm text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition-colors">Cancel</button>
              <button onClick={confirmDeleteUser} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
