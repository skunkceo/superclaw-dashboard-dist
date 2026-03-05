'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const GAP  = 3;    // px — gap between cells/columns
const DOW_COL = 22; // px — day-of-week label column width
const MIN_CELL = 11; // minimum cell size
const MAX_CELL = 20; // maximum cell size

// Day-of-week labels (Mon/Wed/Fri only, at rows 1/3/5)
const DOW_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

// ─── Types ───────────────────────────────────────────────────────────────────
interface DayCell { date: string; count: number; }
interface WeekCol { days: DayCell[]; monthLabel?: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function cellColor(count: number) {
  if (count === 0)  return 'bg-zinc-800';
  if (count === 1)  return 'bg-orange-950';
  if (count <= 3)   return 'bg-orange-800';
  if (count <= 6)   return 'bg-orange-600';
  return 'bg-orange-400';
}

function tooltip(date: string, count: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(y, m-1, d).getDay()];
  if (count === 0) return `No commits — ${dow} ${MONTH_NAMES[m-1]} ${d}`;
  return `${count} commit${count===1?'':'s'} — ${dow} ${MONTH_NAMES[m-1]} ${d}`;
}

function buildGrid(commits: Record<string, number>): WeekCol[] {
  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(today);
  start.setDate(start.getDate() - 364);
  start.setDate(start.getDate() - start.getDay());

  const weeks: WeekCol[] = [];
  const cursor = new Date(start);
  const seenMonths = new Set<number>();

  while (cursor <= today) {
    const week: WeekCol = { days: [] };
    for (let i = 0; i < 7; i++) {
      if (cursor > today) {
        week.days.push({ date: '', count: 0 });
      } else {
        const ds = toDateStr(cursor);
        week.days.push({ date: ds, count: commits[ds] ?? 0 });
        if (cursor.getDate() === 1 && weeks.length > 0) {
          const m = cursor.getMonth();
          if (!seenMonths.has(m)) { seenMonths.add(m); week.monthLabel = MONTH_NAMES[m]; }
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function GitHubCommitHeatmap() {
  const [commits, setCommits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [mounted, setMounted] = useState(false);
  const [cellSize, setCellSize] = useState(MIN_CELL);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate cell size based on container width
  const recalcCell = useCallback((width: number, numWeeks: number) => {
    // Available width after DOW column and all gaps
    const available = width - DOW_COL - GAP - (numWeeks - 1) * GAP;
    const computed = Math.floor(available / numWeeks);
    setCellSize(Math.min(MAX_CELL, Math.max(MIN_CELL, computed)));
  }, []);

  useEffect(() => {
    setMounted(true);
    const load = async () => {
      try {
        const res = await fetch('/api/github-activity/commits');
        if (!res.ok) throw new Error();
        setCommits((await res.json()).commitsByDay ?? {});
      } catch { setError(true); }
      finally  { setLoading(false); }
    };
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  }, []);

  const weeks = buildGrid(commits);

  // ResizeObserver to keep cell size in sync with container
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth;
      recalcCell(width, weeks.length);
    });
    observer.observe(el);
    // Initial calc
    recalcCell(el.clientWidth, weeks.length);
    return () => observer.disconnect();
  }, [weeks.length, recalcCell]);

  const total = Object.values(commits).reduce((a, b) => a + b, 0);
  const STEP = cellSize + GAP;

  return (
    <div ref={containerRef} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-white">GitHub Commits</h3>
        {!loading && !error && (
          <span className="text-[11px] text-zinc-500">{total} in last 12 months</span>
        )}
      </div>

      {/* Skeleton — only show after mount to avoid SSR flash */}
      {loading && mounted && (
        <div style={{ display:'flex', gap: GAP }} className="animate-pulse">
          {Array.from({length: 53}, (_,w) => (
            <div key={w} style={{ display:'flex', flexDirection:'column', gap: GAP }}>
              {Array.from({length: 7}, (_,d) => (
                <div key={d} style={{width: MIN_CELL, height: MIN_CELL}} className="bg-zinc-800 rounded-[2px]" />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center justify-center py-6">
          <span className="text-xs text-zinc-600">Could not load commit data</span>
        </div>
      )}

      {/* Heatmap */}
      {!loading && !error && (
        <div style={{ display:'flex', flexDirection:'column', gap: GAP, width: '100%' }}>

          {/* Month label row */}
          <div style={{ display:'flex', gap: GAP, paddingLeft: DOW_COL + GAP }}>
            {weeks.map((week, i) => (
              <div key={i} style={{ width: cellSize, height: 14, flexShrink: 0, position:'relative' }}>
                {week.monthLabel && (
                  <span style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    fontSize: 10,
                    lineHeight: '14px',
                    color: '#71717a',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}>
                    {week.monthLabel}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Grid: day labels + week columns */}
          <div style={{ display:'flex', gap: GAP }}>

            {/* Day-of-week labels */}
            <div style={{ display:'flex', flexDirection:'column', gap: GAP, width: DOW_COL, flexShrink: 0 }}>
              {DOW_LABELS.map((label, i) => (
                <div key={i} style={{ height: cellSize, display:'flex', alignItems:'center', justifyContent:'flex-end' }}>
                  {label && (
                    <span style={{ fontSize: 9, color: '#52525b', lineHeight: 1 }}>{label}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Week columns */}
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display:'flex', flexDirection:'column', gap: GAP, width: cellSize, flexShrink: 0 }}>
                {week.days.map((day, di) => (
                  <div
                    key={di}
                    title={day.date ? tooltip(day.date, day.count) : undefined}
                    style={{ width: cellSize, height: cellSize, borderRadius: 2 }}
                    className={day.date ? cellColor(day.count) : ''}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      {!loading && !error && (
        <div style={{ display:'flex', alignItems:'center', gap: GAP, marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(63,63,70,0.5)' }}>
          <span style={{ fontSize: 10, color: '#52525b', marginRight: 2 }}>Less</span>
          {['bg-zinc-800','bg-orange-950','bg-orange-800','bg-orange-600','bg-orange-400'].map((cls,i) => (
            <div key={i} style={{ width: cellSize, height: cellSize, borderRadius: 2 }} className={cls} />
          ))}
          <span style={{ fontSize: 10, color: '#52525b', marginLeft: 2 }}>More</span>
        </div>
      )}
    </div>
  );
}
