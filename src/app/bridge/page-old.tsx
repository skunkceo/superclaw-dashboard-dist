'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthWrapper';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BusinessContext {
  business_name?: string;
  business_description?: string;
  products?: string[];
  competitors?: string[];
  content_sites?: string[];
  primary_goal?: 'traffic' | 'signups' | 'revenue' | 'awareness';
  industry?: string;
  source: string;
  last_updated: number;
}

interface IntegrationStatus {
  configured: boolean;
  source: 'environment' | 'database' | 'none';
  error?: string;
  metadata?: Record<string, any>;
}

interface SynthesisData {
  whatsWorking: string[];
  needsAttention: string[];
  now: string[];
  next: string[];
  later: string[];
}

interface GSCQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  site: string;
}

interface ActivityEntry {
  id: string;
  timestamp: number;
  agent_label: string;
  action_type: string;
  summary: string;
  details: string | null;
  links: string;
}

interface PRItem {
  repo: string;
  number: number;
  title: string;
  state: string;
  url: string;
  createdAt: string;
  author: string;
}

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  state: {
    name: string;
    type: string;
  };
  priority: number;
  url: string;
}

interface LinearConnection {
  connected: boolean;
  teamName?: string;
  teamId?: string;
}

interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

// ─── Linear Connection Card ─────────────────────────────────────────────────
// Kept for /bridge/settings page - not rendered on main page

function LinearConnectionCard() {
  const [connection, setConnection] = useState<LinearConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [teams, setTeams] = useState<LinearTeam[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<LinearTeam | null>(null);
  const [fetchingTeams, setFetchingTeams] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchConnection = useCallback(async () => {
    try {
      const res = await fetch('/api/linear/connection');
      if (res.ok) {
        const data = await res.json();
        setConnection(data);
      }
    } catch {
      setConnection({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  const handleFetchTeams = async () => {
    if (!apiKey.trim()) return;
    setFetchingTeams(true);
    setError(null);
    try {
      const res = await fetch(`/api/linear/teams?apiKey=${encodeURIComponent(apiKey)}`);
      const data = await res.json();
      if (res.ok && data.teams) {
        setTeams(data.teams);
        if (data.teams.length === 1) {
          setSelectedTeam(data.teams[0]);
        }
      } else {
        setError(data.error || 'Failed to fetch teams');
      }
    } catch {
      setError('Failed to connect to Linear');
    } finally {
      setFetchingTeams(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedTeam) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/linear/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          teamId: selectedTeam.id,
          teamName: selectedTeam.name,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setConnection({ connected: true, teamName: selectedTeam.name, teamId: selectedTeam.id });
        setExpanded(false);
        setApiKey('');
        setTeams([]);
        setSelectedTeam(null);
      } else {
        setError(data.error || 'Failed to connect');
      }
    } catch {
      setError('Failed to save connection');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/linear/connection', { method: 'DELETE' });
      if (res.ok) {
        setConnection({ connected: false });
      }
    } catch {
      // Ignore
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSyncTasks = async () => {
    setSyncing(true);
    setSyncResult(null);
    setError(null);
    try {
      const res = await fetch('/api/linear/sync-tasks', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        const messages = [];
        if (data.synced_to_linear > 0) {
          messages.push(`${data.synced_to_linear} task${data.synced_to_linear !== 1 ? 's' : ''} synced to Linear`);
        }
        if (data.synced_from_linear > 0) {
          messages.push(`${data.synced_from_linear} task${data.synced_from_linear !== 1 ? 's' : ''} imported from Linear`);
        }
        if (messages.length === 0) {
          setSyncResult('All tasks already synced');
        } else {
          setSyncResult(messages.join(', '));
        }
        if (data.failed > 0) {
          setError(`${data.failed} task${data.failed !== 1 ? 's' : ''} failed to sync`);
        }
      } else {
        setError(data.error || 'Failed to sync tasks');
      }
    } catch {
      setError('Failed to sync tasks');
    } finally {
      setSyncing(false);
      // Clear result after 5 seconds
      setTimeout(() => setSyncResult(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-800 rounded-lg" />
          <div className="flex-1">
            <div className="h-4 bg-zinc-800 rounded w-24 mb-2" />
            <div className="h-3 bg-zinc-800 rounded w-48" />
          </div>
        </div>
      </div>
    );
  }

  const isConnected = connection?.connected;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Linear Logo */}
          <div className="w-10 h-10 bg-zinc-800 border border-zinc-700 rounded-lg flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5765C16.4002 93.5921 5.58778 81.8388 1.22541 61.5228Z" fill="#5E6AD2"/>
              <path d="M2.18536 49.5767c-.11318-1.1403.91974-1.9766 2.01365-1.6746l59.5753 16.5137c1.0939.3021 1.3063 1.7315.3947 2.6024L26.8071 97.7899c-.9117.8709-2.3249.5884-2.7086-.5437C17.0289 83.5353 6.31848 67.0816 2.18536 49.5767Z" fill="#5E6AD2"/>
              <path d="M73.8617 97.0059c-.4428-.0895-.8098-.4247-.9574-.8548L48.2607 29.5399c-.2698-.7868.4285-1.5624 1.2287-1.365l43.1879 10.6534c.5998.1479.9706.7478.8364 1.3553-3.4873 15.7746-9.5789 33.6579-19.6521 56.8223Z" fill="#5E6AD2"/>
              <path d="M97.0022 73.3018c-.9094 3.0879-1.9766 6.0691-3.2014 8.942-.6016 1.4116-2.4579 1.6032-3.3364.3442L50.1336 23.2226c-.8786-1.259.1656-2.9803 1.7193-2.835 22.8174 2.1335 37.3408 14.7893 45.1493 52.9142Z" fill="#5E6AD2"/>
              <path d="M92.687 19.8005c-.1557-.8783-.6463-1.6595-1.3573-2.1613C78.3843 8.1115 62.8383 2.87286 46.5882 2.21138c-1.0376-.04224-1.8827.83037-1.7588 1.86195l5.0015 41.6525c.0878.7311.6743 1.3165 1.4053 1.4033l41.6435 4.9395c1.0316.1223 1.9041-.7211 1.8622-1.7588-.5568-13.8192-1.3833-23.0816-2.0559-30.4699Z" fill="#5E6AD2"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-white">Linear</h3>
              {isConnected && (
                <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Connected
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-500 mt-0.5">
              {isConnected ? connection.teamName : 'Task management — single source of truth'}
            </p>
          </div>
        </div>

        {isConnected ? (
          <div className="flex items-center gap-3">
            <Link
              href="/tasks"
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              View Tasks
            </Link>
            <button
              onClick={handleSyncTasks}
              disabled={syncing}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing ? 'Syncing...' : 'Sync Tasks'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {expanded ? 'Cancel' : 'Connect'}
          </button>
        )}
      </div>

      {/* Sync result messages */}
      {isConnected && (syncResult || error) && (
        <div className="mt-4">
          {syncResult && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-400">
              {syncResult}
            </div>
          )}
          {error && (
            <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Expanded connection form */}
      {expanded && !isConnected && (
        <div className="mt-6 pt-6 border-t border-zinc-800">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                API Key
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setTeams([]);
                    setSelectedTeam(null);
                  }}
                  placeholder="lin_api_..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white text-sm focus:border-zinc-600 focus:outline-none"
                />
                <button
                  onClick={handleFetchTeams}
                  disabled={!apiKey.trim() || fetchingTeams}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {fetchingTeams ? 'Fetching...' : 'Fetch Teams'}
                </button>
              </div>
              <p className="text-xs text-zinc-600 mt-1.5">
                Create an API key at linear.app/settings/api
              </p>
            </div>

            {teams.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Select Team
                </label>
                <select
                  value={selectedTeam?.id || ''}
                  onChange={(e) => {
                    const team = teams.find(t => t.id === e.target.value);
                    setSelectedTeam(team || null);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white text-sm focus:border-zinc-600 focus:outline-none"
                >
                  <option value="">Select a team...</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.key})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedTeam && (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {connecting ? 'Connecting...' : `Connect to ${selectedTeam.name}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Onboarding Wizard ────────────────────────────────────────────────────────

function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<'reading' | 'business' | 'integrations' | 'generating'>('reading');
  const [workspaceData, setWorkspaceData] = useState<Partial<BusinessContext> | null>(null);
  const [integrations, setIntegrations] = useState<{
    gsc?: IntegrationStatus;
    ga4?: IntegrationStatus;
    github?: IntegrationStatus;
    linear?: IntegrationStatus;
  }>({});
  const [formData, setFormData] = useState({
    business_name: '',
    business_description: '',
    products: '',
    competitors: '',
    content_sites: '',
    primary_goal: 'traffic' as 'traffic' | 'signups' | 'revenue' | 'awareness',
    industry: '',
  });
  const [currentIntegration, setCurrentIntegration] = useState<'gsc' | 'ga4' | 'github' | 'linear' | null>(null);
  const [gscForm, setGscForm] = useState({ clientEmail: '', privateKey: '', propertyId: '' });

  useEffect(() => {
    const init = async () => {
      try {
        const [contextRes, integrationsRes] = await Promise.all([
          fetch('/api/business-context'),
          fetch('/api/integrations'),
        ]);
        
        if (contextRes.ok) {
          const data = await contextRes.json();
          setWorkspaceData(data.workspaceContext);
          
          if (data.workspaceContext) {
            setFormData({
              business_name: data.workspaceContext.business_name || '',
              business_description: data.workspaceContext.business_description || '',
              products: data.workspaceContext.products?.join(', ') || '',
              competitors: data.workspaceContext.competitors?.join(', ') || '',
              content_sites: data.workspaceContext.content_sites?.join(', ') || '',
              primary_goal: data.workspaceContext.primary_goal || 'traffic',
              industry: data.workspaceContext.industry || '',
            });
          }
        }

        if (integrationsRes.ok) {
          const data = await integrationsRes.json();
          setIntegrations(data.integrations);
        }
        
        setTimeout(() => setStep('business'), 2000);
      } catch (error) {
        console.error('Failed to load initial data:', error);
        setTimeout(() => setStep('business'), 2000);
      }
    };
    
    init();
  }, []);

  const handleBusinessSubmit = () => {
    setStep('integrations');
  };

  const handleSkipIntegrations = async () => {
    await saveBusinessContext();
    setStep('generating');
    await completeOnboarding();
  };

  const saveBusinessContext = async () => {
    await fetch('/api/business-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          business_name: formData.business_name,
          business_description: formData.business_description,
          products: formData.products.split(',').map(p => p.trim()).filter(Boolean),
          competitors: formData.competitors.split(',').map(c => c.trim()).filter(Boolean),
          content_sites: formData.content_sites.split(',').map(s => s.trim()).filter(Boolean),
          primary_goal: formData.primary_goal,
          industry: formData.industry,
        },
      }),
    });
  };

  const completeOnboarding = async () => {
    try {
      await fetch('/api/business-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completeOnboarding: true }),
      });
      
      onComplete();
    } catch (error) {
      console.error('Onboarding failed:', error);
    }
  };

  const handleIntegrationSave = async () => {
    if (!currentIntegration) return;

    try {
      if (currentIntegration === 'gsc' || currentIntegration === 'ga4') {
        await fetch('/api/integrations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            integration: currentIntegration,
            credentials: {
              clientEmail: gscForm.clientEmail,
              privateKey: gscForm.privateKey,
              ...(currentIntegration === 'ga4' && { propertyId: gscForm.propertyId }),
            },
          }),
        });
      }

      // Refresh integration status
      const res = await fetch('/api/integrations');
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations);
      }

      setCurrentIntegration(null);
      setGscForm({ clientEmail: '', privateKey: '', propertyId: '' });
    } catch (error) {
      console.error('Failed to save integration:', error);
    }
  };

  const handleFinishIntegrations = async () => {
    await saveBusinessContext();
    setStep('generating');
    await completeOnboarding();
  };

  if (step === 'reading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-orange-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Reading your OpenClaw workspace...</h2>
            <p className="text-zinc-500">Looking for MEMORY.md, SOUL.md, USER.md</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'business') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-3xl w-full">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-2">Tell me about your business</h2>
            <p className="text-zinc-500 mb-8">This helps me find relevant intelligence signals for you</p>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Business name</label>
                <input
                  type="text"
                  value={formData.business_name}
                  onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:border-orange-500/50 focus:outline-none"
                  placeholder="Acme Inc"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">What do you build or sell?</label>
                <input
                  type="text"
                  value={formData.products}
                  onChange={(e) => setFormData({ ...formData, products: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:border-orange-500/50 focus:outline-none"
                  placeholder="WordPress CRM plugin, Form builder"
                />
                <p className="text-xs text-zinc-600 mt-1">Comma-separated</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Main competitors</label>
                <input
                  type="text"
                  value={formData.competitors}
                  onChange={(e) => setFormData({ ...formData, competitors: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:border-orange-500/50 focus:outline-none"
                  placeholder="HubSpot, WPForms, Gravity Forms"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Primary growth goal</label>
                <select
                  value={formData.primary_goal}
                  onChange={(e) => setFormData({ ...formData, primary_goal: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:border-orange-500/50 focus:outline-none"
                >
                  <option value="traffic">Traffic</option>
                  <option value="signups">Signups</option>
                  <option value="revenue">Revenue</option>
                  <option value="awareness">Awareness</option>
                </select>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end">
              <button
                onClick={handleBusinessSubmit}
                disabled={!formData.business_name || !formData.products}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'integrations') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-3xl w-full">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-2">Connect your data sources</h2>
            <p className="text-zinc-500 mb-8">The Bridge pulls live data from your tools. Connect them now or skip for later.</p>
            
            {currentIntegration === null ? (
              <div className="space-y-4">
                {/* GSC */}
                <div className="border border-zinc-800 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">Google Search Console</h3>
                    <p className="text-sm text-zinc-500 mt-1">Track search queries, rankings, and clicks</p>
                    {integrations.gsc?.configured && (
                      <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                        Connected via {integrations.gsc.source}
                      </span>
                    )}
                  </div>
                  {!integrations.gsc?.configured && (
                    <button
                      onClick={() => setCurrentIntegration('gsc')}
                      className="px-4 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-sm hover:bg-orange-500/20"
                    >
                      Connect
                    </button>
                  )}
                </div>

                {/* GA4 */}
                <div className="border border-zinc-800 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">Google Analytics 4</h3>
                    <p className="text-sm text-zinc-500 mt-1">Monitor traffic, sessions, and user behavior</p>
                    {integrations.ga4?.configured && (
                      <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                        Connected via {integrations.ga4.source}
                      </span>
                    )}
                  </div>
                  {!integrations.ga4?.configured && (
                    <button
                      onClick={() => setCurrentIntegration('ga4')}
                      className="px-4 py-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-sm hover:bg-orange-500/20"
                    >
                      Connect
                    </button>
                  )}
                </div>

                {/* GitHub */}
                <div className="border border-zinc-800 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">GitHub</h3>
                    <p className="text-sm text-zinc-500 mt-1">Track PRs, commits, and code activity</p>
                    {integrations.github?.configured && (
                      <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                        Connected via {integrations.github.source}
                      </span>
                    )}
                  </div>
                  {!integrations.github?.configured && (
                    <span className="text-sm text-zinc-600">Requires gh CLI or PAT</span>
                  )}
                </div>

                <div className="mt-8 flex justify-between">
                  <button
                    onClick={handleSkipIntegrations}
                    className="px-6 py-3 text-zinc-400 hover:text-white transition-colors"
                  >
                    Skip for now
                  </button>
                  <button
                    onClick={handleFinishIntegrations}
                    className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors"
                  >
                    Finish Setup
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white">
                  Configure {currentIntegration.toUpperCase()}
                </h3>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Service Account Email</label>
                  <input
                    type="email"
                    value={gscForm.clientEmail}
                    onChange={(e) => setGscForm({ ...gscForm, clientEmail: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:border-orange-500/50 focus:outline-none font-mono text-sm"
                    placeholder="service-account@project.iam.gserviceaccount.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Private Key</label>
                  <textarea
                    value={gscForm.privateKey}
                    onChange={(e) => setGscForm({ ...gscForm, privateKey: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:border-orange-500/50 focus:outline-none font-mono text-xs"
                    rows={6}
                    placeholder="-----BEGIN PRIVATE KEY-----..."
                  />
                </div>

                {currentIntegration === 'ga4' && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-2">GA4 Property ID</label>
                    <input
                      type="text"
                      value={gscForm.propertyId}
                      onChange={(e) => setGscForm({ ...gscForm, propertyId: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:border-orange-500/50 focus:outline-none font-mono text-sm"
                      placeholder="properties/123456789"
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setCurrentIntegration(null);
                      setGscForm({ clientEmail: '', privateKey: '', propertyId: '' });
                    }}
                    className="px-6 py-3 text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleIntegrationSave}
                    disabled={!gscForm.clientEmail || !gscForm.privateKey}
                    className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'generating') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-orange-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Setting up The Bridge...</h2>
            <p className="text-zinc-500">Generating your first strategic brief</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Main Bridge Dashboard ────────────────────────────────────────────────────

export default function TheBridgePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [synthesis, setSynthesis] = useState<SynthesisData | null>(null);
  const [gscData, setGscData] = useState<any>(null);
  const [ga4Data, setGa4Data] = useState<any>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [prs, setPrs] = useState<PRItem[]>([]);
  const [linearIssues, setLinearIssues] = useState<LinearIssue[]>([]);
  const [intelData, setIntelData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [contextRes, synthesisRes, gscRes, ga4Res, activityRes, githubRes, linearRes, intelRes] = await Promise.all([
        fetch('/api/business-context'),
        fetch('/api/bridge/synthesis'),
        fetch('/api/bridge/gsc'),
        fetch('/api/bridge/ga4'),
        fetch('/api/activity?hours=24&limit=8'),
        fetch('/api/github-activity'),
        fetch('/api/linear/issues'),
        fetch('/api/bridge/intel'),
      ]);
      
      if (contextRes.ok) {
        const contextData = await contextRes.json();
        setOnboardingComplete(contextData.onboardingComplete);
      }
      
      if (synthesisRes.ok) {
        const data = await synthesisRes.json();
        setSynthesis(data.brief);
      }

      if (gscRes.ok) {
        const data = await gscRes.json();
        setGscData(data);
      }

      if (ga4Res.ok) {
        const data = await ga4Res.json();
        setGa4Data(data);
      }
      
      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setActivity(activityData.activities || []);
      }

      if (githubRes.ok) {
        const githubData = await githubRes.json();
        setPrs(githubData.prs || []);
      }

      if (linearRes.ok) {
        const linearData = await linearRes.json();
        setLinearIssues(linearData.issues || []);
      }

      if (intelRes.ok) {
        const intelResponseData = await intelRes.json();
        setIntelData(intelResponseData);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/bridge/synthesis?force=true');
      await fetchAll();
    } finally {
      setRefreshing(false);
    }
  };

  if (onboardingComplete === false) {
    return <OnboardingWizard onComplete={() => { setOnboardingComplete(true); fetchAll(); }} />;
  }

  if (loading || onboardingComplete === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-zinc-600 text-sm">Loading...</div>
      </div>
    );
  }

  const openPRs = prs.filter(pr => pr.state === 'OPEN');
  const blockers = activity.filter(a => a.action_type === 'blocked').slice(0, 3);
  
  // Filter Linear issues for "In Review" status
  const reviewIssues = linearIssues.filter(issue => 
    issue.state.name.toLowerCase().includes('review')
  );

  // Filter Linear issues by In Progress (started) and Todo (unstarted)
  const inProgressIssues = linearIssues.filter(issue => 
    issue.state.type === 'started'
  ).slice(0, 3);
  
  const todoIssues = linearIssues.filter(issue => 
    issue.state.type === 'unstarted'
  ).slice(0, 3);

  const getPriorityColor = (priority: number) => {
    if (priority === 1) return 'bg-red-500';
    if (priority === 2) return 'bg-orange-500';
    return 'bg-zinc-500';
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {/* Header */}
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">The Bridge</h1>
            <p className="text-sm text-zinc-500 mt-1">Operations center</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/bridge/settings"
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-lg text-sm font-medium transition-colors border border-zinc-800"
            >
              Settings
            </Link>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-sm font-medium transition-colors border border-orange-500/20 flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* 1. Needs Your Attention */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold text-white tracking-wide uppercase mb-4">Needs Your Attention</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Open PRs */}
              <div>
                <h3 className="text-xs font-semibold text-orange-400 uppercase mb-3">Open PRs</h3>
                {openPRs.length === 0 ? (
                  <p className="text-sm text-zinc-600">No PRs waiting</p>
                ) : (
                  <div className="space-y-3">
                    {openPRs.map((pr) => (
                      <div key={pr.number} className="border-l-2 border-orange-500 pl-3">
                        <a 
                          href={pr.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-sm text-white hover:text-orange-400 transition-colors block"
                        >
                          {pr.title}
                        </a>
                        <p className="text-xs text-zinc-600 mt-1">{pr.repo}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Linear - In Review */}
              <div>
                <h3 className="text-xs font-semibold text-blue-400 uppercase mb-3">Linear — In Review</h3>
                {reviewIssues.length === 0 ? (
                  <p className="text-sm text-zinc-600">Nothing in review</p>
                ) : (
                  <div className="space-y-3">
                    {reviewIssues.slice(0, 3).map((issue) => (
                      <div key={issue.id} className="border-l-2 border-blue-500 pl-3">
                        <a 
                          href={issue.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-sm text-white hover:text-blue-400 transition-colors block"
                        >
                          <span className="text-zinc-500 font-mono text-xs">{issue.identifier}</span> {issue.title}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Blockers */}
              <div>
                <h3 className="text-xs font-semibold text-red-400 uppercase mb-3">Blockers</h3>
                {blockers.length === 0 ? (
                  <p className="text-sm text-zinc-600">No blockers</p>
                ) : (
                  <div className="space-y-3">
                    {blockers.map((entry) => (
                      <div key={entry.id} className="border-l-2 border-red-500 pl-3">
                        <p className="text-sm text-white">{entry.summary}</p>
                        <p className="text-xs text-zinc-600 mt-1">{entry.agent_label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 2. In Progress */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold text-white tracking-wide uppercase mb-4">In Progress</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Linear Issues (Now/Next) */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-4">Linear Issues (Now/Next)</h3>
              
              {inProgressIssues.length === 0 && todoIssues.length === 0 ? (
                <p className="text-sm text-zinc-600">No active issues</p>
              ) : (
                <div className="space-y-4">
                  {inProgressIssues.length > 0 && (
                    <div>
                      <h4 className="text-xs text-zinc-500 uppercase mb-2">In Progress</h4>
                      <div className="space-y-2">
                        {inProgressIssues.map((issue) => (
                          <div key={issue.id} className="flex items-start gap-3">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${getPriorityColor(issue.priority)}`} />
                            <div className="flex-1 min-w-0">
                              <a 
                                href={issue.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-sm text-white hover:text-orange-400 transition-colors block"
                              >
                                <span className="inline-block px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs font-mono rounded mr-2">
                                  {issue.identifier}
                                </span>
                                {issue.title}
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {todoIssues.length > 0 && (
                    <div>
                      <h4 className="text-xs text-zinc-500 uppercase mb-2">Todo</h4>
                      <div className="space-y-2">
                        {todoIssues.map((issue) => (
                          <div key={issue.id} className="flex items-start gap-3">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${getPriorityColor(issue.priority)}`} />
                            <div className="flex-1 min-w-0">
                              <a 
                                href={issue.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-sm text-white hover:text-orange-400 transition-colors block"
                              >
                                <span className="inline-block px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs font-mono rounded mr-2">
                                  {issue.identifier}
                                </span>
                                {issue.title}
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recent Agent Work */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-4">Recent Agent Work</h3>
              {activity.length === 0 ? (
                <p className="text-sm text-zinc-600">No recent activity</p>
              ) : (
                <div className="space-y-3">
                  {activity.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3">
                      <span className="inline-block px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded flex-shrink-0">
                        {entry.agent_label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{entry.summary}</p>
                        <p className="text-xs text-zinc-600 mt-1">
                          {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 3. Growth */}
        <section className="mb-10">
          <h2 className="text-xs font-semibold text-white tracking-wide uppercase mb-4">Growth</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Traffic */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-3">Traffic</h3>
              {ga4Data ? (
                <>
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-bold text-white">{ga4Data.sessions.toLocaleString()}</span>
                    <span className={`text-sm font-medium ${ga4Data.sessionsChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {ga4Data.sessionsChange > 0 ? '+' : ''}{ga4Data.sessionsChange.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">Sessions (7d)</p>
                  <p className="text-sm text-zinc-400 mt-3">{ga4Data.organicPercent.toFixed(0)}% organic</p>
                </>
              ) : (
                <p className="text-sm text-zinc-600">GA4 not connected</p>
              )}
            </div>

            {/* Search */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-3">Search</h3>
              {gscData && gscData.topQueries ? (
                <div className="space-y-2">
                  {gscData.topQueries.slice(0, 5).map((q: GSCQuery, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-white truncate flex-1 mr-2">{q.query}</span>
                      <div className="flex items-center gap-2 text-xs flex-shrink-0">
                        <span className="text-zinc-500">{q.clicks}</span>
                        <span className="text-zinc-600">#{q.position.toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-600">GSC not connected</p>
              )}
            </div>

            {/* Opportunities */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase mb-3">Opportunities</h3>
              {gscData && gscData.opportunities && gscData.opportunities.length > 0 ? (
                <div className="space-y-3">
                  {gscData.opportunities.slice(0, 3).map((q: GSCQuery, i: number) => (
                    <div key={i}>
                      <p className="text-sm text-white mb-1">{q.query}</p>
                      <p className="text-xs text-orange-400">
                        Position {q.position.toFixed(1)} — push to page 1
                      </p>
                      <p className="text-xs text-zinc-600 mt-0.5">{q.impressions.toLocaleString()} impressions</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-600">No GSC data</p>
              )}
            </div>
          </div>
        </section>

        {/* 4. Strategic Brief (condensed) */}
        {synthesis && (
          <section className="mb-10">
            <h2 className="text-xs font-semibold text-white tracking-wide uppercase mb-4">Strategic Brief</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-xs font-semibold text-green-400 uppercase mb-2">What's Working</h3>
                  <ul className="space-y-1.5">
                    {synthesis.whatsWorking.map((item, i) => (
                      <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                        <span className="w-1 h-1 rounded-full bg-green-400 flex-shrink-0 mt-1.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-orange-400 uppercase mb-2">Needs Attention</h3>
                  <ul className="space-y-1.5">
                    {synthesis.needsAttention.map((item, i) => (
                      <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                        <span className="w-1 h-1 rounded-full bg-orange-400 flex-shrink-0 mt-1.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-800">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h3 className="text-xs font-semibold text-orange-400 uppercase mb-2">Now</h3>
                    <ul className="space-y-1">
                      {synthesis.now.map((item, i) => (
                        <li key={i} className="text-xs text-zinc-500">{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase mb-2">Next</h3>
                    <ul className="space-y-1">
                      {synthesis.next.map((item, i) => (
                        <li key={i} className="text-xs text-zinc-600">{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-600 uppercase mb-2">Later</h3>
                    <ul className="space-y-1">
                      {synthesis.later.map((item, i) => (
                        <li key={i} className="text-xs text-zinc-700">{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 5. Market Intelligence */}
        {intelData && intelData.intel && intelData.intel.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-semibold text-white tracking-wide uppercase">Market Intelligence</h2>
              <Link
                href="/reports"
                className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
              >
                View all →
              </Link>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
              {intelData.intel.slice(0, 5).map((item: any) => {
                const categoryColors: Record<string, string> = {
                  competitor: 'bg-red-500/10 text-red-400 border-red-500/20',
                  opportunity: 'bg-green-500/10 text-green-400 border-green-500/20',
                  wordpress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                  market: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
                  seo: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                };
                const categoryColor = categoryColors[item.category] || 'bg-zinc-800 text-zinc-400 border-zinc-700';
                const truncatedSummary = item.summary.length > 140
                  ? item.summary.substring(0, 140) + '...'
                  : item.summary;

                return (
                  <div key={item.id} className="px-6 py-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded border ${categoryColor}`}>
                        {item.category}
                      </span>
                      {item.relevance_score != null && (
                        <span className="text-xs text-zinc-600">
                          {typeof item.relevance_score === 'number'
                            ? `${Math.round(item.relevance_score * 100)}% relevant`
                            : item.relevance_score}
                        </span>
                      )}
                    </div>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-white hover:text-orange-400 transition-colors block"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-white">{item.title}</p>
                    )}
                    <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{truncatedSummary}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
