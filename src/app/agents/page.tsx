'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ActivityHeatmap from '@/components/ActivityHeatmap';

interface Agent {
  label: string;
  name: string;
  emoji: string;
  description: string;
  hasMemory: boolean;
  memorySize: number;
  lastActivity?: {
    summary: string;
    timestamp: number;
    action_type: string;
  } | null;
}

interface AgentSession {
  label: string;
  sessionKey: string;
  status: 'active' | 'idle' | 'waiting';
  lastActive: string;
  messageCount: number;
  model: string;
}

interface Team {
  id: string;
  name: string;
  lead: string;
  members: string[];
}

// ─── Generate colored avatar from agent emoji/initials ────────────────────────

function getColoredAvatar(label: string, name: string): { bgColor: string; textColor: string; display: string } {
  // Generate a consistent hue from the agent label
  let h = 0;
  for (let i = 0; i < label.length; i++) h = Math.imul(31, h) + label.charCodeAt(i) | 0;
  const hue = Math.abs(h) % 360;

  // Always use initials — no emoji in the UI
  const display = name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return {
    bgColor: `hsl(${hue}, 60%, 15%)`,
    textColor: `hsl(${hue}, 70%, 70%)`,
    display,
  };
}

function formatActivityTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60 * 1000) return 'just now';
  if (diff < 60 * 60 * 1000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.round(diff / 3600000)}h ago`;
  return `${Math.round(diff / 86400000)}d ago`;
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, session, isLead }: { agent: Agent; session?: AgentSession; isLead?: boolean }) {
  const status = session?.status || 'idle';
  const avatar = getColoredAvatar(agent.label, agent.name);

  return (
    <Link
      href={`/agents/${agent.label}`}
      className={`block bg-zinc-900 border rounded-xl transition-all hover:border-zinc-700 ${
        isLead ? 'p-6 border-2' : 'p-5'
      } ${
        status === 'active'
          ? 'border-orange-500/30 hover:border-orange-500/50'
          : isLead
          ? 'border-orange-500/20 hover:border-orange-500/30'
          : 'border-zinc-800 hover:border-zinc-700'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Colored Avatar */}
        <div className="relative flex-shrink-0">
          <div 
            className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
              status === 'active' ? 'border-orange-500/60' : 'border-zinc-700'
            }`}
            style={{ backgroundColor: avatar.bgColor }}
          >
            <span className="text-sm font-medium" style={{ color: avatar.textColor }}>
              {avatar.display}
            </span>
          </div>
          {/* Status dot */}
          {status === 'active' && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-zinc-900">
              <span className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75"></span>
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm text-white group-hover:text-orange-400 transition-colors truncate">
              {agent.name}
            </h3>
            {isLead && (
              <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] font-medium rounded">
                Lead
              </span>
            )}
            {status === 'active' && (
              <span className="flex-shrink-0 text-[10px] text-green-400 font-medium">Active</span>
            )}
          </div>
          
          {/* Last Activity */}
          {agent.lastActivity && (
            <p className="text-xs text-zinc-500 mt-1 truncate">
              Last: {agent.lastActivity.summary} — {formatActivityTime(agent.lastActivity.timestamp)}
            </p>
          )}
          
          {/* Team badge for members */}
          {!isLead && (
            <div className="mt-2 flex items-center gap-2">
              <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-[10px] rounded">
                Team Member
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewAgent, setShowNewAgent] = useState(false);
  const [newAgentForm, setNewAgentForm] = useState({ name: '', label: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/agents/list')
      .then(res => res.json())
      .then(data => {
        setAgents(data.agents || []);
        setSessions(data.sessions || []);
        setTeams(data.teams || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-zinc-800 rounded w-48 mb-6" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <div key={i} className="h-36 bg-zinc-800 rounded-xl" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Agents</h1>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">No agents configured</h2>
            <p className="text-zinc-400 mb-6">
              Run <code className="px-2 py-1 bg-zinc-800 rounded text-orange-400">superclaw setup agents</code> to get started
            </p>
            <Link href="https://docs.openclaw.ai/superclaw/setup" target="_blank" className="inline-block px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-medium transition-colors">
              View Setup Guide
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeCount = sessions.filter(s => s.status === 'active').length;

  const handleCreateAgent = async () => {
    if (!newAgentForm.name.trim() || !newAgentForm.label.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgentForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create agent');
      setShowNewAgent(false);
      setNewAgentForm({ name: '', label: '', description: '' });
      // Refresh agents list
      const listRes = await fetch('/api/agents/list');
      const listData = await listRes.json();
      setAgents(listData.agents || []);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Agents</h1>
            <p className="text-zinc-500 mt-1 text-sm">
              {agents.length} configured
              {activeCount > 0 && <span className="text-green-400 ml-1.5">· {activeCount} active</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewAgent(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium text-white transition-colors"
            >
              <span className="text-base leading-none">+</span>
              Add New
            </button>
            <Link href="/router" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">
              Configure Router
            </Link>
          </div>
        </div>

        {/* Add New Agent Modal */}
        {showNewAgent && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-white mb-4">Add New Agent</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">Display Name</label>
                  <input
                    type="text"
                    value={newAgentForm.name}
                    onChange={e => {
                      const name = e.target.value;
                      const label = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                      setNewAgentForm(f => ({ ...f, name, label }));
                    }}
                    placeholder="e.g. Content Writer"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">Label <span className="text-zinc-600">(auto-generated, editable)</span></label>
                  <input
                    type="text"
                    value={newAgentForm.label}
                    onChange={e => setNewAgentForm(f => ({ ...f, label: e.target.value }))}
                    placeholder="e.g. content-writer"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-orange-400 placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1.5">Description <span className="text-zinc-600">(optional)</span></label>
                  <input
                    type="text"
                    value={newAgentForm.description}
                    onChange={e => setNewAgentForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="What does this agent do?"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
                {createError && <p className="text-sm text-red-400">{createError}</p>}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCreateAgent}
                  disabled={!newAgentForm.name.trim() || !newAgentForm.label.trim() || creating}
                  className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
                >
                  {creating ? 'Creating...' : 'Create Agent'}
                </button>
                <button
                  onClick={() => { setShowNewAgent(false); setCreateError(null); }}
                  className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Agents Section */}
        {(() => {
          const activeAgents = agents.filter(agent => 
            sessions.some(s => s.label === agent.label && s.status === 'active')
          );
          
          if (activeAgents.length === 0) return null;
          
          return (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-4">Working now</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeAgents.map(agent => (
                  <AgentCard
                    key={agent.label}
                    agent={agent}
                    session={sessions.find(s => s.label === agent.label)}
                  />
                ))}
              </div>
            </div>
          );
        })()}

        {/* Team Activity Heatmap */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 mb-6">
          <ActivityHeatmap agentLabel="all" title="Team Activity" fullWidth />
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white">Agent Teams</h2>
          <p className="text-zinc-500 text-sm mt-1">Organized by functional area</p>
        </div>

        {/* Teams */}
        <div className="space-y-8">
          {teams.map(team => {
            const leadAgent = agents.find(a => a.label === team.lead);
            const memberAgents = team.members
              .map(label => agents.find(a => a.label === label))
              .filter((a): a is Agent => a !== undefined);
            
            if (!leadAgent) return null;

            return (
              <div key={team.id} className="space-y-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-semibold text-white">{team.name}</h3>
                  <span className="text-sm text-zinc-500">
                    Lead: {leadAgent.name}
                  </span>
                </div>

                {/* Lead Card */}
                <div className="mb-4">
                  <AgentCard
                    agent={leadAgent}
                    session={sessions.find(s => s.label === leadAgent.label)}
                    isLead={true}
                  />
                </div>

                {/* Member Cards */}
                {memberAgents.length > 0 && (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 pl-6 border-l-2 border-zinc-800">
                    {memberAgents.map(agent => (
                      <AgentCard
                        key={agent.label}
                        agent={agent}
                        session={sessions.find(s => s.label === agent.label)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned Agents */}
          {(() => {
            const assignedLabels = new Set(
              teams.flatMap(t => [t.lead, ...t.members])
            );
            const unassigned = agents.filter(a => !assignedLabels.has(a.label));
            
            if (unassigned.length === 0) return null;

            return (
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-zinc-400">Unassigned</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {unassigned.map(agent => (
                    <AgentCard
                      key={agent.label}
                      agent={agent}
                      session={sessions.find(s => s.label === agent.label)}
                    />
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
