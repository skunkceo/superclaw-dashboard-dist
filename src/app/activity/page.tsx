'use client';

import { useEffect, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityEntry {
  id: string;
  timestamp: number;
  agent_label: string;
  action_type: string;
  summary: string;
  details: string | null;
  links: string;
  task_id: string | null;
  session_key: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Action type config ───────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  started:    { label: 'Started',    color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',       dot: 'bg-blue-400' },
  completed:  { label: 'Completed',  color: 'bg-green-500/15 text-green-400 border-green-500/30',    dot: 'bg-green-400' },
  blocked:    { label: 'Blocked',    color: 'bg-red-500/15 text-red-400 border-red-500/30',          dot: 'bg-red-400' },
  error:      { label: 'Error',      color: 'bg-red-500/15 text-red-400 border-red-500/30',          dot: 'bg-red-400' },
  commit:     { label: 'Commit',     color: 'bg-violet-500/15 text-violet-400 border-violet-500/30', dot: 'bg-violet-400' },
  pr_opened:  { label: 'PR',         color: 'bg-purple-500/15 text-purple-400 border-purple-500/30', dot: 'bg-purple-400' },
  research:   { label: 'Research',   color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', dot: 'bg-yellow-400' },
  analysis:   { label: 'Analysis',   color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', dot: 'bg-yellow-400' },
  report:     { label: 'Report',     color: 'bg-orange-500/15 text-orange-400 border-orange-500/30', dot: 'bg-orange-400' },
  content:    { label: 'Content',    color: 'bg-pink-500/15 text-pink-400 border-pink-500/30',       dot: 'bg-pink-400' },
  writing:    { label: 'Writing',    color: 'bg-pink-500/15 text-pink-400 border-pink-500/30',       dot: 'bg-pink-400' },
  outreach:   { label: 'Outreach',   color: 'bg-teal-500/15 text-teal-400 border-teal-500/30',       dot: 'bg-teal-400' },
  audit:      { label: 'Audit',      color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',       dot: 'bg-cyan-400' },
  sync:       { label: 'Sync',       color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',       dot: 'bg-cyan-400' },
  deploy:     { label: 'Deploy',     color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  info:       { label: 'Info',       color: 'bg-zinc-500/15 text-zinc-400 border-zinc-700',          dot: 'bg-zinc-500' },
  heartbeat:  { label: 'Heartbeat',  color: 'bg-zinc-500/15 text-zinc-400 border-zinc-700',          dot: 'bg-zinc-600' },
  site_check: { label: 'Site check', color: 'bg-green-500/15 text-green-400 border-green-500/30',    dot: 'bg-green-400' },
  intel:      { label: 'Intel',      color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', dot: 'bg-yellow-500' },
  cron:       { label: 'Cron job',   color: 'bg-zinc-500/15 text-zinc-400 border-zinc-700',          dot: 'bg-zinc-500' },
  monitoring: { label: 'Monitoring', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',       dot: 'bg-cyan-400' },
  bug_fix:    { label: 'Bug fix',    color: 'bg-orange-500/15 text-orange-400 border-orange-500/30', dot: 'bg-orange-400' },
  check:      { label: 'Check',      color: 'bg-zinc-500/15 text-zinc-400 border-zinc-700',          dot: 'bg-zinc-500' },
};

function getActionConfig(type: string) {
  return ACTION_CONFIG[type] || ACTION_CONFIG.info;
}

// ─── Agent config ─────────────────────────────────────────────────────────────

// Known agents — matches /agents/ directory + cron labels
const KNOWN_AGENTS: { value: string; label: string; color: string }[] = [
  { value: 'main',             label: 'Clawd',            color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { value: 'crm-engineer',     label: 'CRM Engineer',     color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  { value: 'forms-engineer',   label: 'Forms Engineer',   color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  { value: 'lead-designer',    label: 'Lead Designer',    color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  { value: 'lead-developer',   label: 'Lead Developer',   color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  { value: 'marketing-lead',   label: 'Marketing Lead',   color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  { value: 'martech-engineer', label: 'Martech Engineer', color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
  { value: 'product-manager',  label: 'Product Manager',  color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { value: 'quality-engineer', label: 'Quality Engineer', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  { value: 'seo-specialist',   label: 'SEO Specialist',   color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  { value: 'support-lead',     label: 'Support Lead',     color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { value: 'intel-cron',       label: 'Intel Cron',       color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { value: 'content-agent',    label: 'Content Agent',    color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  { value: 'seo-agent',        label: 'SEO Agent',        color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  { value: 'research-agent',   label: 'Research Agent',   color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
];

const KNOWN_AGENT_VALUES = new Set(KNOWN_AGENTS.map(a => a.value));

function getAgentMeta(label: string) {
  const known = KNOWN_AGENTS.find(a => a.value === label);
  if (known) return known;
  // Partial match (e.g. "crm-engineer-abc123" → crm-engineer)
  const partial = KNOWN_AGENTS.find(a => label.startsWith(a.value));
  if (partial) return { ...partial, value: label };
  // Unknown — generate initials + neutral color
  const initials = label.split('-').map((w: string) => w[0]?.toUpperCase() || '').join('').slice(0, 2);
  return {
    value: label,
    label: label.replace(/-/g, ' '),
    color: 'bg-zinc-500/20 text-zinc-300 border-zinc-700',
    _initials: initials,
  };
}

function getAgentColor(label: string): string {
  return getAgentMeta(label).color;
}

function formatAgentLabel(label: string): string {
  return getAgentMeta(label).label;
}

// ─── Agent avatar ─────────────────────────────────────────────────────────────

function AgentAvatar({ label }: { label: string }) {
  const meta = getAgentMeta(label);
  // Derive bg/text from color string (e.g. "bg-orange-500/20 text-orange-300 ...")
  const bgMatch = meta.color.match(/bg-(\S+)/);
  const textMatch = meta.color.match(/text-(\S+)/);
  const bg = bgMatch ? `bg-${bgMatch[1]}` : 'bg-zinc-700';
  const text = textMatch ? `text-${textMatch[1]}` : 'text-zinc-300';
  // Increase opacity for avatar bg
  const avatarBg = bg.replace('/20', '/30');
  const initials = ('_initials' in meta && typeof meta._initials === 'string')
    ? meta._initials
    : meta.label.split(' ').map((w: string) => w[0]?.toUpperCase() || '').join('').slice(0, 2);
  return (
    <div className={`w-8 h-8 rounded-full ${avatarBg} flex items-center justify-center shrink-0`}>
      <span className={`text-xs font-bold ${text}`}>{initials}</span>
    </div>
  );
}

// ─── Activity item ────────────────────────────────────────────────────────────

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const [expanded, setExpanded] = useState(false);
  const action = getActionConfig(entry.action_type);
  let links: { label: string; url: string }[] = [];
  try { links = JSON.parse(entry.links || '[]'); } catch { links = []; }

  return (
    <div className="flex gap-3 px-5 py-4 group hover:bg-zinc-900/50 transition-colors border-b border-zinc-800/70 last:border-0">
      {/* Avatar */}
      <AgentAvatar label={entry.agent_label} />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2 flex-wrap mb-0.5">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${action.color}`}>
            {action.label}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${getAgentColor(entry.agent_label)}`}>
            {formatAgentLabel(entry.agent_label)}
          </span>
          <span className="text-xs text-zinc-600 ml-auto shrink-0">
            {formatTime(entry.timestamp)} · {timeAgo(entry.timestamp)}
          </span>
        </div>

        <p className="text-sm text-zinc-200 leading-snug mt-1">{entry.summary}</p>

        {entry.details && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-zinc-600 hover:text-zinc-400 mt-1 transition-colors"
          >
            {expanded ? '↑ hide details' : '↓ details'}
          </button>
        )}

        {expanded && entry.details && (
          <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed whitespace-pre-wrap border-l border-zinc-800 pl-3">
            {entry.details}
          </p>
        )}

        {links.length > 0 && (
          <div className="flex gap-2 mt-2 flex-wrap">
            {links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition-colors"
              >
                {link.label} ↗
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Date separator ───────────────────────────────────────────────────────────

function DateSeparator({ ts }: { ts: number }) {
  const today = new Date();
  const d = new Date(ts);
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const label = isToday ? 'Today' : isYesterday ? 'Yesterday' : formatDate(ts);
  return (
    <div className="flex items-center gap-3 px-5 py-2 bg-zinc-950 sticky top-0 z-10 border-b border-zinc-800/70">
      <span className="text-xs text-zinc-500 font-medium">{label}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentFilter, setAgentFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [lastFetched, setLastFetched] = useState<number | null>(null);

  const fetchActivity = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams({ limit: '500' });
    // __other__ = sub-agents not in known list — fetch all and filter client-side
    if (agentFilter !== 'all' && agentFilter !== '__other__') params.set('agent', agentFilter);
    if (actionFilter !== 'all') params.set('type', actionFilter);
    fetch(`/api/activity?${params}`)
      .then(r => r.json())
      .then(d => {
        let fetched: ActivityEntry[] = d.entries || [];
        if (agentFilter === '__other__') {
          fetched = fetched.filter(e => !KNOWN_AGENT_VALUES.has(e.agent_label));
        }
        setEntries(fetched);
        setLastFetched(Date.now());
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [agentFilter, actionFilter]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  // Silent 30s auto-refresh
  useEffect(() => {
    const id = setInterval(() => fetchActivity(true), 30000);
    return () => clearInterval(id);
  }, [fetchActivity]);

  // Group by date
  const grouped: { date: string; ts: number; entries: ActivityEntry[] }[] = [];
  for (const entry of entries) {
    const dateStr = new Date(entry.timestamp).toDateString();
    if (!grouped.length || grouped[grouped.length - 1].date !== dateStr) {
      grouped.push({ date: dateStr, ts: entry.timestamp, entries: [entry] });
    } else {
      grouped[grouped.length - 1].entries.push(entry);
    }
  }

  // Build agent options: only known agents that have entries, in defined order
  const presentAgentValues = new Set(entries.map(e => e.agent_label));
  const agentOptions = KNOWN_AGENTS.filter(a => presentAgentValues.has(a.value));
  // Any unknown labels get a single "Sub-agent" option if any exist
  const hasUnknown = entries.some(e => !KNOWN_AGENT_VALUES.has(e.agent_label));

  // Build action type options from entries, preserving friendly labels
  const presentActions = Array.from(new Set(entries.map(e => e.action_type))).sort();

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Activity</h1>
            <p className="text-base text-zinc-500 mt-1">Everything Clawd and sub-agents have been doing</p>
          </div>
          <div className="flex items-center gap-3">
            {lastFetched && (
              <span className="text-xs text-zinc-600 hidden sm:block">
                Updated {timeAgo(lastFetched)} · auto-refreshing
              </span>
            )}
            <button
              onClick={() => fetchActivity()}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors border border-zinc-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {/* Agent filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500 shrink-0">Agent</label>
            <select
              value={agentFilter}
              onChange={e => setAgentFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-zinc-500 cursor-pointer"
            >
              <option value="all">All agents</option>
              {agentOptions.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
              {hasUnknown && <option value="__other__">Sub-agents (other)</option>}
            </select>
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500 shrink-0">Type</label>
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-zinc-500 cursor-pointer"
            >
              <option value="all">All types</option>
              {presentActions.map(a => (
                <option key={a} value={a}>{getActionConfig(a).label}</option>
              ))}
            </select>
          </div>

          {/* Clear filters */}
          {(agentFilter !== 'all' || actionFilter !== 'all') && (
            <button
              onClick={() => { setAgentFilter('all'); setActionFilter('all'); }}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors px-2 py-1.5"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-16 text-zinc-600 text-sm">Loading activity...</div>
        ) : entries.length === 0 ? (
          <div className="border border-zinc-800 rounded-xl p-16 text-center">
            <div className="text-zinc-600 text-base mb-2">No activity yet</div>
            <p className="text-sm text-zinc-700">Activity is logged as Clawd works. Check back after the next task.</p>
          </div>
        ) : (
          <div className="border border-zinc-800 rounded-xl overflow-hidden">
            {grouped.map((group) => (
              <div key={group.date}>
                <DateSeparator ts={group.ts} />
                {group.entries.map(entry => <ActivityItem key={entry.id} entry={entry} />)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
