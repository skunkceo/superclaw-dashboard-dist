'use client';

import { useEffect, useState } from 'react';

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

function seoChart(impressions: number[], clicks: number[]): string {
  if (impressions.length === 0) return '';

  const width = 200;
  const height = 80;
  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const maxImpressions = Math.max(...impressions, 1);
  const maxClicks = Math.max(...clicks, 1);

  const barWidth = chartWidth / impressions.length - 2;

  // Impressions bars
  const bars = impressions.map((imp, i) => {
    const barHeight = (imp / maxImpressions) * (chartHeight * 0.8);
    const x = padding + i * (chartWidth / impressions.length) + 1;
    const y = height - padding - barHeight;
    return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="rgba(156,163,175,0.5)" rx="1"/>`;
  }).join('');

  // Clicks line (bezier curve)
  if (clicks.length < 2) return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;

  const points = clicks.map((c, i) => {
    const x = padding + i * (chartWidth / (clicks.length - 1));
    const y = height - padding - (c / maxClicks) * (chartHeight * 0.8);
    return { x, y };
  });

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const cp1x = points[i].x + (points[i + 1].x - points[i].x) / 3;
    const cp1y = points[i].y;
    const cp2x = points[i].x + 2 * (points[i + 1].x - points[i].x) / 3;
    const cp2y = points[i + 1].y;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${points[i + 1].x} ${points[i + 1].y}`;
  }

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    ${bars}
    <path d="${path}" fill="none" stroke="#F97316" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function sessionsChart(sessions: number[], organicSessions: number[]): string {
  if (sessions.length === 0) return '';

  const width = 200;
  const height = 80;
  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const maxSessions = Math.max(...sessions, 1);
  const barWidth = chartWidth / sessions.length - 2;

  const bars = sessions.map((total, i) => {
    const organic = organicSessions[i] || 0;
    const other = Math.max(0, total - organic);

    const totalHeight = (total / maxSessions) * chartHeight;
    const organicHeight = (organic / maxSessions) * chartHeight;
    const otherHeight = totalHeight - organicHeight;

    const x = padding + i * (chartWidth / sessions.length) + 1;
    const yBase = height - padding;

    // Other traffic (orange) at bottom
    const otherBar = `<rect x="${x}" y="${yBase - otherHeight}" width="${barWidth}" height="${otherHeight}" fill="#F97316" rx="1"/>`;
    // Organic (zinc-300) on top
    const organicBar = `<rect x="${x}" y="${yBase - totalHeight}" width="${barWidth}" height="${organicHeight}" fill="#d4d4d8" rx="1"/>`;

    return otherBar + organicBar;
  }).join('');

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
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

  const sessions = ga4Data?.daily.map(d => d.sessions) || [];
  const organicSessions = ga4Data?.organicDaily.map(d => d.sessions) || [];
  const impressions = gscData?.daily.map(d => d.impressions) || [];
  const clicks = gscData?.daily.map(d => d.clicks) || [];

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
        {gscData && impressions.length > 0 && (
          <div className="bg-zinc-900 rounded-lg p-2">
            <div className="text-zinc-500 text-xs mb-1">GSC: Impressions (bars) / Clicks (line)</div>
            <div dangerouslySetInnerHTML={{ __html: seoChart(impressions, clicks) }} />
          </div>
        )}

        {ga4Data && sessions.length > 0 && (
          <div className="bg-zinc-900 rounded-lg p-2">
            <div className="text-zinc-500 text-xs mb-1">Sessions: Organic (light) / Other (orange)</div>
            <div dangerouslySetInnerHTML={{ __html: sessionsChart(sessions, organicSessions) }} />
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/pulse');
      if (!res.ok) {
        throw new Error('Failed to fetch data');
      }
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date());
      setError(null);
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

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-8 text-center">
            <div className="text-red-400 text-lg mb-2">Failed to load traffic data</div>
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
