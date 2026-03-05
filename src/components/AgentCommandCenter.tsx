'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

interface AgentSession {
  label: string;
  task?: string;
  branch?: string;
  repo?: string;
  linearId?: string;
  spawned: number;
}

interface ActivityEntry {
  id: string;
  timestamp: number;
  agent_label: string;
  action_type: string;
  summary: string;
  links?: string;
}

interface CronSession {
  sessionKey: string;
  label: string;
  updatedAt: number;
  status: 'running' | 'recent';
  ageMinutes: number;
}

interface SSEData {
  timestamp: number;
  activeAgents: AgentSession[];
  recentActivity: ActivityEntry[];
  recentCronActivity?: CronSession[];
}

interface AgentWorkspace {
  label: string;
  name: string;
  emoji: string;
}

function labelToPortrait(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = Math.imul(31, h) + label.charCodeAt(i) | 0;
  const abs = Math.abs(h);
  const gender = abs % 2 === 0 ? 'men' : 'women';
  const idx = abs % 70;
  return `https://randomuser.me/api/portraits/thumb/${gender}/${idx}.jpg`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const ACTION_ICONS: Record<string, string> = {
  started: '▶',
  completed: '✓',
  commit: '⊕',
  pr_opened: '⤴',
  deploy: '↑',
  error: '✕',
  blocked: '⊘',
  research: '◎',
  analysis: '◈',
  report: '▤',
  content: '✎',
  writing: '✎',
  monitoring: '◷',
  intel: '◉',
  site_check: '◉',
  info: '◦',
};

const ACTION_COLORS: Record<string, string> = {
  completed: 'text-orange-400',
  commit: 'text-blue-400',
  pr_opened: 'text-purple-400',
  deploy: 'text-orange-400',
  error: 'text-red-400',
  blocked: 'text-red-400',
  started: 'text-orange-300',
  research: 'text-zinc-400',
  analysis: 'text-zinc-400',
};

export function AgentCommandCenter() {
  const [allAgents, setAllAgents] = useState<AgentWorkspace[]>([]);
  const [sseData, setSSEData] = useState<SSEData | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sseReady, setSseReady] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch all agent workspaces (one-time)
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch('/api/agents/list');
        if (res.ok) {
          const data = await res.json();
          setAllAgents(data.workspaces || []);
        }
      } catch (error) {
        console.error('Failed to fetch agents:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  // Setup SSE connection
  useEffect(() => {
    const es = new EventSource('/api/agents/events');
    
    es.onopen = () => {
      setConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const data: SSEData = JSON.parse(event.data);
        setSSEData(data);
        setSseReady(true);
      } catch (error) {
        console.error('Failed to parse SSE data:', error);
      }
    };

    es.onerror = () => {
      setConnected(false);
    };

    eventSourceRef.current = es;

    return () => {
      es.close();
      setConnected(false);
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Agents</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-zinc-800/60 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const activeAgents = sseData?.activeAgents || [];
  const recentActivity = sseData?.recentActivity || [];
  const recentCronActivity = sseData?.recentCronActivity || [];

  // Merge all agents with active status
  const mergedAgents = allAgents.map(agent => {
    const active = activeAgents.find(a => a.label === agent.label);
    const lastActivity = recentActivity.find(a => a.agent_label === agent.label);
    
    return {
      ...agent,
      isActive: !!active,
      task: active?.task,
      branch: active?.branch,
      repo: active?.repo,
      linearId: active?.linearId,
      spawned: active?.spawned,
      lastActivity,
    };
  });

  const activeCount = mergedAgents.filter(a => a.isActive).length;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header — mobile-safe: truncate long title, keep badges compact */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white whitespace-nowrap">Agents</h3>
          
          {/* Live indicator */}
          {connected && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full flex-shrink-0">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[10px] text-green-400 font-medium uppercase tracking-wide">Live</span>
            </div>
          )}
          
          {activeCount > 0 && (
            <span className="text-xs text-zinc-600 flex-shrink-0">
              {activeCount} working
            </span>
          )}
        </div>
        <Link href="/agents" className="text-xs text-zinc-500 hover:text-orange-400 transition-colors flex-shrink-0">
          Manage →
        </Link>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
        
        {/* Left: Agents (60% - 3 cols) */}
        <div className="lg:col-span-3 p-4">
          <div className="mb-2">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Active</h4>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {mergedAgents.length === 0 && recentCronActivity.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-sm">No agents configured</div>
            ) : (
              <>
                {/* Active agents first */}
                {mergedAgents
                  .filter(a => a.isActive)
                  .map(agent => (
                    <Link
                      key={agent.label}
                      href="/agents"
                      className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-zinc-800/50 transition-colors group"
                    >
                      {/* Avatar with pulse */}
                      <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-orange-500/60">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={labelToPortrait(agent.label)}
                            alt={agent.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="absolute inset-0 rounded-full border-2 border-orange-400/40 animate-ping" />
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-orange-400 rounded-full border-2 border-zinc-900" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium text-white truncate">{agent.name}</span>
                          <span className="text-[10px] text-orange-400 font-medium bg-orange-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                            running
                          </span>
                        </div>
                        {agent.task ? (
                          <p className="text-xs text-zinc-300 line-clamp-2 leading-snug">{agent.task}</p>
                        ) : (
                          <p className="text-xs text-zinc-600">Working...</p>
                        )}
                        {agent.branch && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] text-zinc-700 font-mono">{agent.branch}</span>
                          </div>
                        )}
                      </div>

                      {/* Time */}
                      {agent.spawned && (
                        <span className="text-[10px] text-zinc-700 flex-shrink-0 mt-0.5 font-mono">
                          {timeAgo(agent.spawned)}
                        </span>
                      )}
                    </Link>
                  ))}

                {/* No active agents — show quiet empty state */}
                {activeCount === 0 && recentCronActivity.length === 0 && (
                  <div className="py-6 text-center text-xs text-zinc-700">No active agents</div>
                )}

                {/* Cron Activity Section */}
                {recentCronActivity.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zinc-800/50">
                    <div className="mb-2">
                      <h4 className="text-[10px] font-medium text-zinc-600 uppercase tracking-wide">Cron Activity</h4>
                    </div>
                    <div className="space-y-1.5">
                      {recentCronActivity.map(cron => (
                        <div
                          key={cron.sessionKey}
                          className="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            cron.status === 'running' ? 'bg-blue-400 animate-pulse' : 'bg-zinc-600'
                          }`} />
                          <span className="text-zinc-400 truncate flex-1">
                            <span className="text-zinc-600">Clawd</span> — {cron.label}
                          </span>
                          <span className="text-[10px] text-zinc-700 font-mono flex-shrink-0">
                            {cron.ageMinutes === 0 ? 'now' : `${cron.ageMinutes}m ago`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right: Recent Activity (40% - 2 cols) */}
        <div className="lg:col-span-2 p-4">
          <div className="mb-2">
            <h4 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Recent Activity</h4>
          </div>
          
          <div className="space-y-0 max-h-96 overflow-y-auto">
            {/* Show skeleton while SSE hasn't delivered first payload yet */}
            {!sseReady ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="animate-pulse py-2 border-b border-zinc-800/50 last:border-0">
                    <div className="flex items-start gap-2">
                      <div className="w-3 h-3 bg-zinc-800 rounded mt-0.5 flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="w-1/2 h-2.5 bg-zinc-800 rounded" />
                        <div className="w-full h-3 bg-zinc-800/70 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-sm">No activity yet</div>
            ) : (
              recentActivity.map(entry => {
                const icon = ACTION_ICONS[entry.action_type] || '◦';
                const color = ACTION_COLORS[entry.action_type] || 'text-zinc-500';
                
                let links: Array<{ label: string; url: string }> = [];
                try {
                  links = JSON.parse(entry.links || '[]');
                } catch {}

                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2 py-2 border-b border-zinc-800/50 last:border-0"
                  >
                    <span className={`mt-0.5 w-3 flex-shrink-0 text-center text-[11px] font-mono ${color}`}>
                      {icon}
                    </span>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] text-zinc-600 font-medium">{entry.agent_label}</span>
                        <span className="text-[10px] text-zinc-800">•</span>
                        <span className="text-[10px] text-zinc-700 font-mono">{timeAgo(entry.timestamp)}</span>
                      </div>
                      <span className="text-xs text-zinc-300 leading-snug line-clamp-2">{entry.summary}</span>
                      
                      {links.length > 0 && (
                        <div className="flex gap-2 mt-0.5">
                          {links.slice(0, 2).map((link, i) => (
                            <a
                              key={i}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-orange-400/70 hover:text-orange-400 transition-colors truncate max-w-[120px]"
                              onClick={e => e.stopPropagation()}
                            >
                              {link.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
