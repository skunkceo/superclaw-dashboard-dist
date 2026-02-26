'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthWrapper';
import { useRouter } from 'next/navigation';
import { useChatContext } from '@/lib/chat-context';

interface Issue {
  identifier: string;
  title: string;
  url: string;
  state: { name: string };
  priority: number;
}

interface Project {
  id: string;
  name: string;
  url: string;
  state: string;
  issues: { nodes: Issue[] };
}

interface Initiative {
  id: string;
  name: string;
  status: string;
  description: string | null;
  url: string;
  projects: { nodes: Project[] };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  return `${m}m ago`;
}

function statusColor(status: string) {
  switch (status) {
    case 'Active': return 'bg-green-500/15 text-green-400 border-green-500/30';
    case 'Planned': return 'bg-zinc-700/50 text-zinc-400 border-zinc-600';
    case 'Completed': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    default: return 'bg-zinc-700/50 text-zinc-400 border-zinc-600';
  }
}

function accentColor(status: string) {
  switch (status) {
    case 'Active': return 'bg-green-500';
    case 'Planned': return 'bg-zinc-600';
    case 'Completed': return 'bg-blue-500';
    default: return 'bg-zinc-600';
  }
}

function priorityLabel(p: number) {
  switch (p) {
    case 1: return { label: 'Urgent', cls: 'text-red-400' };
    case 2: return { label: 'High', cls: 'text-orange-400' };
    case 3: return { label: 'Medium', cls: 'text-yellow-400' };
    case 4: return { label: 'Low', cls: 'text-zinc-500' };
    default: return null;
  }
}

function stateColor(name: string) {
  const n = name.toLowerCase();
  if (n.includes('done') || n.includes('completed')) return 'bg-green-500/15 text-green-400';
  if (n.includes('progress') || n.includes('active')) return 'bg-orange-500/15 text-orange-400';
  if (n.includes('review')) return 'bg-blue-500/15 text-blue-400';
  if (n.includes('cancel') || n.includes('duplicate')) return 'bg-zinc-700 text-zinc-500';
  return 'bg-zinc-800 text-zinc-400';
}

function InitiativeCard({ initiative }: { initiative: Initiative }) {
  const [expanded, setExpanded] = useState(true);

  const activeProjects = initiative.projects.nodes.filter(p =>
    !p.state.toLowerCase().includes('complet') && !p.state.toLowerCase().includes('cancel')
  );
  const totalIssues = initiative.projects.nodes.reduce((n, p) => n + p.issues.nodes.length, 0);

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/40">
      {/* Accent bar */}
      <div className={`h-0.5 w-full ${accentColor(initiative.status)}`} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
              <h2 className="text-base font-semibold text-white">{initiative.name}</h2>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(initiative.status)}`}>
                {initiative.status}
              </span>
            </div>
            {initiative.description && (
              <p className="text-sm text-zinc-400 line-clamp-2">{initiative.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={initiative.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-orange-400 hover:text-orange-300 transition-colors whitespace-nowrap"
            >
              View in Linear
            </a>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-zinc-500 mb-4">
          <span>{initiative.projects.nodes.length} project{initiative.projects.nodes.length !== 1 ? 's' : ''}</span>
          <span>{activeProjects.length} active</span>
          {totalIssues > 0 && <span>{totalIssues} recent issue{totalIssues !== 1 ? 's' : ''}</span>}
        </div>

        {/* Projects */}
        {initiative.projects.nodes.length > 0 && (
          <div>
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-3"
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {expanded ? 'Hide' : 'Show'} projects
            </button>

            {expanded && (
              <div className="space-y-3">
                {initiative.projects.nodes.map(project => (
                  <div key={project.id} className="border border-zinc-800 rounded-lg p-3.5 bg-zinc-950/40">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-zinc-200 truncate">{project.name}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${stateColor(project.state)}`}>
                          {project.state}
                        </span>
                      </div>
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0"
                      >
                        Linear
                      </a>
                    </div>

                    {project.issues.nodes.length > 0 ? (
                      <div className="space-y-1.5">
                        {project.issues.nodes.map(issue => {
                          const pri = priorityLabel(issue.priority);
                          return (
                            <a
                              key={issue.identifier}
                              href={issue.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 py-1 group"
                            >
                              <span className="text-[10px] font-mono text-zinc-600 w-12 flex-shrink-0">{issue.identifier}</span>
                              <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition-colors flex-1 truncate">{issue.title}</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {pri && <span className={`text-[10px] ${pri.cls}`}>{pri.label}</span>}
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${stateColor(issue.state.name)}`}>
                                  {issue.state.name}
                                </span>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-700">No recent issues</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {initiative.projects.nodes.length === 0 && (
          <p className="text-xs text-zinc-700">No projects yet</p>
        )}
      </div>
    </div>
  );
}

export default function InitiativesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { setPageContext } = useChatContext();
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/initiatives');
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Error ${res.status}`);
      }
      const data = await res.json();
      setInitiatives(data.initiatives || []);
      setLastRefresh(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load initiatives');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Update chat context when initiatives change
  useEffect(() => {
    setPageContext({ page: 'initiatives', data: { initiatives } });
  }, [initiatives, setPageContext]);

  if (!user) {
    router.push('/login');
    return null;
  }

  const active = initiatives.filter(i => i.status === 'Active').length;
  const planned = initiatives.filter(i => i.status === 'Planned').length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Initiatives</h1>
          <p className="text-sm text-zinc-500">
            {active} active, {planned} planned across {initiatives.length} total
          </p>
          {lastRefresh && (
            <p className="text-xs text-zinc-700 mt-1">Updated {timeAgo(lastRefresh.toISOString())}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://linear.app/skunk-crm/initiatives"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-600 rounded-lg transition-colors"
          >
            Open in Linear
          </a>
          <button
            onClick={load}
            disabled={loading}
            className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 border border-red-500/30 bg-red-500/10 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && initiatives.length === 0 && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-zinc-800 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-zinc-800 rounded w-1/3 mb-3" />
              <div className="h-3 bg-zinc-800 rounded w-2/3 mb-2" />
              <div className="h-3 bg-zinc-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Initiatives list */}
      {!loading && initiatives.length === 0 && !error && (
        <div className="border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-600 text-sm">No initiatives found</p>
        </div>
      )}

      <div className="space-y-4">
        {initiatives.map(initiative => (
          <InitiativeCard key={initiative.id} initiative={initiative} />
        ))}
      </div>
    </div>
  );
}
