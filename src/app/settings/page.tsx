'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SettingsPage() {
  const [licenseKey, setLicenseKey] = useState('');
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ success: boolean; message: string } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  // Proactivity settings
  const [proSettings, setProSettings] = useState({
    overnight_start_time: '00:00',
    overnight_end_time: '06:00',
    intel_refresh_interval_hours: '6',
    suggestion_auto_generate: 'true',
  });
  const [savingPro, setSavingPro] = useState(false);
  const [proMsg, setProMsg] = useState('');

  useEffect(() => {
    fetch('/api/proactivity/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.settings) {
          setProSettings(prev => ({
            ...prev,
            overnight_start_time: d.settings.overnight_start_time || prev.overnight_start_time,
            overnight_end_time: d.settings.overnight_end_time || prev.overnight_end_time,
            intel_refresh_interval_hours: d.settings.intel_refresh_interval_hours || prev.intel_refresh_interval_hours,
            suggestion_auto_generate: d.settings.suggestion_auto_generate || prev.suggestion_auto_generate,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const handleProSettingsSave = async () => {
    setSavingPro(true);
    setProMsg('');
    try {
      const res = await fetch('/api/proactivity/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: proSettings }),
      });
      if (res.ok) setProMsg('Saved');
      else setProMsg('Failed to save');
    } finally {
      setSavingPro(false);
      setTimeout(() => setProMsg(''), 2000);
    }
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 8) {
      setPasswordMsg({ success: false, message: 'New password must be at least 8 characters' });
      return;
    }
    setChangingPassword(true);
    setPasswordMsg(null);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const d = await res.json();
      if (res.ok) {
        setPasswordMsg({ success: true, message: 'Password changed successfully' });
        setCurrentPassword('');
        setNewPassword('');
      } else {
        setPasswordMsg({ success: false, message: d.error || 'Failed to change password' });
      }
    } catch {
      setPasswordMsg({ success: false, message: 'Request failed' });
    } finally {
      setChangingPassword(false);
    }
  };

  const validateLicense = async () => {
    setValidating(true);
    setResult(null);

    try {
      const response = await fetch('/api/license/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey })
      });

      const data = await response.json();

      if (data.valid) {
        setResult({
          success: true,
          message: 'Pro license activated! Refresh the page to access Pro features.'
        });
      } else {
        setResult({
          success: false,
          message: data.message || 'Invalid license key'
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Failed to validate license. Please try again.'
      });
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-zinc-400">Manage your SuperClaw installation</p>
        </div>

        <div className="space-y-6">
          {/* Pro License Section */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-800 bg-gradient-to-r from-orange-500/10 to-amber-500/10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">SuperClaw Pro License</h2>
                  <p className="text-sm text-zinc-400 mt-1">Unlock advanced features and workflows</p>
                </div>
                <Link
                  href="/upgrade"
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 rounded-lg text-black font-medium text-sm transition-all"
                >
                  Get Pro
                </Link>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <label htmlFor="license-key" className="block text-sm font-medium text-zinc-300 mb-2">
                  License Key
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    id="license-key"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="Enter your Pro license key"
                    className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow text-white placeholder-zinc-500 font-mono text-sm"
                    disabled={validating}
                  />
                  <button
                    onClick={validateLicense}
                    disabled={!licenseKey || validating}
                    className="px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    {validating ? 'Validating...' : 'Activate'}
                  </button>
                </div>
              </div>

              {result && (
                <div className={`p-4 rounded-lg ${
                  result.success 
                    ? 'bg-green-500/10 border border-green-500/30' 
                    : 'bg-red-500/10 border border-red-500/30'
                }`}>
                  <div className="flex items-start gap-3">
                    {result.success ? (
                      <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                    <p className={result.success ? 'text-green-400' : 'text-red-400'}>
                      {result.message}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-zinc-800">
                <h3 className="text-sm font-medium text-white mb-3">Pro Features</h3>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Specialized Agents (MarTech, CRM, SEO)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Smart Message Router (auto-route by keywords)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Ephemeral Sandboxes (parallel git worktrees)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Task Management Dashboard</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Priority Support</span>
                  </li>
                </ul>
              </div>

              <div className="mt-6 p-4 bg-zinc-800/50 rounded-lg">
                <p className="text-sm text-zinc-400">
                  <strong className="text-white">Need a license?</strong> Purchase SuperClaw Pro at{' '}
                  <a 
                    href="https://skunkglobal.com/superclaw-dashboard-pro/checkout" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-orange-400 hover:text-orange-300 hover:underline"
                  >
                    skunkglobal.com/superclaw-dashboard-pro
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Workspace Configuration */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Workspace</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Workspace Path
                </label>
                <div className="px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg font-mono text-sm text-zinc-400">
                  {process.env.OPENCLAW_WORKSPACE || '~/.openclaw/workspace'}
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Agent workspaces, memory files, and configuration.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Gateway Status
                </label>
                <div className="flex items-center gap-2 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-zinc-500" />
                  <span className="text-sm text-zinc-400">Check via setup wizard</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/setup"
                  className="inline-block px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
                >
                  Re-run Setup
                </Link>
              </div>
            </div>
          </div>

          {/* Proactivity Settings */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-white">Proactivity</h2>
              <Link href="/bridge" className="text-xs text-orange-400 hover:text-orange-300">Open module</Link>
            </div>
            <p className="text-sm text-zinc-500 mb-5">Configure how Clawd gathers intel and runs overnight tasks.</p>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Overnight start</label>
                  <input
                    type="time"
                    value={proSettings.overnight_start_time}
                    onChange={e => setProSettings(p => ({ ...p, overnight_start_time: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Overnight end</label>
                  <input
                    type="time"
                    value={proSettings.overnight_end_time}
                    onChange={e => setProSettings(p => ({ ...p, overnight_end_time: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Intel refresh interval (hours)</label>
                <select
                  value={proSettings.intel_refresh_interval_hours}
                  onChange={e => setProSettings(p => ({ ...p, intel_refresh_interval_hours: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none"
                >
                  <option value="2">Every 2 hours</option>
                  <option value="4">Every 4 hours</option>
                  <option value="6">Every 6 hours</option>
                  <option value="12">Every 12 hours</option>
                  <option value="24">Once a day</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-zinc-300">Auto-generate suggestions</div>
                  <div className="text-xs text-zinc-600 mt-0.5">Generate suggestions after each intel refresh</div>
                </div>
                <button
                  onClick={() => setProSettings(p => ({ ...p, suggestion_auto_generate: p.suggestion_auto_generate === 'true' ? 'false' : 'true' }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${proSettings.suggestion_auto_generate === 'true' ? 'bg-orange-500' : 'bg-zinc-700'}`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${proSettings.suggestion_auto_generate === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleProSettingsSave}
                  disabled={savingPro}
                  className="px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {savingPro ? 'Saving...' : 'Save Proactivity Settings'}
                </button>
                {proMsg && <span className="text-xs text-green-400">{proMsg}</span>}
              </div>
            </div>
          </div>

          {/* Change Password */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-1">Change Password</h2>
            <p className="text-sm text-zinc-500 mb-5">Update your SuperClaw login password.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePasswordChange}
                  disabled={changingPassword || !currentPassword || !newPassword}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {changingPassword ? 'Changing...' : 'Change Password'}
                </button>
                {passwordMsg && (
                  <span className={`text-xs ${passwordMsg.success ? 'text-green-400' : 'text-red-400'}`}>
                    {passwordMsg.message}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Version Information */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Updates</h2>
              <Link
                href="/versions"
                className="text-orange-400 hover:text-orange-300 text-sm"
              >
                View Details →
              </Link>
            </div>
            
            <p className="text-sm text-zinc-400 mb-4">
              SuperClaw can automatically check for and install updates to the dashboard and OpenClaw gateway.
            </p>
            
            <Link
              href="/versions"
              className="inline-block px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
            >
              Check for Updates
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
