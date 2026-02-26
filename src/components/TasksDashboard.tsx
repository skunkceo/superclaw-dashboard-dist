import { useState } from 'react';
import Link from 'next/link';

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'completed';
  assigned_agent: string | null;
  what_doing: string | null;
  created_at: number;
  completed_at: number | null;
  session_id: string | null;
  source: 'chat' | 'backlog' | 'cron';
  priority?: string;
  area?: string;
}

interface TasksDashboardProps {
  tasks: {
    active: number;
    pending: number;
    completed: number;
    allTasks: Task[];
    mainSession?: {
      status: 'active' | 'idle' | 'done';
      lastActive: string;
      currentTask?: string | null;
      channel?: string;
      model?: string;
      queuedMessages?: number;
    };
  };
}

// Agent definitions with colors
const agents: Record<string, { name: string; color: string }> = {
  seo: { name: 'SEO Agent', color: 'rgb(34, 197, 94)' },
  developer: { name: 'Developer Agent', color: 'rgb(59, 130, 246)' },
  marketing: { name: 'Marketing Agent', color: 'rgb(239, 68, 68)' },
  content: { name: 'Content Agent', color: 'rgb(168, 85, 247)' },
};

// Lobster SVG path
const LobsterPath = () => (
  <path
    d="M50 10c-8 0-15 3-20 8l-5-3c-2-1-4 0-5 2s0 4 2 5l5 3c-2 5-2 11 0 16l-5 3c-2 1-3 3-2 5s3 3 5 2l5-3c5 5 12 8 20 8s15-3 20-8l5 3c2 1 4 0 5-2s0-4-2-5l-5-3c2-5 2-11 0-16l5-3c2-1 3-3 2-5s-3-3-5-2l-5 3c-5-5-12-8-20-8zm-8 15c0-4 4-8 8-8s8 4 8 8-4 8-8 8-8-4-8-8zm16 0c0-2 2-4 4-4s4 2 4 4-2 4-4 4-4-2-4-4zm-24 0c0-2 2-4 4-4s4 2 4 4-2 4-4 4-4-2-4-4z"
  />
);

export function TasksDashboard({ tasks }: TasksDashboardProps) {
  const [view, setView] = useState<'active' | 'completed'>('active');

  const formatTimeAgo = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getStatusBadge = (status: Task['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'completed':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      default:
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
    }
  };

  const getStatusDot = (status: Task['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500 animate-pulse';
      case 'completed':
        return 'bg-blue-500';
      default:
        return 'bg-yellow-500';
    }
  };

  const getSourceBadge = (source: Task['source']) => {
    switch (source) {
      case 'chat':
        return { bg: 'bg-orange-500/20 text-orange-400', icon: '💬', label: 'Chat' };
      case 'backlog':
        return { bg: 'bg-purple-500/20 text-purple-400', icon: '📋', label: 'Backlog' };
      case 'cron':
        return { bg: 'bg-blue-500/20 text-blue-400', icon: '⏰', label: 'Scheduled' };
      default:
        return { bg: 'bg-zinc-500/20 text-zinc-400', icon: '?', label: 'Unknown' };
    }
  };

  const activeTasks = (tasks.allTasks || []).filter(t => t.status === 'active' || t.status === 'pending');
  const completedTasks = (tasks.allTasks || []).filter(t => t.status === 'completed');
  const displayedTasks = view === 'active' ? activeTasks : completedTasks;

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-2 sm:gap-0">
        <h2 className="text-base sm:text-lg font-semibold">Tasks</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('active')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              view === 'active'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Active ({activeTasks.length})
          </button>
          <button
            onClick={() => setView('completed')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              view === 'completed'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Completed ({completedTasks.length})
          </button>
          <Link
            href="/tasks"
            className="px-3 py-1 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            View All →
          </Link>
        </div>
      </div>

      {/* Current Main Session Activity */}
      {tasks.mainSession && tasks.mainSession.status !== 'idle' && (
        <div className="mb-4 p-3 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-lg">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-sm font-medium text-orange-400">Main Session Active</span>
            </div>
            {tasks.mainSession.queuedMessages !== undefined && tasks.mainSession.queuedMessages > 0 && (
              <span className="text-xs text-orange-400/80 bg-orange-500/20 px-2 py-0.5 rounded">
                {tasks.mainSession.queuedMessages} queued
              </span>
            )}
          </div>
          <div className="text-sm text-zinc-300">
            {tasks.mainSession.currentTask ? (
              <>
                discussing "{tasks.mainSession.currentTask}"
                {tasks.mainSession.channel && (
                  <span className="text-zinc-500"> via {tasks.mainSession.channel}</span>
                )}
              </>
            ) : (
              <>
                active
                {tasks.mainSession.channel && (
                  <span className="text-zinc-500"> via {tasks.mainSession.channel}</span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Tasks List */}
      {displayedTasks.length > 0 ? (
        <div className="space-y-3">
          {displayedTasks.slice(0, 6).map((task) => {
            const agent = task.assigned_agent ? agents[task.assigned_agent] : null;
            const source = getSourceBadge(task.source);
            
            return (
              <div
                key={task.id}
                className="p-3 sm:p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800/80 transition-colors cursor-pointer"
                onClick={() => task.session_id && window.open(`/sessions/${task.session_id}`, '_blank')}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDot(task.status)}`} />
                    <span className="font-medium text-sm truncate">{task.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Source badge */}
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${source.bg}`}>
                      {source.icon} {source.label}
                    </span>
                    {/* Status badge */}
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadge(task.status)}`}>
                      {task.status}
                    </span>
                  </div>
                </div>

                {/* Agent assignment */}
                {agent && (
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4" viewBox="0 0 100 100" style={{ color: agent.color }} fill="currentColor">
                      <LobsterPath />
                    </svg>
                    <span className="text-xs" style={{ color: agent.color }}>
                      {agent.name}
                    </span>
                  </div>
                )}

                {/* Current activity */}
                {task.what_doing && (
                  <div className="text-sm text-zinc-300 mb-2 line-clamp-2">
                    <span className="text-zinc-500 text-xs">Currently:</span> {task.what_doing}
                  </div>
                )}

                {/* Metadata */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-zinc-400">
                  <span>{formatTimeAgo(task.created_at)}</span>
                  {task.area && (
                    <>
                      <span className="text-zinc-600 hidden sm:inline">•</span>
                      <span className="capitalize">{task.area}</span>
                    </>
                  )}
                  {task.session_id && (
                    <>
                      <span className="text-zinc-600 hidden sm:inline">•</span>
                      <span className="text-orange-400 hover:text-orange-300 cursor-pointer">View Session</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          
          {displayedTasks.length > 6 && (
            <Link
              href="/tasks"
              className="block p-3 text-center text-sm text-zinc-400 hover:text-white transition-colors border border-zinc-700 border-dashed rounded-lg"
            >
              View {displayedTasks.length - 6} more tasks →
            </Link>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-zinc-500 text-sm">
          {view === 'active' ? 'No active tasks' : 'No completed tasks'}
        </div>
      )}
    </div>
  );
}