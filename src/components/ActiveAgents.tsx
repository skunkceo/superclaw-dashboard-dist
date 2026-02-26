'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface AgentWorkspace {
  label: string;
  name: string;
  emoji: string;
  workspacePath: string;
  hasMemory: boolean;
  memorySize: number;
}

interface AgentSession {
  label: string;
  sessionKey: string;
  status: 'active' | 'idle' | 'waiting';
  lastActive: string;
  messageCount: number;
  model: string;
}

interface AgentData {
  workspaces: AgentWorkspace[];
  sessions: AgentSession[];
}

interface ActiveAgentsProps {
  initialData?: AgentData | null;
}

interface DisplayAgent {
  label: string;
  name: string;
  emoji: string;
  status: 'active' | 'idle' | 'waiting';
  lastActive: string;
  messageCount: number;
  memorySize: string;
  currentTask?: string;
  model: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function buildDisplayAgents(data: AgentData): DisplayAgent[] {
  return data.workspaces.map(workspace => {
    const session = data.sessions.find(s => s.label === workspace.label);
    return {
      label: workspace.label,
      name: workspace.name,
      emoji: workspace.emoji,
      status: session?.status || 'idle',
      lastActive: session?.lastActive || 'never',
      messageCount: session?.messageCount || 0,
      memorySize: formatFileSize(workspace.memorySize),
      model: session?.model || 'none'
    };
  });
}

export function ActiveAgents({ initialData }: ActiveAgentsProps) {
  // If initial data provided by parent (parallel fetch), start with it — no skeleton flash
  const [agents, setAgents] = useState<DisplayAgent[]>(
    initialData ? buildDisplayAgents(initialData) : []
  );
  const [loading, setLoading] = useState(!initialData);

  // Sync when parent refreshes initialData
  useEffect(() => {
    if (initialData) {
      setAgents(buildDisplayAgents(initialData));
      setLoading(false);
    }
  }, [initialData]);

  useEffect(() => {
    // Only do own polling if parent didn't provide initial data
    if (initialData) return;

    const fetchAgents = async () => {
      try {
        const res = await fetch('/api/agents/list');
        if (!res.ok) throw new Error('Failed to fetch agents');
        
        const data: AgentData = await res.json();
        setAgents(buildDisplayAgents(data));
      } catch (error) {
        console.error('Error fetching agents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
    const interval = setInterval(fetchAgents, 10000);
    return () => clearInterval(interval);
  }, [initialData]);

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-zinc-800 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-zinc-800 rounded"></div>
            <div className="h-16 bg-zinc-800 rounded"></div>
            <div className="h-16 bg-zinc-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Active Agents</h2>
        <div className="text-center py-8">
          <div className="text-zinc-500 mb-4">No agents configured</div>
          <div className="text-sm text-zinc-600">
            Run <code className="px-2 py-1 bg-zinc-800 rounded">superclaw init</code> to create standard agents
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Active Agents</h2>
          <p className="text-sm text-zinc-400 mt-0.5">Specialized agents handling different workstreams</p>
        </div>
        <Link
          href="/agents"
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 transition"
        >
          View All
        </Link>
      </div>

      {/* Agent List */}
      <div className="divide-y divide-zinc-800">
        {agents.map((agent) => (
          <Link
            key={agent.label}
            href={`/agents/${agent.label}`}
            className="block px-6 py-4 hover:bg-zinc-800/50 transition group"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Left: Agent Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <div className={`w-2 h-2 rounded-full ${
                    agent.status === 'active' ? 'bg-green-400 animate-pulse' :
                    agent.status === 'waiting' ? 'bg-yellow-400' : 'bg-zinc-600'
                  }`} />
                  <h3 className="font-medium text-white group-hover:text-orange-400 transition">
                    {agent.name}
                  </h3>
                  <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-xs rounded font-mono">
                    {agent.label}
                  </span>
                </div>
                
                {agent.currentTask && (
                  <p className="text-sm text-zinc-400 ml-5 mb-2">{agent.currentTask}</p>
                )}

                <div className="flex items-center gap-4 text-xs text-zinc-500 ml-5">
                  <span>{agent.messageCount} messages</span>
                  <span>•</span>
                  <span>{agent.memorySize} memory</span>
                  <span>•</span>
                  <span>Last active {agent.lastActive}</span>
                </div>
              </div>

              {/* Right: Model Badge */}
              <div className="flex-shrink-0">
                {agent.model !== 'none' ? (
                  <div className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-400 font-mono">
                    {agent.model.replace('claude-', '')}
                  </div>
                ) : (
                  <div className="px-2 py-1 bg-zinc-800/50 rounded text-xs text-zinc-600">
                    not active
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-zinc-800/30 border-t border-zinc-800">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-zinc-400">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span>{agents.filter(a => a.status === 'active').length} active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full" />
              <span>{agents.filter(a => a.status === 'waiting').length} waiting</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-zinc-600 rounded-full" />
              <span>{agents.filter(a => a.status === 'idle').length} idle</span>
            </div>
          </div>
          <Link href="/router" className="text-orange-400 hover:text-orange-300">
            Configure Router →
          </Link>
        </div>
      </div>
    </div>
  );
}
