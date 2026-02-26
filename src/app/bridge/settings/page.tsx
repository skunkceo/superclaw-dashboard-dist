'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthWrapper';
import Link from 'next/link';

interface IntegrationStatus {
  configured: boolean;
  source: 'environment' | 'database' | 'none';
  error?: string;
  metadata?: Record<string, any>;
}

interface IntegrationsData {
  gsc?: IntegrationStatus;
  ga4?: IntegrationStatus;
  github?: IntegrationStatus;
  linear?: IntegrationStatus;
}

export default function BridgeSettingsPage() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<IntegrationsData>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [editing, setEditing] = useState<'gsc' | 'ga4' | 'github' | 'linear' | null>(null);
  const [form, setForm] = useState({ clientEmail: '', privateKey: '', propertyId: '', token: '', apiKey: '' });

  const fetchIntegrations = async () => {
    try {
      const res = await fetch('/api/integrations');
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleRefresh = async (integration: string) => {
    setRefreshing(integration);
    try {
      await fetch(`/api/bridge/${integration}?force=true`);
    } finally {
      setRefreshing(null);
    }
  };

  const handleSave = async () => {
    if (!editing) return;

    try {
      let credentials: any = {};

      if (editing === 'gsc') {
        credentials = {
          clientEmail: form.clientEmail,
          privateKey: form.privateKey,
        };
      } else if (editing === 'ga4') {
        credentials = {
          clientEmail: form.clientEmail,
          privateKey: form.privateKey,
          propertyId: form.propertyId,
        };
      } else if (editing === 'github') {
        credentials = {
          token: form.token,
        };
      } else if (editing === 'linear') {
        credentials = {
          apiKey: form.apiKey,
        };
      }

      await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration: editing,
          credentials,
        }),
      });

      await fetchIntegrations();
      setEditing(null);
      setForm({ clientEmail: '', privateKey: '', propertyId: '', token: '', apiKey: '' });
    } catch (error) {
      console.error('Failed to save integration:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-zinc-600 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <Link href="/bridge" className="text-sm text-zinc-500 hover:text-zinc-400 transition-colors mb-4 inline-block">
            ← Back to Bridge
          </Link>
          <h1 className="text-2xl font-bold text-white">Integration Settings</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage your connected data sources</p>
        </div>

        {editing === null ? (
          <div className="space-y-4">
            {/* GSC */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">Google Search Console</h3>
                  <p className="text-sm text-zinc-500 mb-4">Track search queries, rankings, impressions, and clicks</p>
                  
                  {integrations.gsc?.configured ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-block text-xs px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                          Connected
                        </span>
                        <span className="text-xs text-zinc-600">via {integrations.gsc.source}</span>
                      </div>
                      {integrations.gsc.metadata?.sitesCount && (
                        <p className="text-xs text-zinc-500">
                          {integrations.gsc.metadata.sitesCount} site{integrations.gsc.metadata.sitesCount !== 1 ? 's' : ''} found
                        </p>
                      )}
                      {integrations.gsc.error && (
                        <p className="text-xs text-red-400">{integrations.gsc.error}</p>
                      )}
                    </div>
                  ) : (
                    <span className="inline-block text-xs px-3 py-1 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">
                      Not configured
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {integrations.gsc?.configured && integrations.gsc.source !== 'environment' && (
                    <button
                      onClick={() => handleRefresh('gsc')}
                      disabled={refreshing === 'gsc'}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs transition-colors"
                    >
                      {refreshing === 'gsc' ? 'Refreshing...' : 'Test'}
                    </button>
                  )}
                  {integrations.gsc?.source !== 'environment' && (
                    <button
                      onClick={() => setEditing('gsc')}
                      className="px-3 py-1.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-xs hover:bg-orange-500/20"
                    >
                      {integrations.gsc?.configured ? 'Reconfigure' : 'Configure'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* GA4 */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">Google Analytics 4</h3>
                  <p className="text-sm text-zinc-500 mb-4">Monitor sessions, traffic sources, and user behavior</p>
                  
                  {integrations.ga4?.configured ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-block text-xs px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                          Connected
                        </span>
                        <span className="text-xs text-zinc-600">via {integrations.ga4.source}</span>
                      </div>
                      {integrations.ga4.metadata?.propertyId && (
                        <p className="text-xs text-zinc-500 font-mono">
                          {integrations.ga4.metadata.propertyId}
                        </p>
                      )}
                      {integrations.ga4.error && (
                        <p className="text-xs text-red-400">{integrations.ga4.error}</p>
                      )}
                    </div>
                  ) : (
                    <span className="inline-block text-xs px-3 py-1 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">
                      Not configured
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {integrations.ga4?.configured && integrations.ga4.source !== 'environment' && (
                    <button
                      onClick={() => handleRefresh('ga4')}
                      disabled={refreshing === 'ga4'}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs transition-colors"
                    >
                      {refreshing === 'ga4' ? 'Refreshing...' : 'Test'}
                    </button>
                  )}
                  {integrations.ga4?.source !== 'environment' && (
                    <button
                      onClick={() => setEditing('ga4')}
                      className="px-3 py-1.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-xs hover:bg-orange-500/20"
                    >
                      {integrations.ga4?.configured ? 'Reconfigure' : 'Configure'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* GitHub */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">GitHub</h3>
                  <p className="text-sm text-zinc-500 mb-4">Track PRs, commits, and repository activity</p>
                  
                  {integrations.github?.configured ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-block text-xs px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                          Connected
                        </span>
                        <span className="text-xs text-zinc-600">
                          via {integrations.github.metadata?.method || integrations.github.source}
                        </span>
                      </div>
                      {integrations.github.metadata?.username && (
                        <p className="text-xs text-zinc-500">
                          @{integrations.github.metadata.username}
                        </p>
                      )}
                      {integrations.github.error && (
                        <p className="text-xs text-red-400">{integrations.github.error}</p>
                      )}
                    </div>
                  ) : (
                    <span className="inline-block text-xs px-3 py-1 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">
                      Not configured
                    </span>
                  )}
                </div>
                <div>
                  {integrations.github?.source === 'database' && (
                    <button
                      onClick={() => setEditing('github')}
                      className="px-3 py-1.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-xs hover:bg-orange-500/20"
                    >
                      Reconfigure
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Linear */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">Linear</h3>
                  <p className="text-sm text-zinc-500 mb-4">Sync tasks and issues (optional)</p>
                  
                  {integrations.linear?.configured ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-block text-xs px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                          Connected
                        </span>
                      </div>
                      {integrations.linear.metadata?.user && (
                        <p className="text-xs text-zinc-500">
                          {integrations.linear.metadata.user}
                        </p>
                      )}
                      {integrations.linear.error && (
                        <p className="text-xs text-red-400">{integrations.linear.error}</p>
                      )}
                    </div>
                  ) : (
                    <span className="inline-block text-xs px-3 py-1 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">
                      Not configured
                    </span>
                  )}
                </div>
                <div>
                  <button
                    onClick={() => setEditing('linear')}
                    className="px-3 py-1.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-xs hover:bg-orange-500/20"
                  >
                    {integrations.linear?.configured ? 'Reconfigure' : 'Configure'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-6">
              Configure {editing === 'gsc' ? 'Google Search Console' : editing === 'ga4' ? 'Google Analytics 4' : editing === 'github' ? 'GitHub' : 'Linear'}
            </h3>

            <div className="space-y-6">
              {(editing === 'gsc' || editing === 'ga4') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Service Account Email</label>
                    <input
                      type="email"
                      value={form.clientEmail}
                      onChange={(e) => setForm({ ...form, clientEmail: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:border-orange-500/50 focus:outline-none font-mono text-sm"
                      placeholder="service-account@project.iam.gserviceaccount.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Private Key</label>
                    <textarea
                      value={form.privateKey}
                      onChange={(e) => setForm({ ...form, privateKey: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:border-orange-500/50 focus:outline-none font-mono text-xs"
                      rows={8}
                      placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                    />
                  </div>

                  {editing === 'ga4' && (
                    <div>
                      <label className="block text-sm font-medium text-zinc-400 mb-2">GA4 Property ID</label>
                      <input
                        type="text"
                        value={form.propertyId}
                        onChange={(e) => setForm({ ...form, propertyId: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:border-orange-500/50 focus:outline-none font-mono text-sm"
                        placeholder="properties/123456789"
                      />
                      <p className="text-xs text-zinc-600 mt-2">Find this in GA4 under Admin → Property Settings</p>
                    </div>
                  )}
                </>
              )}

              {editing === 'github' && (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Personal Access Token</label>
                  <input
                    type="password"
                    value={form.token}
                    onChange={(e) => setForm({ ...form, token: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:border-orange-500/50 focus:outline-none font-mono text-sm"
                    placeholder="ghp_..."
                  />
                  <p className="text-xs text-zinc-600 mt-2">Create at github.com/settings/tokens with repo scope</p>
                </div>
              )}

              {editing === 'linear' && (
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">API Key</label>
                  <input
                    type="password"
                    value={form.apiKey}
                    onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:border-orange-500/50 focus:outline-none font-mono text-sm"
                    placeholder="lin_api_..."
                  />
                  <p className="text-xs text-zinc-600 mt-2">Create at linear.app/settings/api</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setEditing(null);
                    setForm({ clientEmail: '', privateKey: '', propertyId: '', token: '', apiKey: '' });
                  }}
                  className="px-6 py-3 text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={
                    (editing === 'gsc' && (!form.clientEmail || !form.privateKey)) ||
                    (editing === 'ga4' && (!form.clientEmail || !form.privateKey || !form.propertyId)) ||
                    (editing === 'github' && !form.token) ||
                    (editing === 'linear' && !form.apiKey)
                  }
                  className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
