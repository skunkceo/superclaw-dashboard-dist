import { useState } from 'react';
import Link from 'next/link';

interface TasksProps {
  tasks: {
    active: number;
    completed: number;
    subAgents: Array<{
      id: string;
      task: string;
      model: string;
      status: string;
      lastActive?: string;
      messages?: Array<{
        role: string;
        content: string;
        timestamp: string;
      }>;
    }>;
    allSessions?: Array<{
      key: string;
      sessionId?: string;
      displayName: string;
      status: 'active' | 'idle' | 'done';
      lastActive: string;
      model: string;
      totalTokens: number;
      messages: Array<{
        role: string;
        content: string;
        timestamp: string;
      }>;
    }>;
    mainSession?: {
      status: 'active' | 'idle' | 'done';
      lastActive: string;
      recentMessages: number;
      currentTask?: string | null;
      model?: string;
      totalTokens?: number;
    };
    activityFeed?: Array<{
      type: string;
      sessionKey: string;
      sessionName: string;
      role: string;
      content: string;
      timestamp: string;
      model: string;
    }>;
  };
}

const modelDisplayNames: Record<string, string> = {
  'claude-opus-4-6': 'Claude 3 Opus',
  'claude-opus-4-20250514': 'Claude 3 Opus',
  'claude-opus-4-5-20250514': 'Claude 3 Opus',
  'claude-sonnet-4-20250514': 'Claude 3.7 Sonnet',
  'claude-sonnet-4-5-20250514': 'Claude 3.7 Sonnet',
  'claude-haiku-3-5-20241022': 'Claude 3.5 Haiku',
};

function formatModel(raw: string): string {
  if (!raw || raw === 'unknown') return 'unknown';
  const bare = raw.replace('anthropic/', '');
  return modelDisplayNames[bare] || bare.replace('claude-', '').replace(/-\d{8}$/, '');
}

export function ActiveTasks({ tasks }: TasksProps) {
  const [view, setView] = useState<'active' | 'done'>('active');
  const main = tasks.mainSession;
  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const allSessions = tasks.allSessions || [];
  const recentSessions = allSessions.filter(s => s.status === 'active' || s.status === 'idle');
  const archivedSessions = allSessions.filter(s => s.status === 'done');
  const displayedSessions = view === 'active' ? recentSessions : archivedSessions;
  
  return (
    <div className="space-y-6">
      {/* Active Sessions Overview */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-2 sm:gap-0">
          <h2 className="text-base sm:text-lg font-semibold">Sessions</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('active')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                view === 'active'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Recent ({recentSessions.length})
            </button>
            <button
              onClick={() => setView('done')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                view === 'done'
                  ? 'bg-zinc-600/20 text-zinc-300'
                  : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Archived ({archivedSessions.length})
            </button>
          </div>
        </div>

        {/* Sessions List */}
        {displayedSessions.length > 0 ? (
          <div className="space-y-3">
            {displayedSessions.map((session, index) => (
              <Link
                key={session.key}
                href={`/sessions/${session.sessionId || session.key}`}
                className="block p-3 sm:p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800/80 transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm sm:text-base">{session.displayName}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    session.status === 'active' 
                      ? 'bg-green-500/20 text-green-400' 
                      : session.status === 'done'
                      ? 'bg-zinc-700/30 text-zinc-500'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {session.status}
                  </span>
                </div>
                
                {/* Latest message preview */}
                {session.messages && session.messages.length > 0 && (
                  <div className="text-sm text-zinc-300 mb-2 line-clamp-2">
                    <span className="text-zinc-500 font-mono text-xs">
                      {session.messages[session.messages.length - 1].role}:
                    </span>{' '}
                    {session.messages[session.messages.length - 1].content}
                  </div>
                )}
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-zinc-400">
                  <span>Last active: {session.lastActive}</span>
                  <span className="text-zinc-600 hidden sm:inline">•</span>
                  <span className="font-mono">{formatModel(session.model)}</span>
                  {session.totalTokens > 0 && (
                    <>
                      <span className="text-zinc-600 hidden sm:inline">•</span>
                      <span>{session.totalTokens.toLocaleString()} tokens</span>
                    </>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : main ? (
          /* Fallback to main session only */
          <div className="p-3 sm:p-4 bg-zinc-800/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm sm:text-base">Main Session</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                main.status === 'active' 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-zinc-700/50 text-zinc-400'
              }`}>
                {main.status === 'active' ? 'Active' : 'Idle'}
              </span>
            </div>
            {main.currentTask && (
              <div className="text-sm text-white mb-2 line-clamp-2">
                {main.currentTask}
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs sm:text-sm text-zinc-400">
              <span>Last active: {main.lastActive}</span>
              {main.recentMessages > 0 && (
                <>
                  <span className="text-zinc-600 hidden sm:inline">•</span>
                  <span>{main.recentMessages} messages</span>
                </>
              )}
              {main.model && (
                <>
                  <span className="text-zinc-600 hidden sm:inline">•</span>
                  <span className="font-mono">{formatModel(main.model || '')}</span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-zinc-500 text-sm">
            No active sessions
          </div>
        )}
      </div>

      {/* Activity Feed */}
      {tasks.activityFeed && tasks.activityFeed.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-2 sm:gap-0">
            <h2 className="text-base sm:text-lg font-semibold">Recent Activity</h2>
            <div className="text-xs sm:text-sm text-zinc-400">
              Last {tasks.activityFeed.length} messages
            </div>
          </div>
          
          <div className="space-y-3">
            {tasks.activityFeed.map((activity, index) => (
              <div key={`${activity.sessionKey}-${index}`} className="flex items-start gap-3 p-3 bg-zinc-800/30 rounded-lg">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center">
                  <span className="text-xs font-bold text-zinc-400">
                    {activity.role === 'user' ? 'U' : 
                     activity.role === 'assistant' ? 'A' : 'S'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-zinc-200">
                      {activity.sessionName}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {formatTimeAgo(activity.timestamp)} ago
                    </span>
                    <span className="text-xs font-mono text-zinc-600">
                      {formatModel(activity.model)}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-400 line-clamp-2">
                    <span className="text-zinc-500 font-mono text-xs">
                      {activity.role}:
                    </span>{' '}
                    {activity.content}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
