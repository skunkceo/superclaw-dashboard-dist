'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthWrapper';
import Link from 'next/link';

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
  state: { id: string; name: string; type?: string };
  priority: number;
  labels: { nodes: Array<{ id: string; name: string }> };
  createdAt: string;
  stateType?: string;
}

interface LinearConnection {
  connected: boolean;
  teamName?: string;
  teamId?: string;
}

// Priority colors
const priorityColors: Record<number, { dot: string; label: string }> = {
  0: { dot: 'bg-zinc-500', label: 'None' },
  1: { dot: 'bg-red-500', label: 'Urgent' },
  2: { dot: 'bg-orange-500', label: 'High' },
  3: { dot: 'bg-yellow-500', label: 'Medium' },
  4: { dot: 'bg-zinc-400', label: 'Low' },
};

function IssueCard({ issue, onDispatch, dispatching }: {
  issue: LinearIssue;
  onDispatch: (issue: LinearIssue) => void;
  dispatching: string | null;
}) {
  const priority = priorityColors[issue.priority] || priorityColors[0];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-all">
      <div className="flex items-start gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${priority.dot}`} title={priority.label} />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-zinc-500 mb-1">{issue.identifier}</p>
          <h3 className="text-sm font-medium text-white leading-snug">{issue.title}</h3>
        </div>
      </div>

      {issue.labels.nodes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {issue.labels.nodes.map(label => (
            <span
              key={label.id}
              className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-400 rounded"
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
        <a
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Open in Linear
        </a>
        <button
          onClick={() => onDispatch(issue)}
          disabled={dispatching === issue.id}
          className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {dispatching === issue.id ? 'Dispatching...' : 'Dispatch Agent'}
        </button>
      </div>
    </div>
  );
}

function TaskColumn({ title, count, issues, onDispatch, dispatching }: {
  title: string;
  count: number;
  issues: LinearIssue[];
  onDispatch: (issue: LinearIssue) => void;
  dispatching: string | null;
}) {
  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wide">{title}</h2>
        <span className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-400 rounded-full">
          {count}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-240px)] pr-1">
        {issues.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-sm">
            No tasks
          </div>
        ) : (
          issues.map(issue => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onDispatch={onDispatch}
              dispatching={dispatching}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function TasksPage() {
  const { user } = useAuth();
  const [connection, setConnection] = useState<LinearConnection | null>(null);
  const [issues, setIssues] = useState<LinearIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [dispatching, setDispatching] = useState<string | null>(null);

  const fetchConnection = useCallback(async () => {
    try {
      const res = await fetch('/api/linear/connection');
      if (res.ok) {
        const data = await res.json();
        setConnection(data);
        return data.connected;
      }
    } catch {
      setConnection({ connected: false });
    }
    return false;
  }, []);

  const fetchIssues = useCallback(async () => {
    try {
      const res = await fetch('/api/linear/issues');
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues || []);
      }
    } catch {
      console.error('Failed to fetch issues');
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const connected = await fetchConnection();
      if (connected) {
        await fetchIssues();
      }
      setLoading(false);
    };
    init();
  }, [fetchConnection, fetchIssues]);

  const handleSync = async () => {
    setSyncing(true);
    await fetchIssues();
    setSyncing(false);
  };

  const handleDispatch = async (issue: LinearIssue) => {
    setDispatching(issue.id);
    try {
      const res = await fetch('/api/agents/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: `Work on Linear issue ${issue.identifier}: ${issue.title}\n\n${issue.description || ''}`,
          linearIssueId: issue.id,
        }),
      });

      if (res.ok) {
        // Refresh issues to see updated state
        await fetchIssues();
      }
    } catch (err) {
      console.error('Failed to dispatch agent:', err);
    } finally {
      setDispatching(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-zinc-600 text-sm">Loading...</div>
      </div>
    );
  }

  // Not connected state
  if (!connection?.connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
            <div className="w-16 h-16 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center mx-auto mb-6">
              <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5765C16.4002 93.5921 5.58778 81.8388 1.22541 61.5228Z" fill="#5E6AD2"/>
                <path d="M2.18536 49.5767c-.11318-1.1403.91974-1.9766 2.01365-1.6746l59.5753 16.5137c1.0939.3021 1.3063 1.7315.3947 2.6024L26.8071 97.7899c-.9117.8709-2.3249.5884-2.7086-.5437C17.0289 83.5353 6.31848 67.0816 2.18536 49.5767Z" fill="#5E6AD2"/>
                <path d="M73.8617 97.0059c-.4428-.0895-.8098-.4247-.9574-.8548L48.2607 29.5399c-.2698-.7868.4285-1.5624 1.2287-1.365l43.1879 10.6534c.5998.1479.9706.7478.8364 1.3553-3.4873 15.7746-9.5789 33.6579-19.6521 56.8223Z" fill="#5E6AD2"/>
                <path d="M97.0022 73.3018c-.9094 3.0879-1.9766 6.0691-3.2014 8.942-.6016 1.4116-2.4579 1.6032-3.3364.3442L50.1336 23.2226c-.8786-1.259.1656-2.9803 1.7193-2.835 22.8174 2.1335 37.3408 14.7893 45.1493 52.9142Z" fill="#5E6AD2"/>
                <path d="M92.687 19.8005c-.1557-.8783-.6463-1.6595-1.3573-2.1613C78.3843 8.1115 62.8383 2.87286 46.5882 2.21138c-1.0376-.04224-1.8827.83037-1.7588 1.86195l5.0015 41.6525c.0878.7311.6743 1.3165 1.4053 1.4033l41.6435 4.9395c1.0316.1223 1.9041-.7211 1.8622-1.7588-.5568-13.8192-1.3833-23.0816-2.0559-30.4699Z" fill="#5E6AD2"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Connect Linear to view your tasks</h2>
            <p className="text-sm text-zinc-500 mb-6">
              Link your Linear workspace to see and manage tasks from here.
            </p>
            <Link
              href="/bridge"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
            >
              Go to Bridge
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Sort issues into columns based on state type and priority
  const nowIssues = issues.filter(i =>
    i.stateType === 'started' || i.state?.type === 'started'
  );

  const nextIssues = issues.filter(i => {
    const stateType = i.stateType || i.state?.type;
    const isUnstarted = stateType === 'unstarted';
    const isHighPriority = i.priority === 1 || i.priority === 2;
    return isUnstarted && isHighPriority;
  });

  const laterIssues = issues.filter(i => {
    const stateType = i.stateType || i.state?.type;
    const isUnstarted = stateType === 'unstarted';
    const isBacklog = stateType === 'backlog';
    const isLowPriority = i.priority === 0 || i.priority === 3 || i.priority === 4;
    return isBacklog || (isUnstarted && isLowPriority);
  });

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Tasks</h1>
            <p className="text-sm text-zinc-500 mt-1">
              {connection.teamName} &middot; {issues.length} open issues
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://linear.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Open in Linear
            </a>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </div>

        {/* Three-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <TaskColumn
            title="Now"
            count={nowIssues.length}
            issues={nowIssues}
            onDispatch={handleDispatch}
            dispatching={dispatching}
          />
          <TaskColumn
            title="Next"
            count={nextIssues.length}
            issues={nextIssues}
            onDispatch={handleDispatch}
            dispatching={dispatching}
          />
          <TaskColumn
            title="Later"
            count={laterIssues.length}
            issues={laterIssues}
            onDispatch={handleDispatch}
            dispatching={dispatching}
          />
        </div>
      </div>
    </div>
  );
}
