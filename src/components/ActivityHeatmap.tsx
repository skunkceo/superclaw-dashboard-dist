'use client';

import { useEffect, useState } from 'react';

interface DayData {
  date: string;
  count: number;
}

interface WeekData {
  days: DayData[];
}

interface HeatmapData {
  weeks: WeekData[];
  total: number;
  maxCount: number;
}

interface Props {
  agentLabel: string;
  title?: string;
  fullWidth?: boolean;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Each cell: 12px wide + 4px gap = 16px per column
const CELL_PX = 12;
const GAP_PX = 4;
const COL_WIDTH = CELL_PX + GAP_PX; // 16px

function getIntensityClass(count: number, maxCount: number): string {
  if (count === 0) return 'bg-zinc-800';

  const intensity = Math.ceil((count / Math.max(maxCount, 1)) * 4);

  switch (intensity) {
    case 1: return 'bg-orange-950';
    case 2: return 'bg-orange-800';
    case 3: return 'bg-orange-500';
    case 4: return 'bg-orange-400';
    default: return 'bg-orange-400';
  }
}

// Parse a YYYY-MM-DD string without timezone conversion so results are
// consistent in all browser timezones (new Date('2026-02-01') is midnight UTC
// which can land on Jan 31 in western timezones).
function parseDateParts(date: string): { year: number; month: number; day: number; dayOfWeek: number } {
  const [y, m, d] = date.split('-').map(Number);
  const local = new Date(y, m - 1, d); // constructed in local time — no offset issue
  return { year: y, month: m - 1, day: d, dayOfWeek: local.getDay() };
}

function formatTooltip(date: string, count: number): string {
  const { month, day, dayOfWeek } = parseDateParts(date);
  const dayName = DAY_NAMES[dayOfWeek];
  const monthName = MONTH_NAMES[month];

  if (count === 0) return `No activity on ${dayName} ${monthName} ${day}`;
  if (count === 1) return `1 activity on ${dayName} ${monthName} ${day}`;
  return `${count} activities on ${dayName} ${monthName} ${day}`;
}

function getMonthLabels(weeks: WeekData[]): { label: string; colIndex: number }[] {
  if (!weeks.length) return [];

  const labels: { label: string; colIndex: number }[] = [];
  let currentMonth = -1;

  weeks.forEach((week, weekIndex) => {
    // Scan all days (not just day[0]) so a month starting mid-week is detected
    // at the correct column rather than the following Sunday's column.
    for (const day of week.days) {
      if (!day?.date) continue;
      const { month } = parseDateParts(day.date);
      if (month !== currentMonth) {
        currentMonth = month;
        labels.push({ label: MONTH_NAMES[month], colIndex: weekIndex });
        break; // one label change per column is enough
      }
    }
  });

  return labels;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function HeatmapSkeleton({ title }: { title: string }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-white">{title}</h3>
      <div className="overflow-x-auto">
        <div className="w-max">
          {/* Month label row */}
          <div className="h-4 mb-1" />
          <div className="flex gap-[4px]">
            {/* Day label gutter */}
            <div className="flex flex-col gap-[4px] w-8">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="w-3 h-3" />
              ))}
            </div>
            {/* Week columns */}
            {Array.from({ length: 52 }, (_, w) => (
              <div key={w} className="flex flex-col gap-[4px]">
                {Array.from({ length: 7 }, (_, d) => (
                  <div key={d} className="w-3 h-3 bg-zinc-800 rounded-sm animate-pulse" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-zinc-500">Loading contributions...</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ActivityHeatmap({ agentLabel, title = 'Activity', fullWidth = false }: Props) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/agents/${agentLabel}/heatmap`);
        if (!response.ok) throw new Error('Failed to fetch heatmap data');

        setData(await response.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [agentLabel]);

  if (loading) return <HeatmapSkeleton title={title} />;

  if (error) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
          <p className="text-sm text-red-400">Failed to load activity data</p>
          <p className="text-xs text-red-500 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <p className="text-xs text-zinc-500">No activity yet</p>
      </div>
    );
  }

  const monthLabels = getMonthLabels(data.weeks);

  if (fullWidth) {
    // Full-width mode: week columns flex-1, cells are aspect-square
    // Month labels sit in a flex row that mirrors the week columns
    return (
      <div className="space-y-3">
        {title && <h3 className="text-sm font-medium text-white">{title}</h3>}

        <div className="w-full">
          {/* Month labels row — one slot per week column, label appears on first week of each month */}
          <div className="flex gap-[4px] mb-1" style={{ paddingLeft: '36px' }}>
            {data.weeks.map((_, weekIndex) => {
              const monthLabel = monthLabels.find(m => m.colIndex === weekIndex);
              return (
                <div key={weekIndex} className="flex-1 overflow-visible">
                  {monthLabel && (
                    <span className="text-[10px] text-zinc-500 whitespace-nowrap">{monthLabel.label}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Heatmap body */}
          <div className="flex gap-[4px] w-full">
            {/* Day-of-week labels — use h-3 to match fixed cell height */}
            <div className="flex flex-col gap-[4px] w-8 flex-shrink-0">
              {[0, 1, 2, 3, 4, 5, 6].map(dayIndex => (
                <div key={dayIndex} className="h-3 flex items-center justify-end pr-1">
                  {dayIndex % 2 === 1 && (
                    <span className="text-[10px] leading-none text-zinc-600">
                      {(['Mon', 'Wed', 'Fri'] as const)[Math.floor(dayIndex / 2)]}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* One flex-1 column per week — fixed h-3 rows, full width cells */}
            {data.weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex-1 flex flex-col gap-[4px]">
                {week.days.map((day, dayIndex) => (
                  <div
                    key={dayIndex}
                    className={`w-full h-3 rounded-sm ${getIntensityClass(day.count, data.maxCount)}`}
                    title={formatTooltip(day.date, day.count)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-zinc-500">
          {data.total} {data.total === 1 ? 'contribution' : 'contributions'} in the last year
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-white">{title}</h3>

      {/* Scrollable on mobile — heatmap is ~850px wide */}
      <div className="overflow-x-auto">
        <div className="w-max">

          {/* Month labels row — absolutely positioned to align with week columns.
               Layout: 32px day-gutter + 4px gap + (colIndex * 16px) per week column */}
          <div className="relative h-4 mb-1">
            {monthLabels.map((m, i) => (
              <span
                key={i}
                className="absolute text-[10px] text-zinc-500 leading-4"
                style={{ left: `${32 + GAP_PX + m.colIndex * COL_WIDTH}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>

          {/* Heatmap body: day-label gutter + week columns */}
          <div className="flex gap-[4px]">

            {/* Day-of-week labels (7 rows, alternating Mon/Wed/Fri).
                 Each row is h-3 + gap-[4px] — matches cell rows exactly.
                 Text is right-aligned so it sits flush against the grid. */}
            <div className="flex flex-col gap-[4px] w-8 flex-shrink-0">
              {[0, 1, 2, 3, 4, 5, 6].map(dayIndex => (
                <div key={dayIndex} className="h-3 flex items-center justify-end pr-1">
                  {dayIndex % 2 === 1 && (
                    <span className="text-[10px] leading-none text-zinc-600">
                      {(['Mon', 'Wed', 'Fri'] as const)[Math.floor(dayIndex / 2)]}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* One column per week, one cell per day */}
            {data.weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[4px]">
                {week.days.map((day, dayIndex) => (
                  <div
                    key={dayIndex}
                    className={`w-3 h-3 rounded-sm ${getIntensityClass(day.count, data.maxCount)}`}
                    title={formatTooltip(day.date, day.count)}
                  />
                ))}
              </div>
            ))}

          </div>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        {data.total} {data.total === 1 ? 'contribution' : 'contributions'} in the last year
      </p>
    </div>
  );
}
