'use client';

import { useEffect, useState, useRef } from 'react';

interface PulseData {
  timestamp: string;
  traffic: {
    total: {
      sessions: { current: number; previous: number };
      users: { current: number; previous: number };
      pageViews: { current: number; previous: number };
    };
    bySite: Record<string, {
      current: { sessions: number; users: number; pageViews: number };
      previous: { sessions: number; users: number; pageViews: number };
      daily: Array<{ date: string; sessions: number }>;
      organicDaily: Array<{ date: string; sessions: number }>;
    }>;
  };
  gsc: Record<string, {
    impressions: { current: number; previous: number };
    clicks: { current: number; previous: number };
    daily: Array<{ date: string; impressions: number; clicks: number }>;
  }>;
}

function formatSiteName(host: string): string {
  const map: Record<string, string> = {
    'skunkcrm.com': 'SkunkCRM',
    'skunkforms.com': 'SkunkForms',
    'skunkpages.com': 'SkunkPages',
    'skunkglobal.com': 'SkunkGlobal',
    'skunkanalytics.com': 'SkunkAnalytics',
    'skunksocial.com': 'SkunkSocial',
    'skunkcourses.com': 'SkunkCourses',
    'skunkmemberships.com': 'SkunkMemberships',
  };
  return map[host] || host;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatDate(dateStr: string): string {
  // GA4 returns dates as YYYYMMDD, GSC returns YYYY-MM-DD — normalise to ISO before parsing
  const normalized = dateStr.length === 8
    ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    : dateStr;
  const d = new Date(normalized + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function calculateTrend(current: number, previous: number): { value: number; direction: 'up' | 'down' | 'neutral' } {
  if (previous === 0) return { value: 0, direction: 'neutral' };
  const change = ((current - previous) / previous) * 100;
  if (Math.abs(change) < 0.1) return { value: 0, direction: 'neutral' };
  return { value: change, direction: change > 0 ? 'up' : 'down' };
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  const trend = calculateTrend(current, previous);

  if (trend.direction === 'neutral') {
    return <span className="text-zinc-400 text-sm">—</span>;
  }

  const colorClass = trend.direction === 'up' ? 'text-green-400' : 'text-red-400';
  const arrow = trend.direction === 'up' ? '↑' : '↓';
  const sign = trend.direction === 'up' ? '+' : '';

  return (
    <span className={`${colorClass} text-sm font-medium`}>
      {arrow} {sign}{trend.value.toFixed(1)}%
    </span>
  );
}

interface SeoTooltip {
  index: number;
  x: number;
  y: number;
}

function SeoChart({ daily }: { daily: Array<{ date: string; impressions: number; clicks: number }> }) {
  const [tooltip, setTooltip] = useState<SeoTooltip | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (daily.length === 0) return null;

  const impressions = daily.map(d => d.impressions);
  const clicks = daily.map(d => d.clicks);

  const width = 200;
  const height = 80;
  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const maxImpressions = Math.max(...impressions, 1);
  const maxClicks = Math.max(...clicks, 1);
  const colWidth = chartWidth / daily.length;
  const barWidth = colWidth - 2;

  // Build clicks bezier path
  let clicksPath = '';
  if (clicks.length >= 2) {
    const points = clicks.map((c, i) => ({
      x: padding + i * (chartWidth / (clicks.length - 1)),
      y: height - padding - (c / maxClicks) * (chartHeight * 0.8),
    }));
    clicksPath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const cp1x = points[i].x + (points[i + 1].x - points[i].x) / 3;
      const cp1y = points[i].y;
      const cp2x = points[i].x + 2 * (points[i + 1].x - points[i].x) / 3;
      const cp2y = points[i + 1].y;
      clicksPath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i + 1].x} ${points[i + 1].y}`;
    }
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const col = Math.floor((relX - padding) / colWidth);
    const idx = Math.max(0, Math.min(daily.length - 1, col));
    const tooltipX = (e.clientX - rect.left) / rect.width;
    setTooltip({ index: idx, x: tooltipX, y: 0 });
  };

  const entry = tooltip !== null ? daily[tooltip.index] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Impression bars */}
        {impressions.map((imp, i) => {
          const barHeight = (imp / maxImpressions) * (chartHeight * 0.8);
          const x = padding + i * colWidth + 1;
          const y = height - padding - barHeight;
          const isHovered = tooltip?.index === i;
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={isHovered ? 'rgba(156,163,175,0.85)' : 'rgba(156,163,175,0.5)'}
              rx="1"
            />
          );
        })}

        {/* Clicks bezier line */}
        {clicksPath && (
          <path
            d={clicksPath}
            fill="none"
            stroke="#F97316"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}

        {/* Hovered bar highlight line */}
        {tooltip !== null && (
          <line
            x1={padding + tooltip.index * colWidth + colWidth / 2}
            y1={padding}
            x2={padding + tooltip.index * colWidth + colWidth / 2}
            y2={height - padding}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        )}
      </svg>

      {/* Tooltip */}
      {entry && tooltip !== null && (
        <div
          className="absolute bottom-full mb-1 pointer-events-none z-10"
          style={{
            left: `${Math.min(Math.max(tooltip.x * 100, 10), 75)}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="bg-zinc-700 border border-zinc-600 rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg">
            <div className="text-zinc-300 font-medium mb-1">{formatDate(entry.date)}</div>
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400">Impressions:</span>
              <span className="text-white font-semibold">{entry.impressions.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-orange-400">●</span>
              <span className="text-zinc-400">Clicks:</span>
              <span className="text-white font-semibold">{entry.clicks.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SessionsTooltip {
  index: number;
  x: number;
}

function SessionsChart({
  daily,
  organicDaily,
}: {
  daily: Array<{ date: string; sessions: number }>;
  organicDaily: Array<{ date: string; sessions: number }>;
}) {
  const [tooltip, setTooltip] = useState<SessionsTooltip | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (daily.length === 0) return null;

  const sessions = daily.map(d => d.sessions);
  const organicSessions = organicDaily.map(d => d.sessions);

  const width = 200;
  const height = 80;
  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const maxSessions = Math.max(...sessions, ...organicSessions, 1);
  const colWidth = chartWidth / sessions.length;
  const barWidth = Math.max(1, colWidth - 2);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const col = Math.floor((relX - padding) / colWidth);
    const idx = Math.max(0, Math.min(daily.length - 1, col));
    const tooltipX = (e.clientX - rect.left) / rect.width;
    setTooltip({ index: idx, x: tooltipX });
  };

  const hoveredEntry = tooltip !== null ? {
    date: daily[tooltip.index]?.date,
    total: sessions[tooltip.index] ?? 0,
    organic: Math.min(organicSessions[tooltip.index] ?? 0, sessions[tooltip.index] ?? 0),
  } : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        {sessions.map((total, i) => {
          const organic = Math.min(organicSessions[i] || 0, total);
          const other = Math.max(0, total - organic);

          const totalHeight = Math.min((total / maxSessions) * chartHeight, chartHeight);
          const organicHeight = Math.min((organic / maxSessions) * chartHeight, totalHeight);
          const otherHeight = totalHeight - organicHeight;

          const x = padding + i * colWidth + 1;
          const yBase = height - padding;
          const isHovered = tooltip?.index === i;
          const otherFill = isHovered ? '#6b7280' : '#52525b';
          const organicFill = isHovered ? '#fb923c' : '#f97316';

          return (
            <g key={i}>
              {otherHeight > 0 && (
                <rect
                  x={x}
                  y={yBase - otherHeight}
                  width={barWidth}
                  height={otherHeight}
                  fill={otherFill}
                  rx="1"
                />
              )}
              {organicHeight > 0 && (
                <rect
                  x={x}
                  y={yBase - totalHeight}
                  width={barWidth}
                  height={organicHeight}
                  fill={organicFill}
                  rx="1"
                />
              )}
            </g>
          );
        })}

        {/* Hovered bar guide line */}
        {tooltip !== null && (
          <line
            x1={padding + tooltip.index * colWidth + colWidth / 2}
            y1={padding}
            x2={padding + tooltip.index * colWidth + colWidth / 2}
            y2={height - padding}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        )}
      </svg>

      {/* Tooltip */}
      {hoveredEntry && tooltip !== null && (
        <div
          className="absolute bottom-full mb-1 pointer-events-none z-10"
          style={{
            left: `${Math.min(Math.max(tooltip.x * 100, 10), 75)}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="bg-zinc-700 border border-zinc-600 rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg">
            <div className="text-zinc-300 font-medium mb-1">{formatDate(hoveredEntry.date)}</div>
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400">Total:</span>
              <span className="text-white font-semibold">{hoveredEntry.total.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-orange-400">●</span>
              <span className="text-zinc-400">Organic:</span>
              <span className="text-white font-semibold">{hoveredEntry.organic.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, current, previous }: { label: string; value: string; current: number; previous: number }) {
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
      <div className="text-zinc-400 text-xs mb-1">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-white font-bold text-2xl">{value}</span>
        <TrendBadge current={current} previous={previous} />
      </div>
    </div>
  );
}

function SiteCard({
  siteName,
  ga4Data,
  gscData
}: {
  siteName: string;
  ga4Data?: {
    current: { sessions: number; users: number; pageViews: number };
    previous: { sessions: number; users: number; pageViews: number };
    daily: Array<{ date: string; sessions: number }>;
    organicDaily: Array<{ date: string; sessions: number }>;
  };
  gscData?: {
    impressions: { current: number; previous: number };
    clicks: { current: number; previous: number };
    daily: Array<{ date: string; impressions: number; clicks: number }>;
  };
}) {
  const displayName = formatSiteName(siteName);

  const gscUrl = `https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain:${siteName}`;

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-lg">{displayName}</h3>
        <a
          href={gscUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-orange-400 border border-orange-400 rounded px-2 py-1 hover:bg-orange-400/10 transition-colors"
        >
          View in GSC
        </a>
      </div>

      {/* GA4 Metrics */}
      {ga4Data && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <div className="text-zinc-400 text-xs">Sessions</div>
            <div className="flex items-baseline gap-2">
              <span className="text-white font-bold">{formatNumber(ga4Data.current.sessions)}</span>
              <TrendBadge current={ga4Data.current.sessions} previous={ga4Data.previous.sessions} />
            </div>
          </div>
          <div>
            <div className="text-zinc-400 text-xs">Users</div>
            <div className="flex items-baseline gap-2">
              <span className="text-white font-bold">{formatNumber(ga4Data.current.users)}</span>
              <TrendBadge current={ga4Data.current.users} previous={ga4Data.previous.users} />
            </div>
          </div>
        </div>
      )}

      {/* GSC Metrics */}
      {gscData && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <div className="text-zinc-400 text-xs">Impressions</div>
            <div className="flex items-baseline gap-2">
              <span className="text-white font-bold">{formatNumber(gscData.impressions.current)}</span>
              <TrendBadge current={gscData.impressions.current} previous={gscData.impressions.previous} />
            </div>
          </div>
          <div>
            <div className="text-zinc-400 text-xs">Clicks</div>
            <div className="flex items-baseline gap-2">
              <span className="text-white font-bold">{formatNumber(gscData.clicks.current)}</span>
              <TrendBadge current={gscData.clicks.current} previous={gscData.clicks.previous} />
            </div>
          </div>
        </div>
      )}

      {/* Sparklines */}
      <div className="space-y-3">
        {gscData && gscData.daily.length > 0 && (
          <div className="bg-zinc-900 rounded-lg p-2">
            <div className="text-zinc-500 text-xs mb-1">GSC: Impressions (bars) / Clicks (line)</div>
            <SeoChart daily={gscData.daily} />
          </div>
        )}

        {ga4Data && ga4Data.daily.length > 0 && (
          <div className="bg-zinc-900 rounded-lg p-2">
            <div className="text-zinc-500 text-xs mb-1 flex items-center gap-3">
              <span>Sessions</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-orange-500" />Organic</span>
              <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-zinc-600" />Other</span>
            </div>
            <SessionsChart daily={ga4Data.daily} organicDaily={ga4Data.organicDaily} />
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 animate-pulse">
      <div className="h-6 bg-zinc-700 rounded w-32 mb-4" />
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <div className="h-3 bg-zinc-700 rounded w-16 mb-2" />
          <div className="h-6 bg-zinc-700 rounded w-24" />
        </div>
        <div>
          <div className="h-3 bg-zinc-700 rounded w-16 mb-2" />
          <div className="h-6 bg-zinc-700 rounded w-24" />
        </div>
      </div>
      <div className="bg-zinc-900 rounded-lg p-2 h-20" />
    </div>
  );
}

function SkeletonMetric() {
  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 animate-pulse">
      <div className="h-3 bg-zinc-700 rounded w-20 mb-2" />
      <div className="h-8 bg-zinc-700 rounded w-32" />
    </div>
  );
}

export default function PulsePage() {
  const [data, setData] = useState<PulseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/pulse');
      const json = await res.json();
      if (json.configured === false) {
        setNotConfigured(true);
        setError(null);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to fetch data');
      }
      setData(json);
      setLastUpdated(new Date());
      setError(null);
      setNotConfigured(false);
    } catch (err) {
      setError('Failed to load traffic data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate total GSC metrics
  const totalImpressions = data ? Object.values(data.gsc).reduce((sum, site) => sum + site.impressions.current, 0) : 0;
  const prevImpressions = data ? Object.values(data.gsc).reduce((sum, site) => sum + site.impressions.previous, 0) : 0;
  const totalClicks = data ? Object.values(data.gsc).reduce((sum, site) => sum + site.clicks.current, 0) : 0;
  const prevClicks = data ? Object.values(data.gsc).reduce((sum, site) => sum + site.clicks.previous, 0) : 0;

  // Combine and sort sites
  const sortedSites = data ? (() => {
    const allSites = new Set([
      ...Object.keys(data.traffic.bySite),
      ...Object.keys(data.gsc),
    ]);

    return Array.from(allSites).sort((a, b) => {
      const aGA4 = data.traffic.bySite[a];
      const bGA4 = data.traffic.bySite[b];
      const aGSC = data.gsc[a];
      const bGSC = data.gsc[b];

      // Sites with GA4 traffic first
      if (aGA4 && !bGA4) return -1;
      if (!aGA4 && bGA4) return 1;

      // Within GA4 sites, sort by sessions desc
      if (aGA4 && bGA4) {
        return bGA4.current.sessions - aGA4.current.sessions;
      }

      // GSC-only sites by impressions desc
      const aImp = aGSC?.impressions.current || 0;
      const bImp = bGSC?.impressions.current || 0;
      return bImp - aImp;
    });
  })() : [];

  if (notConfigured) {
    return (
      <div className="min-h-screen bg-zinc-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Traffic</h1>
            <p className="text-zinc-500 text-sm mt-1">GA4 + Search Console</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center max-w-lg mx-auto mt-16">
            <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-white font-semibold text-lg mb-2">Google Analytics not connected</h2>
            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
              Connect a Google service account to see traffic data from GA4 and Search Console across your sites.
            </p>
            <a
              href="/settings#analytics"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm rounded-lg transition-colors"
            >
              Connect Google Analytics
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-8 text-center">
            <div className="text-red-400 text-sm mb-3">Failed to load traffic data</div>
            <button
              onClick={() => { setLoading(true); setError(null); fetchData(); }}
              className="text-orange-400 hover:text-orange-300 text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Traffic</h1>
          {lastUpdated && (
            <p className="text-sm text-zinc-400">
              Last updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Totals bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {loading ? (
            <>
              <SkeletonMetric />
              <SkeletonMetric />
              <SkeletonMetric />
              <SkeletonMetric />
            </>
          ) : data ? (
            <>
              <MetricCard
                label="Sessions (7d)"
                value={formatNumber(data.traffic.total.sessions.current)}
                current={data.traffic.total.sessions.current}
                previous={data.traffic.total.sessions.previous}
              />
              <MetricCard
                label="Users (7d)"
                value={formatNumber(data.traffic.total.users.current)}
                current={data.traffic.total.users.current}
                previous={data.traffic.total.users.previous}
              />
              <MetricCard
                label="Impressions (7d)"
                value={formatNumber(totalImpressions)}
                current={totalImpressions}
                previous={prevImpressions}
              />
              <MetricCard
                label="Clicks (7d)"
                value={formatNumber(totalClicks)}
                current={totalClicks}
                previous={prevClicks}
              />
            </>
          ) : null}
        </div>

        {/* Sites grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : data ? (
            sortedSites.map(site => (
              <SiteCard
                key={site}
                siteName={site}
                ga4Data={data.traffic.bySite[site]}
                gscData={data.gsc[site]}
              />
            ))
          ) : null}
        </div>
      </div>
    </div>
  );
}
