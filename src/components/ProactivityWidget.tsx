'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ProactivitySummary {
  intel: { total: number; unread: number };
  suggestions: { pending: number; approved: number; queued: number };
  overnight: { enabled: boolean; activeRun: boolean; queuedCount: number; lastRunAt: number | null };
  lastRefresh: number | null;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ProactivityWidget() {
  const [data, setData] = useState<ProactivitySummary | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [intelRes, sugRes, nightRes, settingsRes] = await Promise.all([
          fetch('/api/intel?stats=true'),
          fetch('/api/suggestions?stats=true'),
          fetch('/api/overnight'),
          fetch('/api/proactivity/refresh'),
        ]);

        const intel = intelRes.ok ? await intelRes.json() : null;
        const sug = sugRes.ok ? await sugRes.json() : null;
        const night = nightRes.ok ? await nightRes.json() : null;
        const settings = settingsRes.ok ? await settingsRes.json() : null;

        setData({
          intel: { total: intel?.total || 0, unread: intel?.unread || 0 },
          suggestions: {
            pending: sug?.pending || 0,
            approved: sug?.approved || 0,
            queued: sug?.queued || 0,
          },
          overnight: {
            enabled: night?.enabled || false,
            activeRun: !!night?.activeRun,
            queuedCount: night?.queuedCount || 0,
            lastRunAt: night?.lastRun?.started_at || null,
          },
          lastRefresh: settings?.lastRefresh ? parseInt(settings.lastRefresh) : null,
        });
      } catch {
        // Silent fail — widget is non-critical
      }
    };

    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return null;

  const totalAttention = data.suggestions.pending + data.intel.unread;
  const isActive = data.overnight.activeRun;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">Proactivity</h3>
          {totalAttention > 0 && (
            <span className="px-1.5 py-0.5 bg-orange-500 rounded-full text-[10px] font-bold text-white">
              {totalAttention > 99 ? '99+' : totalAttention}
            </span>
          )}
          {isActive && (
            <span className="flex items-center gap-1 text-xs text-orange-400">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              Running
            </span>
          )}
        </div>
        <Link
          href="/bridge"
          className="text-xs text-zinc-500 hover:text-orange-400 transition-colors"
        >
          Open
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="text-xl font-bold text-white">{data.intel.unread}</div>
          <div className="text-xs text-zinc-600 mt-0.5">Unread intel</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-white">{data.suggestions.pending}</div>
          <div className="text-xs text-zinc-600 mt-0.5">Suggestions</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-white">{data.overnight.queuedCount}</div>
          <div className="text-xs text-zinc-600 mt-0.5">Queued</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className={`flex items-center gap-1.5 ${isActive ? 'text-orange-400' : data.overnight.queuedCount > 0 ? 'text-green-400' : 'text-zinc-600'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-orange-400 animate-pulse' : data.overnight.queuedCount > 0 ? 'bg-green-400' : 'bg-zinc-700'}`} />
          {isActive ? 'Overnight run active' : data.overnight.queuedCount > 0 ? `${data.overnight.queuedCount} task${data.overnight.queuedCount !== 1 ? 's' : ''} queued` : 'Overnight idle'}
        </div>
        {data.overnight.lastRunAt && (
          <span className="text-zinc-700">Last run {timeAgo(data.overnight.lastRunAt)}</span>
        )}
      </div>

      {data.suggestions.pending > 0 && (
        <Link
          href="/bridge"
          className="mt-3 flex items-center justify-between w-full px-3 py-2 bg-orange-500/10 hover:bg-orange-500/15 border border-orange-500/20 rounded-lg transition-colors"
        >
          <span className="text-xs text-orange-400 font-medium">
            {data.suggestions.pending} suggestion{data.suggestions.pending !== 1 ? 's' : ''} need review
          </span>
          <svg className="w-3.5 h-3.5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}
