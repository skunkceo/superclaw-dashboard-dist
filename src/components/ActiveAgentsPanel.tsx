'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AgentSession {
  label: string;
  sessionKey: string;
  status: 'active' | 'idle' | 'waiting';
  lastActive: string;
  messageCount: number;
  model: string;
}

interface AgentWorkspace {
  label: string;
  name: string;
  emoji: string;
  workspacePath: string;
  hasMemory: boolean;
  memorySize: number;
}

interface ActivityEntry {
  id: string;
  timestamp: number;
  agent_label: string;
  action_type: string;
  summary: string;
}

interface ActiveAgent {
  label: string;
  name: string;
  emoji: string;
  status: 'active' | 'idle' | 'waiting';
  lastActive: string;
  lastActivity: ActivityEntry | null;
}

function labelToPortrait(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = Math.imul(31, h) + label.charCodeAt(i) | 0;
  const abs = Math.abs(h);
  const gender = abs % 2 === 0 ? 'men' : 'women';
  const idx = abs % 70;
  return `https://randomuser.me/api/portraits/thumb/${gender}/${idx}.jpg`;
}

function timeAgo(ts: number | string): string {
  const stamp = typeof ts === 'string' ? new Date(ts).getTime() : ts;
  if (!stamp || isNaN(stamp)) return '—';
  const diff = Date.now() - stamp;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const ACTION_COLORS: Record<string, string> = {
  completed: 'text-orange-400',
  started: 'text-orange-400',
  commit: 'text-blue-400',
  pr_opened: 'text-purple-400',
  error: 'text-red-400',
  blocked: 'text-red-400',
};

export function ActiveAgentsPanel({
  workspaces,
  sessions,
}: {
  workspaces: AgentWorkspace[];
  sessions: AgentSession[];
}) {
  const [agentActivity, setAgentActivity] = useState<Record<string, ActivityEntry | null>>({});

  // Build agent list with status
  const allAgents: ActiveAgent[] = workspaces.map(w => {
    const session = sessions.find(s => s.label === w.label);
    return {
      label: w.label,
      name: w.name,
      emoji: w.emoji,
      status: session?.status || 'idle',
      lastActive: session?.lastActive || '',
      lastActivity: agentActivity[w.label] ?? null,
    };
  });

  const activeAgents = allAgents.filter(a => a.status === 'active');
  const idleAgents = allAgents.filter(a => a.status !== 'active');
  const activeCount = activeAgents.length;

  // Fetch latest activity per active agent
  useEffect(() => {
    if (activeAgents.length === 0) return;

    const fetchActivity = async () => {
      const results: Record<string, ActivityEntry | null> = {};
      await Promise.all(
        activeAgents.map(async agent => {
          try {
            const res = await fetch(`/api/activity?agent=${agent.label}&limit=1`);
            if (res.ok) {
              const data = await res.json();
              results[agent.label] = data.entries?.[0] ?? null;
            }
          } catch {
            results[agent.label] = null;
          }
        })
      );
      setAgentActivity(prev => ({ ...prev, ...results }));
    };

    fetchActivity();
    const interval = setInterval(fetchActivity, 15000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCount]);

  if (allAgents.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">Agents</h3>
          {activeCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded-full">
              <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
              <span className="text-[11px] text-orange-400 font-medium">{activeCount} working</span>
            </span>
          )}
          {activeCount === 0 && (
            <span className="text-xs text-zinc-600">all idle</span>
          )}
        </div>
        <Link href="/agents" className="text-xs text-zinc-600 hover:text-orange-400 transition-colors">
          Manage →
        </Link>
      </div>

      {/* Agent rows */}
      <div className="divide-y divide-zinc-800/60">
        {/* Active agents first */}
        {activeAgents.map(agent => (
          <Link key={agent.label} href="/agents" className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/50 transition-colors">
            {/* Avatar with pulse ring */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-orange-500/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={labelToPortrait(agent.label)} alt={agent.name} className="w-full h-full object-cover" />
              </div>
              {/* Animated pulse ring */}
              <span className="absolute inset-0 rounded-full border-2 border-orange-400/40 animate-ping" />
              {/* Status dot */}
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-orange-400 rounded-full border-2 border-zinc-900" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white truncate">{agent.name}</span>
                <span className="text-[10px] text-orange-400 font-medium bg-orange-500/10 px-1.5 py-0.5 rounded">active</span>
              </div>
              {agent.lastActivity ? (
                <p className={`text-xs truncate mt-0.5 ${ACTION_COLORS[agent.lastActivity.action_type] || 'text-zinc-500'}`}>
                  {agent.lastActivity.summary}
                </p>
              ) : (
                <p className="text-xs text-zinc-600 mt-0.5">Working...</p>
              )}
            </div>

            {/* Time */}
            <span className="text-[10px] text-zinc-700 flex-shrink-0 font-mono">
              {agent.lastActivity ? timeAgo(agent.lastActivity.timestamp) : timeAgo(agent.lastActive)}
            </span>
          </Link>
        ))}

        {/* Idle agents — compact row */}
        {idleAgents.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              {idleAgents.map(agent => (
                <Link key={agent.label} href="/agents" className="relative block" title={agent.name}>
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-zinc-700 opacity-50 hover:opacity-80 transition-opacity">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={labelToPortrait(agent.label)} alt={agent.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-zinc-700 rounded-full border border-zinc-900" />
                </Link>
              ))}
            </div>
            <span className="text-xs text-zinc-600">{idleAgents.length} idle</span>
          </div>
        )}
      </div>
    </div>
  );
}
