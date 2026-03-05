'use client';

import { useEffect, useState } from 'react';
import { TokenUsage } from '@/components/TokenUsage';
import { LobsterLogo } from '@/components/LobsterLogo';
import { ProactivityBanner } from '@/components/ProactivityBanner';
import { AgentActivityFeed } from '@/components/AgentActivityFeed';
import { AgentCommandCenter } from '@/components/AgentCommandCenter';
import GitHubCommitHeatmap from '@/components/GitHubCommitHeatmap';
import { SetupBanner } from '@/components/SetupBanner';
import Link from 'next/link';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { WIDGET_REGISTRY, WidgetLayout } from '@/lib/dashboard-layout';

interface ModelUsage { input: number; output: number; cost: number; }

interface DashboardData {
  health: { status: 'healthy'|'degraded'|'offline'; uptime: string; lastHeartbeat: string; gatewayVersion: string; defaultModel?: string; };
  tokens: { today: number; thisWeek: number; thisMonth: number; allTime?: number; estimatedCost: number; todayCost?: number; weekCost?: number; byModel?: { today?: Record<string,ModelUsage>; thisWeek?: Record<string,ModelUsage>; thisMonth?: Record<string,ModelUsage>; }; };
  subscription?: { provider: string; plan: string; isSubscription?: boolean; } | null;
  setup: { memory: boolean; channels: string[]; skills: string[]; apiKeys: string[]; };
  tasks: { active: number; pending: number; completed: number; allTasks: Array<{ id:string; title:string; status:'pending'|'active'|'completed'; assigned_agent:string|null; what_doing:string|null; created_at:number; completed_at:number|null; session_id:string|null; source:'chat'|'backlog'|'cron'; priority?:string; area?:string; }>; mainSession?: { status:'active'|'idle'|'done'; lastActive:string; recentMessages?:number; currentTask?:string|null; channel?:string; model?:string; totalTokens?:number; queuedMessages?:number; }; allSessions?: Array<{ key:string; sessionId?:string; displayName:string; status:'active'|'idle'|'done'; lastActive:string; model:string; totalTokens:number; messages:Array<{role:string;content:string;timestamp:string}>; }>; activityFeed?: Array<{ type:string; sessionKey:string; sessionName:string; role:string; content:string; timestamp:string; model:string; }>; };
  skills: Array<{ name: string; enabled: boolean; description: string }>;
}

interface AgentData {
  workspaces: Array<{ label:string; name:string; emoji:string; workspacePath:string; hasMemory:boolean; memorySize:number; }>;
  sessions: Array<{ label:string; sessionKey:string; status:'active'|'idle'|'waiting'; lastActive:string; messageCount:number; model:string; task?:string; branch?:string; repo?:string; linearId?:string; }>;
}


interface ActivityEntry { id:string; timestamp:number; agent_label:string; action_type:string; summary:string; details?:string; links?:string; }

// ─── Helpers ───────────────────────────────────────────────────────────────

function timeAgo(ts: number | string): string {
  const stamp = typeof ts === 'string' ? new Date(ts).getTime() : ts;
  if (!stamp || isNaN(stamp)) return '—';
  const diff = Date.now() - stamp;
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const ACTION_ICONS: Record<string,string> = { started:'▶',completed:'✓',commit:'⊕',pr_opened:'⤴',deploy:'↑',error:'✕',blocked:'⊘',research:'◎',analysis:'◈',report:'▤',content:'✎',writing:'✎',monitoring:'◷',intel:'◉',site_check:'◉',info:'◦' };
const ACTION_COLORS: Record<string,string> = { completed:'text-orange-400',commit:'text-blue-400',pr_opened:'text-purple-400',deploy:'text-orange-400',error:'text-red-400',blocked:'text-red-400',started:'text-orange-300',research:'text-zinc-400',analysis:'text-zinc-400' };

// ─── Existing Widgets ──────────────────────────────────────────────────────

function WorkLog() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = async () => { try { const res = await fetch('/api/activity?limit=10'); if (res.ok) { const d = await res.json(); setEntries(d.entries||[]); } } finally { setLoading(false); } };
    load(); const i = setInterval(load, 10000); return () => clearInterval(i);
  }, []);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-white">Work Log</h3><Link href="/activity" className="text-xs text-zinc-500 hover:text-orange-400 transition-colors">View all →</Link></div>
      {loading ? <div className="space-y-2">{[...Array(4)].map((_,i)=><div key={i} className="h-7 bg-zinc-800/60 rounded animate-pulse"/>)}</div>
        : entries.length===0 ? <div className="flex-1 flex items-center justify-center"><span className="text-xs text-zinc-600">No activity logged yet</span></div>
        : <div className="space-y-0 flex-1 min-h-0 overflow-y-auto">{entries.map(entry => {
          const icon=ACTION_ICONS[entry.action_type]||'◦'; const color=ACTION_COLORS[entry.action_type]||'text-zinc-500';
          let links: Array<{label:string;url:string}> = []; try { links=JSON.parse(entry.links||'[]'); } catch {}
          return (<div key={entry.id} className="flex items-start gap-2 py-1.5 border-b border-zinc-800/50 last:border-0">
            <span className={`mt-0.5 w-3.5 flex-shrink-0 text-center text-[11px] font-mono ${color}`}>{icon}</span>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-zinc-300 leading-snug line-clamp-1">{entry.summary}</span>
              {links.length>0 && <div className="flex gap-2 mt-0.5">{links.slice(0,2).map((l,i)=><a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-orange-400/70 hover:text-orange-400 transition-colors" onClick={e=>e.stopPropagation()}>{l.label}</a>)}</div>}
            </div>
            <span className="flex-shrink-0 text-[10px] text-zinc-700 mt-0.5 font-mono whitespace-nowrap">{timeAgo(entry.timestamp)}</span>
          </div>);
        })}</div>}
    </div>
  );
}

function CompactSkills({ skills }: { skills: Array<{name:string;enabled:boolean;description:string}> }) {
  const enabledCount = skills.filter(s=>s.enabled).length;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Skills</h3>
        <div className="flex items-center gap-3"><span className="text-xs text-zinc-600">{enabledCount}/{skills.length} enabled</span><Link href="/skills" className="text-xs text-zinc-500 hover:text-orange-400 transition-colors">Browse →</Link></div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 flex-1">
        {skills.map(skill=>(
          <div key={skill.name} title={skill.description} className={`px-2.5 py-2 rounded-lg border text-xs flex items-center justify-between gap-1.5 ${skill.enabled?'bg-orange-500/5 border-orange-500/20 text-zinc-300':'bg-zinc-800/40 border-zinc-800 text-zinc-600'}`}>
            <span className="truncate font-medium">{skill.name}</span>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${skill.enabled?'bg-orange-400':'bg-zinc-700'}`}/>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-zinc-800"><Link href="/skills" className="text-xs text-zinc-500 hover:text-orange-400 transition-colors">Manage capabilities →</Link></div>
    </div>
  );
}

// ─── New Widgets ───────────────────────────────────────────────────────────

function LinearIssuesWidget() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch('/api/linear/issues').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.issues) setIssues(d.issues.slice(0, 6));
      else setError(true);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  }, []);
  const priorityColor: Record<number,string> = { 1:'text-red-400', 2:'text-orange-400', 3:'text-yellow-400', 4:'text-zinc-500' };
  const priorityLabel: Record<number,string> = { 1:'urgent', 2:'high', 3:'medium', 4:'low' };
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Linear Issues</h3>
        <a href="https://linear.app/skunk-crm" target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 hover:text-orange-400 transition-colors">Open Linear →</a>
      </div>
      {loading ? <div className="space-y-2">{[...Array(3)].map((_,i)=><div key={i} className="h-8 bg-zinc-800/60 rounded animate-pulse"/>)}</div>
        : error ? <div className="flex-1 flex items-center justify-center"><span className="text-xs text-zinc-600">Could not load issues</span></div>
        : issues.length === 0 ? <div className="flex-1 flex items-center justify-center"><span className="text-xs text-zinc-600">No open issues</span></div>
        : <div className="space-y-1.5 flex-1 overflow-y-auto">{issues.map((issue: any) => (
          <a key={issue.id || issue.identifier} href={issue.url} target="_blank" rel="noopener noreferrer"
            className="flex items-start gap-2 p-2 rounded-lg hover:bg-zinc-800/60 transition-colors group">
            <span className={`text-[10px] font-mono mt-0.5 flex-shrink-0 ${priorityColor[issue.priority] || 'text-zinc-500'}`}>
              {issue.identifier || '—'}
            </span>
            <span className="text-xs text-zinc-300 line-clamp-1 flex-1 group-hover:text-white transition-colors">{issue.title}</span>
            <span className="text-[10px] text-zinc-600 flex-shrink-0">{priorityLabel[issue.priority] || ''}</span>
          </a>
        ))}</div>}
    </div>
  );
}

function CronJobsWidget() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/cron').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.jobs) setJobs(d.jobs.slice(0, 6));
    }).finally(() => setLoading(false));
  }, []);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Cron Jobs</h3>
        <Link href="/jobs" className="text-xs text-zinc-500 hover:text-orange-400 transition-colors">Manage →</Link>
      </div>
      {loading ? <div className="space-y-2">{[...Array(4)].map((_,i)=><div key={i} className="h-7 bg-zinc-800/60 rounded animate-pulse"/>)}</div>
        : jobs.length === 0 ? <div className="flex-1 flex items-center justify-center"><span className="text-xs text-zinc-600">No scheduled jobs</span></div>
        : <div className="space-y-1 flex-1 overflow-y-auto">{jobs.map((job: any) => (
          <div key={job.id} className="flex items-center gap-2 py-1.5 border-b border-zinc-800/50 last:border-0">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${job.enabled !== false ? 'bg-green-400' : 'bg-zinc-600'}`} />
            <span className="text-xs text-zinc-300 flex-1 truncate">{job.name || job.id}</span>
            <span className="text-[10px] text-zinc-600 font-mono flex-shrink-0">{job.schedule}</span>
          </div>
        ))}</div>}
    </div>
  );
}

function RecentReportsWidget() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/reports?limit=5').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.reports) setReports(d.reports.slice(0, 5));
    }).finally(() => setLoading(false));
  }, []);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Recent Reports</h3>
        <Link href="/reports" className="text-xs text-zinc-500 hover:text-orange-400 transition-colors">All reports →</Link>
      </div>
      {loading ? <div className="space-y-2">{[...Array(3)].map((_,i)=><div key={i} className="h-12 bg-zinc-800/60 rounded animate-pulse"/>)}</div>
        : reports.length === 0 ? <div className="flex items-center justify-center py-8"><span className="text-xs text-zinc-600">No reports yet</span></div>
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {reports.map((r: any) => (
            <Link key={r.id} href={`/reports/${r.id}`}
              className="p-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-lg transition-colors group">
              <div className="text-xs font-medium text-zinc-200 line-clamp-2 mb-1.5 group-hover:text-white transition-colors">{r.title}</div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-600 px-1.5 py-0.5 bg-zinc-800 rounded">{r.type || 'report'}</span>
                <span className="text-[10px] text-zinc-700 ml-auto">{timeAgo(r.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>}
    </div>
  );
}

function SiteHealthWidget() {
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  useEffect(() => {
    const load = () => fetch('/api/site-health').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.sites) { setSites(d.sites); setCheckedAt(d.checkedAt); }
    }).finally(() => setLoading(false));
    load();
    const i = setInterval(load, 120000);
    return () => clearInterval(i);
  }, []);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Site Health</h3>
        {checkedAt && <span className="text-[10px] text-zinc-700">checked {timeAgo(checkedAt)}</span>}
      </div>
      {loading ? <div className="space-y-2">{[...Array(6)].map((_,i)=><div key={i} className="h-6 bg-zinc-800/60 rounded animate-pulse"/>)}</div>
        : sites.length === 0 ? <div className="flex-1 flex items-center justify-center"><span className="text-xs text-zinc-600">Check failed</span></div>
        : <div className="space-y-1.5 flex-1">{sites.map((site: any) => (
          <div key={site.name} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${site.ok ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-xs text-zinc-400 flex-1 truncate">{site.name}</span>
            <span className={`text-[10px] font-mono flex-shrink-0 ${site.ok ? 'text-zinc-600' : 'text-red-400'}`}>
              {site.status || 'timeout'} {site.ok && site.ms ? `${site.ms}ms` : ''}
            </span>
          </div>
        ))}</div>}
    </div>
  );
}

function GithubActivityWidget() {
  const [prs, setPrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch('/api/github-activity').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.prs) setPrs(d.prs.slice(0, 7));
      else setError(true);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  }, []);
  const stateColor: Record<string,string> = { OPEN:'text-green-400', MERGED:'text-purple-400', CLOSED:'text-zinc-600' };
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">GitHub Activity</h3>
        <a href="https://github.com/skunkceo" target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 hover:text-orange-400 transition-colors">View repos →</a>
      </div>
      {loading ? <div className="space-y-2">{[...Array(4)].map((_,i)=><div key={i} className="h-7 bg-zinc-800/60 rounded animate-pulse"/>)}</div>
        : error ? <div className="flex-1 flex items-center justify-center"><span className="text-xs text-zinc-600">Could not load activity</span></div>
        : prs.length === 0 ? <div className="flex-1 flex items-center justify-center"><span className="text-xs text-zinc-600">No recent PRs</span></div>
        : <div className="space-y-1 flex-1 overflow-y-auto">{prs.map((pr: any, i: number) => (
          <a key={i} href={pr.url} target="_blank" rel="noopener noreferrer"
            className="flex items-start gap-2 py-1.5 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 -mx-1 px-1 rounded transition-colors group">
            <span className={`text-[10px] font-mono mt-0.5 flex-shrink-0 ${stateColor[pr.state] || 'text-zinc-500'}`}>
              #{pr.number}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-zinc-300 line-clamp-1 group-hover:text-white transition-colors">{pr.title}</span>
              <span className="text-[10px] text-zinc-700">{pr.repo}</span>
            </div>
            <span className="text-[10px] text-zinc-700 flex-shrink-0">{timeAgo(pr.createdAt)}</span>
          </a>
        ))}</div>}
    </div>
  );
}

function IntelFeedWidget() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/intel?limit=6').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.items) setItems(d.items.slice(0, 6));
    }).finally(() => setLoading(false));
  }, []);
  const categoryColor: Record<string,string> = {
    competitor: 'text-orange-400', opportunity: 'text-green-400',
    wordpress: 'text-blue-400', market: 'text-purple-400',
    seo: 'text-yellow-400',
  };
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Intel Feed</h3>
        <Link href="/bridge" className="text-xs text-zinc-500 hover:text-orange-400 transition-colors">View all →</Link>
      </div>
      {loading ? <div className="space-y-2">{[...Array(4)].map((_,i)=><div key={i} className="h-8 bg-zinc-800/60 rounded animate-pulse"/>)}</div>
        : items.length === 0 ? <div className="flex-1 flex items-center justify-center"><span className="text-xs text-zinc-600">No intel yet</span></div>
        : <div className="space-y-2 flex-1 overflow-y-auto">{items.map((item: any) => (
          <div key={item.id} className="py-1.5 border-b border-zinc-800/50 last:border-0">
            <div className="flex items-start gap-2">
              <span className={`text-[10px] font-medium flex-shrink-0 mt-0.5 ${categoryColor[item.category] || 'text-zinc-500'}`}>
                {item.category || 'intel'}
              </span>
              <span className="text-xs text-zinc-300 line-clamp-2 flex-1">{item.summary || item.title}</span>
            </div>
            {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-700 hover:text-orange-400 transition-colors truncate block mt-0.5 ml-10">{item.url}</a>}
          </div>
        ))}</div>}
    </div>
  );
}

// ─── Drag-and-Drop Shell ───────────────────────────────────────────────────

function GripIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/>
      <circle cx="3" cy="9" r="1.5"/><circle cx="9" cy="9" r="1.5"/>
    </svg>
  );
}

interface SortableWidgetProps {
  widget: WidgetLayout;
  editMode: boolean;
  onRemove: () => void;
  children: React.ReactNode;
}

function SortableWidget({ widget, editMode, onRemove, children }: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${widget.size === 'full' ? 'lg:col-span-2' : ''} ${isDragging ? 'opacity-50' : ''}`}
    >
      {editMode && (
        <div className="absolute inset-0 bg-zinc-900/10 border-2 border-orange-500/30 rounded-xl z-10 pointer-events-none" />
      )}
      {editMode && (
        <>
          <button
            {...attributes}
            {...listeners}
            className="absolute top-2 left-2 w-6 h-6 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded flex items-center justify-center z-20 cursor-grab active:cursor-grabbing text-zinc-400 hover:text-zinc-200 transition-colors"
            aria-label="Drag to reorder"
          >
            <GripIcon className="w-3 h-3" />
          </button>
          <button
            onClick={onRemove}
            className="absolute top-2 right-2 w-6 h-6 bg-zinc-800 hover:bg-red-900/50 border border-zinc-700 hover:border-red-500/50 rounded flex items-center justify-center z-20 text-zinc-400 hover:text-red-400 transition-colors"
            aria-label="Remove widget"
          >
            ×
          </button>
        </>
      )}
      {children}
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState<DashboardData|null>(null);
  const [agentData, setAgentData] = useState<AgentData|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const { layout, mounted, editMode, setEditMode, reorderWidgets, toggleWidget, reset } = useDashboardLayout();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sRes, aRes] = await Promise.all([fetch('/api/status'), fetch('/api/agents/list')]);
        if (!sRes.ok) throw new Error('Failed to fetch status');
        setData(await sRes.json());
        if (aRes.ok) setAgentData(await aRes.json());
      } catch (err) { setError(err instanceof Error ? err.message : 'Unknown error'); }
      finally { setLoading(false); }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDragStart = (event: DragStartEvent) => setActiveId(event.active.id as string);
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) reorderWidgets(active.id as string, over.id as string);
    setActiveId(null);
  };

  const enabledWidgets = layout.filter(w => w.enabled).sort((a, b) => a.order - b.order);
  const disabledWidgets = layout.filter(w => !w.enabled);

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <LobsterLogo className="w-16 h-16 animate-pulse"/>
        <div className="text-white text-xl">Loading...</div>
      </div>
    </div>
  );
  if (error || !data) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-red-400 text-xl">{error || 'No data'}</div>
    </div>
  );

  const renderWidget = (widgetId: string) => {
    switch (widgetId) {
      case 'health':
        return (
          <div className="flex items-center gap-2 p-3 bg-zinc-900 border border-zinc-800 rounded-xl min-w-0">
            {/* Status dot + label */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${data.health.status==='healthy'?'bg-green-400':data.health.status==='degraded'?'bg-yellow-400':'bg-red-400'}`}/>
              <span className="text-sm text-zinc-300 font-medium capitalize">{data.health.status}</span>
            </div>
            {/* Metadata row — truncates gracefully on mobile */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
              <div className="w-px h-4 bg-zinc-700 flex-shrink-0"/>
              <span className="text-xs text-zinc-500 font-mono truncate max-w-[120px] sm:max-w-none" title={data.health.defaultModel||'claude-sonnet'}>
                {(data.health.defaultModel||'claude-sonnet').replace('anthropic/','')}
              </span>
              <div className="w-px h-4 bg-zinc-700 flex-shrink-0 hidden sm:block"/>
              <span className="text-xs text-zinc-500 flex-shrink-0 hidden sm:block">Up {data.health.uptime}</span>
              {data.subscription && (
                <>
                  <div className="w-px h-4 bg-zinc-700 flex-shrink-0 hidden sm:block"/>
                  <span className="text-xs text-zinc-600 capitalize flex-shrink-0 hidden sm:block">{data.subscription.plan}</span>
                </>
              )}
            </div>
            {/* Launchpad — always visible, pushed right */}
            <div className="flex-shrink-0 ml-auto">
              <Link href="/launchpad" className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg text-xs font-medium hover:bg-orange-500/20 transition-colors whitespace-nowrap">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                <span className="hidden sm:inline">Launchpad</span>
              </Link>
            </div>
          </div>
        );
      case 'files':
        return (
          <div className="flex flex-wrap gap-2">
            {(['SOUL.md','MEMORY.md','TOOLS.md','HEARTBEAT.md'] as const).map(file=>(
              <Link key={file} href={file==='MEMORY.md'?'/memory':`/workspace?file=${file}`} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors font-mono">{file}</Link>
            ))}
            <Link href="/workspace" className="flex items-center gap-1 px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">All files →</Link>
          </div>
        );
      case 'proactivity':    return <ProactivityBanner />;
      case 'token-usage':    return <TokenUsage tokens={data.tokens} subscription={data.subscription}/>;
      case 'work-log':       return <WorkLog/>;
      case 'skills':         return <CompactSkills skills={data.skills}/>;
      case 'agent-command-center': return <AgentCommandCenter />;
      case 'linear-issues':  return <LinearIssuesWidget/>;
      case 'cron-jobs':      return <CronJobsWidget/>;
      case 'recent-reports': return <RecentReportsWidget/>;
      case 'site-health':    return <SiteHealthWidget/>;
      case 'github-activity':return <GithubActivityWidget/>;
      case 'intel-feed':     return <IntelFeedWidget/>;
      case 'github-commits': return <GitHubCommitHeatmap/>;
      default:               return null;
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-6">

        {/* ── Setup Banner ── */}
        <SetupBanner />

        {/* ── Customise bar — always visible when not in edit mode ── */}
        {!editMode && (
          <div className="flex items-center justify-end">
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
              Customise layout
            </button>
          </div>
        )}

        {/* ── Edit mode toolbar ── */}
        {editMode && (
          <div className="bg-zinc-900 border border-orange-500/30 rounded-xl p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 font-medium mr-1">Layout editor</span>
                <button
                  onClick={() => setShowAddPanel(!showAddPanel)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition-colors"
                >
                  {showAddPanel ? 'Close' : '+ Add widget'}
                </button>
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-400 transition-colors"
                >
                  Reset
                </button>
              </div>
              <button
                onClick={() => { setEditMode(false); setShowAddPanel(false); setShowResetConfirm(false); }}
                className="px-4 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-lg text-xs font-medium text-orange-400 transition-colors"
              >
                Done
              </button>
            </div>

            {showAddPanel && disabledWidgets.length > 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-800">
                <p className="text-xs text-zinc-500 mb-2">Available widgets:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {disabledWidgets.map(w => {
                    const def = WIDGET_REGISTRY.find(d => d.id === w.id);
                    if (!def) return null;
                    return (
                      <button
                        key={w.id}
                        onClick={() => toggleWidget(w.id, true)}
                        className="flex items-center justify-between gap-3 px-3 py-2 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 rounded-lg text-left transition-colors group"
                      >
                        <div>
                          <div className="text-xs text-zinc-300 font-medium">{def.name}</div>
                          <div className="text-[10px] text-zinc-500">{def.description}</div>
                        </div>
                        <span className="text-orange-400 text-base group-hover:scale-110 transition-transform flex-shrink-0">+</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {showAddPanel && disabledWidgets.length === 0 && (
              <div className="mt-3 pt-3 border-t border-zinc-800">
                <p className="text-xs text-zinc-500">All widgets are enabled.</p>
              </div>
            )}

            {showResetConfirm && (
              <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between gap-3 bg-zinc-800/50 p-3 rounded-lg">
                <span className="text-sm text-zinc-300">Reset to default layout?</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { reset(); setShowResetConfirm(false); }}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-xs font-medium text-red-400 transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 rounded text-xs font-medium text-zinc-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Widget grid ── */}
        {!mounted ? (
          <div className="space-y-4">
            <div className="h-12 bg-zinc-900 rounded-xl animate-pulse" />
            <div className="h-12 bg-zinc-900 rounded-xl animate-pulse" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="h-32 bg-zinc-900 rounded-xl animate-pulse" />
              <div className="h-32 bg-zinc-900 rounded-xl animate-pulse" />
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={enabledWidgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {enabledWidgets.map(widget => (
                  <SortableWidget
                    key={widget.id}
                    widget={widget}
                    editMode={editMode}
                    onRemove={() => toggleWidget(widget.id, false)}
                  >
                    {renderWidget(widget.id)}
                  </SortableWidget>
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeId ? (
                <div className="opacity-60">{renderWidget(activeId)}</div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

      </div>
    </main>
  );
}
