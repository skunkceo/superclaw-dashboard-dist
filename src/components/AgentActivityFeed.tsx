'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ActivityEntry {
  id: string;
  timestamp: number;        // milliseconds
  agent_label: string;
  action_type: string;
  summary: string;
  details: string | null;
  links: string;            // JSON string: [{label: string, url: string}]
  task_id: string | null;
  session_key: string | null;
}

export function AgentActivityFeed() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = async () => {
    try {
      const response = await fetch('/api/activity?limit=15');
      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }
      const data = await response.json();
      setActivities(data.entries || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, []);

  const getActionTypeBadgeColor = (actionType: string) => {
    switch (actionType.toLowerCase()) {
      case 'completed':
        return 'bg-green-500/20 text-green-400';
      case 'started':
        return 'bg-orange-500/20 text-orange-400';
      case 'error':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-zinc-700 text-zinc-400';
    }
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Agent Activity</h3>
          <Link href="/activity" className="text-sm text-orange-400 hover:text-orange-300">
            View all →
          </Link>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-16 h-4 bg-zinc-800 rounded"></div>
                <div className="flex-1">
                  <div className="w-full h-4 bg-zinc-800 rounded mb-2"></div>
                  <div className="w-3/4 h-3 bg-zinc-800 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Agent Activity</h3>
        <Link href="/activity" className="text-sm text-orange-400 hover:text-orange-300">
          View all →
        </Link>
      </div>

      {error ? (
        <div className="text-center py-8 text-zinc-500">
          <p className="mb-2">Failed to load activity</p>
          <button 
            onClick={fetchActivities}
            className="text-orange-400 hover:text-orange-300 text-sm"
          >
            Try again
          </button>
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">
          No activity yet
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {activities.map((entry) => {
            const links = entry.links ? JSON.parse(entry.links) : [];
            
            return (
              <div key={entry.id} className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg">
                {/* Agent label and action type */}
                <div className="flex-shrink-0 space-y-1">
                  <Link 
                    href={`/agents/${entry.agent_label}`}
                    className="inline-block px-2 py-0.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 hover:text-white rounded text-xs font-mono transition-colors"
                  >
                    {entry.agent_label}
                  </Link>
                  <div className="flex">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getActionTypeBadgeColor(entry.action_type)}`}>
                      {entry.action_type}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white mb-1">{entry.summary}</p>
                  
                  {/* Links */}
                  {links.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-1">
                      {links.map((link: { label: string; url: string }, i: number) => (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors"
                        >
                          {link.label}
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  )}
                  
                  <div className="text-xs text-zinc-500">
                    {formatRelativeTime(entry.timestamp)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}