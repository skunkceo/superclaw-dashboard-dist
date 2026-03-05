'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Report {
  id: string;
  title: string;
  type: 'sprint' | 'research' | 'seo' | 'competitor' | 'content' | 'intelligence' | 'general';
  suggestion_id: string | null;
  overnight_run_id: string | null;
  created_at: number;
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

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Type config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, {
  label: string;
  badge: string;
  avatar: { bg: string; text: string; initials: string };
}> = {
  sprint:       { label: 'Sprint',       badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30',    avatar: { bg: 'bg-orange-500/25', text: 'text-orange-300', initials: 'SP' } },
  research:     { label: 'Research',     badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',          avatar: { bg: 'bg-blue-500/25',   text: 'text-blue-300',   initials: 'RE' } },
  seo:          { label: 'SEO',          badge: 'bg-green-500/15 text-green-400 border-green-500/30',       avatar: { bg: 'bg-green-500/25',  text: 'text-green-300',  initials: 'SEO' } },
  competitor:   { label: 'Competitor',   badge: 'bg-red-500/15 text-red-400 border-red-500/30',             avatar: { bg: 'bg-red-500/25',    text: 'text-red-300',    initials: 'CO' } },
  content:      { label: 'Content',      badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30',   avatar: { bg: 'bg-purple-500/25', text: 'text-purple-300', initials: 'CT' } },
  intelligence: { label: 'Intelligence', badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',   avatar: { bg: 'bg-yellow-500/25', text: 'text-yellow-300', initials: 'IN' } },
  general:      { label: 'General',      badge: 'bg-zinc-500/15 text-zinc-400 border-zinc-700',             avatar: { bg: 'bg-zinc-700',      text: 'text-zinc-300',   initials: 'GE' } },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.general;
}

function TypeAvatar({ type }: { type: string }) {
  const { avatar } = getTypeConfig(type);
  return (
    <div className={`w-10 h-10 rounded-full ${avatar.bg} flex items-center justify-center shrink-0`}>
      <span className={`text-xs font-bold ${avatar.text}`}>{avatar.initials}</span>
    </div>
  );
}

// ─── Group separator ──────────────────────────────────────────────────────────

function GroupSeparator({ label, ts, type, count }: { label: string; ts: number; type?: string; count: number }) {
  const today = new Date();
  const d = new Date(ts);
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const displayLabel = type ? `${label} (${count})` : (isToday ? 'Today' : isYesterday ? 'Yesterday' : formatDate(ts));
  
  return (
    <div className="flex items-center gap-3 px-5 py-2 bg-zinc-950 border-b border-zinc-800/70">
      <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{displayLabel}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  // Reset scroll position on mount (unless navigating to anchor/fragment)
  useEffect(() => {
    if (!window.location.hash) {
      window.scrollTo(0, 0);
    }
  }, []);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<'date' | 'type'>('date');

  const fetchReports = useCallback(() => {
    setLoading(true);
    fetch('/api/reports?limit=100')
      .then(r => r.json())
      .then(d => { setReports(d.reports || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const filtered = reports;

  // Group by date or type
  const grouped: { label: string; key: string; ts: number; type?: string; reports: Report[] }[] = [];
  
  if (groupBy === 'date') {
    for (const r of filtered) {
      const dateStr = new Date(r.created_at).toDateString();
      if (!grouped.length || grouped[grouped.length - 1].key !== dateStr) {
        grouped.push({ label: dateStr, key: dateStr, ts: r.created_at, reports: [r] });
      } else {
        grouped[grouped.length - 1].reports.push(r);
      }
    }
  } else {
    // Group by type
    const byType: Record<string, Report[]> = {};
    for (const r of filtered) {
      if (!byType[r.type]) byType[r.type] = [];
      byType[r.type].push(r);
    }
    for (const [type, typeReports] of Object.entries(byType)) {
      const cfg = getTypeConfig(type);
      grouped.push({
        label: cfg.label,
        key: type,
        ts: typeReports[0].created_at,
        type,
        reports: typeReports,
      });
    }
    // Sort by count descending
    grouped.sort((a, b) => b.reports.length - a.reports.length);
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Reports</h1>
            <p className="text-base text-zinc-500 mt-1">
              Research, sprints and analysis from overnight runs
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setGroupBy(groupBy === 'date' ? 'type' : 'date')}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors border border-zinc-700"
              title={groupBy === 'date' ? 'Switch to type grouping' : 'Switch to date grouping'}
            >
              {groupBy === 'date' ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  By date
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  By type
                </span>
              )}
            </button>
            <button
              onClick={fetchReports}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors border border-zinc-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Inbox */}
        {loading ? (
          <div className="text-center py-16 text-zinc-600 text-sm">Loading reports...</div>
        ) : filtered.length === 0 ? (
          <div className="border border-zinc-800 rounded-xl p-16 text-center">
            <div className="text-zinc-600 text-base mb-2">No reports yet</div>
            <p className="text-sm text-zinc-700">
              Reports are generated when Clawd completes overnight tasks or research runs.
            </p>
          </div>
        ) : (
          <div className="border border-zinc-800 rounded-xl overflow-hidden">
            {grouped.map((group) => (
              <div key={group.key}>
                <GroupSeparator label={group.label} ts={group.ts} type={group.type} count={group.reports.length} />
                <div className="divide-y divide-zinc-800/70">
                  {group.reports.map((report) => {
                    const cfg = getTypeConfig(report.type);
                    const isGeneral = report.type === 'general';
                    return (
                      <Link
                        key={report.id}
                        href={`/reports/${report.id}`}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-900/60 transition-colors group"
                      >
                        {/* Avatar */}
                        <TypeAvatar type={report.type} />

                        {/* Body */}
                        <div className="flex-1 min-w-0">
                          {!isGeneral && (
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${cfg.badge}`}>
                                {cfg.label}
                              </span>
                            </div>
                          )}
                          <h3 className={`text-sm ${isGeneral ? 'font-semibold' : 'font-medium'} text-zinc-200 group-hover:text-white transition-colors leading-snug truncate ${isGeneral ? 'mt-0' : ''}`}>
                            {report.title}
                          </h3>
                        </div>

                        {/* Date */}
                        <div className="shrink-0 text-right hidden sm:block">
                          <div className="text-xs text-zinc-500">{formatDateShort(report.created_at)}</div>
                          <div className="text-xs text-zinc-700">{timeAgo(report.created_at)}</div>
                        </div>

                        {/* Chevron */}
                        <svg className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
