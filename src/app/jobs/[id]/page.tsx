'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  timezone: string | null;
  description: string;
  model: string | null;
  channel: string | null;
  enabled: boolean;
  nextRun: string | null;
  sessionTarget: string;
}

// ─── Schedule helpers ─────────────────────────────────────────────────────────

type ScheduleMode =
  | 'every-minutes'
  | 'every-hours'
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'custom';

interface ScheduleState {
  mode: ScheduleMode;
  minuteInterval: number;   // for every-minutes
  hourInterval: number;     // for every-hours
  hour: number;             // for daily / weekdays / weekly (0–23)
  minute: number;           // for daily / weekdays / weekly (0–59)
  weekday: number;          // for weekly (0=Sun, 1=Mon…6=Sat)
  rawCron: string;          // for custom
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Parse a schedule string (e.g. "Every 30m", "0 7 * * *") into ScheduleState */
function parseSchedule(raw: string): ScheduleState {
  const s = (raw || '').trim();

  // "Every Xm"
  const minsMatch = s.match(/^every\s+(\d+)m$/i);
  if (minsMatch) {
    return base({ mode: 'every-minutes', minuteInterval: parseInt(minsMatch[1]) });
  }

  // "Every Xh"
  const hoursMatch = s.match(/^every\s+(\d+)h$/i);
  if (hoursMatch) {
    return base({ mode: 'every-hours', hourInterval: parseInt(hoursMatch[1]) });
  }

  // Try cron parsing
  const parts = s.split(/\s+/);
  if (parts.length === 5) {
    const [min, hr, , , dow] = parts;

    // "*/N * * * *" — every N minutes
    const everyMinMatch = min.match(/^\*\/(\d+)$/);
    if (everyMinMatch && hr === '*') {
      return base({ mode: 'every-minutes', minuteInterval: parseInt(everyMinMatch[1]) });
    }

    // "0 */N * * *" — every N hours
    const everyHrMatch = hr.match(/^\*\/(\d+)$/);
    if (everyHrMatch && min === '0') {
      return base({ mode: 'every-hours', hourInterval: parseInt(everyHrMatch[1]) });
    }

    // "MM HH * * *" — daily
    const minN = parseInt(min);
    const hrN = parseInt(hr);
    if (!isNaN(minN) && !isNaN(hrN) && dow === '*') {
      return base({ mode: 'daily', hour: hrN, minute: minN });
    }

    // "MM HH * * 1-5" — weekdays
    if (!isNaN(minN) && !isNaN(hrN) && (dow === '1-5' || dow === 'MON-FRI')) {
      return base({ mode: 'weekdays', hour: hrN, minute: minN });
    }

    // "MM HH * * N" — weekly on day N
    const dowN = parseInt(dow);
    if (!isNaN(minN) && !isNaN(hrN) && !isNaN(dowN) && dowN >= 0 && dowN <= 6) {
      return base({ mode: 'weekly', hour: hrN, minute: minN, weekday: dowN });
    }
  }

  // Fall back to custom
  return base({ mode: 'custom', rawCron: s });
}

function base(overrides: Partial<ScheduleState>): ScheduleState {
  return {
    mode: 'daily',
    minuteInterval: 30,
    hourInterval: 2,
    hour: 7,
    minute: 0,
    weekday: 1,
    rawCron: '',
    ...overrides,
  };
}

/** Convert ScheduleState back to a cron expression string */
function scheduleToString(s: ScheduleState): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  switch (s.mode) {
    case 'every-minutes': return `Every ${s.minuteInterval}m`;
    case 'every-hours':   return `Every ${s.hourInterval}h`;
    case 'daily':         return `${s.minute} ${s.hour} * * *`;
    case 'weekdays':      return `${s.minute} ${s.hour} * * 1-5`;
    case 'weekly':        return `${s.minute} ${s.hour} * * ${s.weekday}`;
    case 'custom':        return s.rawCron;
  }
}

/** Human-readable description of a ScheduleState */
function describeSchedule(s: ScheduleState, tz: string | null): string {
  const tzLabel = tz ? ` (${tz.replace('Europe/', '').replace('_', ' ')})` : ' (UTC)';
  const timeStr = `${s.hour}:${String(s.minute).padStart(2, '0')}${s.hour < 12 ? ' AM' : ' PM'}`.replace(/^(\d+):/, h => {
    const n = parseInt(h);
    return `${n > 12 ? n - 12 : n === 0 ? 12 : n}:`;
  });

  switch (s.mode) {
    case 'every-minutes':
      return s.minuteInterval === 1
        ? 'Every minute'
        : `Every ${s.minuteInterval} minutes`;
    case 'every-hours':
      return s.hourInterval === 1
        ? 'Every hour'
        : `Every ${s.hourInterval} hours`;
    case 'daily':
      return `Every day at ${timeStr}${tzLabel}`;
    case 'weekdays':
      return `Monday to Friday at ${timeStr}${tzLabel}`;
    case 'weekly':
      return `Every ${WEEKDAYS[s.weekday]} at ${timeStr}${tzLabel}`;
    case 'custom':
      return s.rawCron ? 'Custom schedule (cron expression)' : 'No schedule set';
  }
}

// ─── Schedule editor component ────────────────────────────────────────────────

function ScheduleEditor({
  value,
  onChange,
  timezone,
}: {
  value: string;
  onChange: (raw: string) => void;
  timezone: string | null;
}) {
  const [s, setS] = useState<ScheduleState>(() => parseSchedule(value));

  const update = (patch: Partial<ScheduleState>) => {
    const next = { ...s, ...patch };
    setS(next);
    onChange(scheduleToString(next));
  };

  const modeLabel: Record<ScheduleMode, string> = {
    'every-minutes': 'Every N minutes',
    'every-hours':   'Every N hours',
    'daily':         'Daily',
    'weekdays':      'Weekdays only',
    'weekly':        'Weekly',
    'custom':        'Custom (advanced)',
  };

  const inputCls = 'px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 transition-colors w-full';
  const selectCls = inputCls;

  return (
    <div className="space-y-4">

      {/* Mode selector */}
      <div>
        <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Frequency</label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(modeLabel) as ScheduleMode[]).map(m => (
            <button
              key={m}
              onClick={() => update({ mode: m })}
              className={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-all border ${
                s.mode === m
                  ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
              }`}
            >
              {modeLabel[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Mode-specific controls */}
      {s.mode === 'every-minutes' && (
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Run every</label>
          <div className="flex items-center gap-2">
            <select value={s.minuteInterval} onChange={e => update({ minuteInterval: parseInt(e.target.value) })} className={selectCls}>
              {[5, 10, 15, 20, 30, 45].map(n => (
                <option key={n} value={n}>{n} minutes</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {s.mode === 'every-hours' && (
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Run every</label>
          <select value={s.hourInterval} onChange={e => update({ hourInterval: parseInt(e.target.value) })} className={selectCls}>
            {[1, 2, 3, 4, 6, 8, 12].map(n => (
              <option key={n} value={n}>{n === 1 ? '1 hour' : `${n} hours`}</option>
            ))}
          </select>
        </div>
      )}

      {(s.mode === 'daily' || s.mode === 'weekdays' || s.mode === 'weekly') && (
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Time</label>
          <div className="flex items-center gap-2">
            <select value={s.hour} onChange={e => update({ hour: parseInt(e.target.value) })} className={selectCls}>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {i === 0 ? '12 AM (midnight)' : i < 12 ? `${i} AM` : i === 12 ? '12 PM (noon)' : `${i - 12} PM`}
                </option>
              ))}
            </select>
            <select value={s.minute} onChange={e => update({ minute: parseInt(e.target.value) })} className={selectCls}>
              {[0, 15, 30, 45].map(m => (
                <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {s.mode === 'weekly' && (
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Day of week</label>
          <div className="flex gap-1.5 flex-wrap">
            {WEEKDAYS.map((day, i) => (
              <button
                key={i}
                onClick={() => update({ weekday: i })}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  s.weekday === i
                    ? 'bg-orange-500/15 border-orange-500/40 text-orange-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      )}

      {s.mode === 'custom' && (
        <div>
          <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Cron expression</label>
          <input
            type="text"
            value={s.rawCron}
            onChange={e => update({ rawCron: e.target.value })}
            placeholder="e.g. 0 7 * * *"
            className={`${inputCls} font-mono`}
          />
          <p className="text-xs text-zinc-700 mt-1.5">
            Format: minute hour day month weekday — e.g. <code className="text-zinc-500">0 9 * * 1</code> = 9 AM every Monday
          </p>
        </div>
      )}

      {/* Human-readable summary */}
      <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg px-4 py-3">
        <div className="text-xs text-zinc-500 mb-0.5 uppercase tracking-wider font-medium">Runs</div>
        <div className="text-sm text-white font-medium">{describeSchedule(s, timezone)}</div>
        {s.mode !== 'custom' && (
          <div className="text-xs text-zinc-600 mt-1 font-mono">{scheduleToString(s)}</div>
        )}
      </div>
    </div>
  );
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'soon';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  return `in ${Math.floor(hrs / 24)}d`;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [job, setJob] = useState<CronJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState('');
  const [model, setModel] = useState('');
  const [enabled, setEnabled] = useState(true);

  const loadJob = useCallback(async () => {
    try {
      const res = await fetch('/api/cron');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const found: CronJob | undefined = (data.jobs || []).find((j: CronJob) => j.id === id);
      if (!found) { setError('Job not found'); return; }
      setJob(found);
      setName(found.name || '');
      setDescription(found.description || '');
      setSchedule(found.schedule || '');
      setModel(found.model || '');
      setEnabled(found.enabled !== false);
      setHasChanges(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadJob(); }, [loadJob]);

  const handleSave = async () => {
    if (!job) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/cron', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, name, description, schedule, model, enabled }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Save failed');
      }
      const d = await res.json();
      if (d.job) {
        setJob(d.job);
        setName(d.job.name || '');
        setDescription(d.job.description || '');
        setSchedule(d.job.schedule || '');
        setModel(d.job.model || '');
        setEnabled(d.job.enabled !== false);
      }
      setHasChanges(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    if (!job || toggling) return;
    setToggling(true);
    try {
      const res = await fetch('/api/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, enabled: !enabled }),
      });
      if (res.ok) {
        const next = !enabled;
        setEnabled(next);
        setJob(prev => prev ? { ...prev, enabled: next } : null);
      }
    } finally {
      setToggling(false);
    }
  };

  const trackText = (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setter(e.target.value);
      setHasChanges(true);
    };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-zinc-600 text-sm">Loading...</div>
      </div>
    );
  }

  if (error && !job) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-zinc-950">
        <div className="text-red-400 text-sm">{error}</div>
        <Link href="/bridge" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
          Back to Proactivity
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">

      {/* Top bar */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href="/bridge"
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-sm flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Proactivity
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-sm text-zinc-400 truncate">{name || job?.id}</span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={handleToggle}
            disabled={toggling}
            className="flex items-center gap-2 text-sm transition-colors"
          >
            <span className={`text-xs font-medium ${enabled ? 'text-green-400' : 'text-zinc-600'}`}>
              {enabled ? 'Enabled' : 'Disabled'}
            </span>
            <div className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${toggling ? 'opacity-50' : ''} ${enabled ? 'bg-green-500' : 'bg-zinc-700'}`}>
              <div className={`absolute w-4 h-4 rounded-full bg-white top-0.5 transition-all ${enabled ? 'left-4' : 'left-0.5'}`} />
            </div>
          </button>

          {hasChanges && <span className="text-xs text-amber-400">Unsaved changes</span>}
          {saved && <span className="text-xs text-green-400">Saved</span>}

          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-orange-500 hover:bg-orange-600 text-white"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel */}
        <div className="w-80 flex-shrink-0 border-r border-zinc-800 bg-zinc-900/30 overflow-y-auto p-5 space-y-6">

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Job name</label>
            <input
              type="text"
              value={name}
              onChange={trackText(setName)}
              placeholder="e.g. Daily Morning Brief"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Schedule builder */}
          <ScheduleEditor
            value={schedule}
            onChange={raw => { setSchedule(raw); setHasChanges(true); }}
            timezone={job?.timezone || null}
          />

          {/* Model */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Model</label>
            <select
              value={model}
              onChange={e => { setModel(e.target.value); setHasChanges(true); }}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
            >
              <option value="">Default</option>
              <option value="claude-haiku-4-20250514">Haiku (fast, cheap)</option>
              <option value="claude-sonnet-4-20250514">Sonnet (balanced)</option>
              <option value="claude-opus-4-5">Opus (most capable)</option>
            </select>
          </div>

          {/* Info */}
          <div className="border-t border-zinc-800 pt-4 space-y-3">
            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">Info</div>

            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-zinc-600">Job ID</span>
              <span className="text-xs text-zinc-600 font-mono truncate max-w-[130px]" title={job?.id}>{job?.id?.slice(0, 12)}…</span>
            </div>
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-zinc-600">Session</span>
              <span className="text-xs text-zinc-400">{job?.sessionTarget || 'isolated'}</span>
            </div>
            {job?.channel && (
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-zinc-600">Posts to</span>
                <span className="text-xs text-zinc-400">{job.channel}</span>
              </div>
            )}
            {job?.nextRun && enabled && (
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-zinc-600">Next run</span>
                <span className="text-xs text-green-400">{timeUntil(job.nextRun)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right panel — prompt editor */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-5 pb-3 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white">What should Clawd do?</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Describe the task in plain English. Clawd will run this on the schedule you set.
            </p>
          </div>
          <div className="flex-1 p-6">
            <textarea
              value={description}
              onChange={trackText(setDescription)}
              placeholder="e.g. Check if there are any urgent emails in the inbox and send a summary to #dailies. Focus on anything that needs a response today."
              className="w-full h-full min-h-[400px] px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 text-sm leading-relaxed focus:outline-none focus:border-orange-500/50 resize-none transition-colors"
              spellCheck
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
