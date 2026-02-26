import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getGA4Credentials } from '@/lib/integrations';
import { getBridgeCache, setBridgeCache } from '@/lib/db';
import { google } from 'googleapis';

interface GA4Data {
  sessions: number;
  previousSessions: number;
  sessionsChange: number;
  organicSessions: number;
  organicPercent: number;
  topPages: Array<{
    path: string;
    sessions: number;
    pageviews: number;
  }>;
  fetchedAt: number;
}

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';

  // Check cache first (6 hour TTL)
  if (!force) {
    const cached = getBridgeCache('ga4_data');
    if (cached) {
      return NextResponse.json(cached);
    }
  }

  const creds = getGA4Credentials();
  if (!creds) {
    return NextResponse.json(
      { error: 'GA4 not configured' },
      { status: 400 }
    );
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: creds.clientEmail,
        private_key: creds.privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });

    const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });

    // Current 7 days
    const currentResponse = await analyticsdata.properties.runReport({
      property: creds.propertyId,
      requestBody: {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        metrics: [
          { name: 'sessions' },
          { name: 'screenPageViews' },
        ],
        dimensions: [{ name: 'pagePath' }, { name: 'sessionDefaultChannelGroup' }],
        limit: '100',
      },
    });

    // Previous 7 days for comparison
    const previousResponse = await analyticsdata.properties.runReport({
      property: creds.propertyId,
      requestBody: {
        dateRanges: [{ startDate: '14daysAgo', endDate: '8daysAgo' }],
        metrics: [{ name: 'sessions' }],
      },
    });

    // Parse current data
    let sessions = 0;
    let organicSessions = 0;
    const pageStats = new Map<string, { sessions: number; pageviews: number }>();

    const currentData = currentResponse.data;
    for (const row of currentData.rows || []) {
      const pagePath = row.dimensionValues?.[0]?.value || '/';
      const channelGroup = row.dimensionValues?.[1]?.value || 'Unknown';
      const rowSessions = parseInt(row.metricValues?.[0]?.value || '0');
      const pageviews = parseInt(row.metricValues?.[1]?.value || '0');

      sessions += rowSessions;
      
      if (channelGroup === 'Organic Search') {
        organicSessions += rowSessions;
      }

      if (!pageStats.has(pagePath)) {
        pageStats.set(pagePath, { sessions: 0, pageviews: 0 });
      }
      const stats = pageStats.get(pagePath)!;
      stats.sessions += rowSessions;
      stats.pageviews += pageviews;
    }

    // Previous sessions
    const previousData = previousResponse.data;
    const previousSessions = parseInt(
      previousData.rows?.[0]?.metricValues?.[0]?.value || '0'
    );

    const sessionsChange = previousSessions > 0
      ? ((sessions - previousSessions) / previousSessions) * 100
      : 0;

    const organicPercent = sessions > 0 ? (organicSessions / sessions) * 100 : 0;

    // Top pages by sessions
    const topPages = Array.from(pageStats.entries())
      .map(([path, stats]) => ({ path, ...stats }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10);

    const result: GA4Data = {
      sessions,
      previousSessions,
      sessionsChange,
      organicSessions,
      organicPercent,
      topPages,
      fetchedAt: Date.now(),
    };

    // Cache the result
    setBridgeCache('ga4_data', result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GA4 API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch GA4 data' },
      { status: 500 }
    );
  }
}
