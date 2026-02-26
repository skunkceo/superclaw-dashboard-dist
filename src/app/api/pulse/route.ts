import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { google, Auth } from 'googleapis';

// In-memory cache with 5-minute TTL
let pulseCache: { data: PulseData; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

// Staging hostnames to exclude
const STAGING_PATTERNS = ['staging.', 'stage.', 'dev.', 'test.', 'localhost', '.local', '.test', 'www.'];

// GSC sites to query
const GSC_SITES = [
  'skunkglobal.com',
  'skunkcrm.com',
  'skunkforms.com',
  'skunkpages.com',
  'skunkanalytics.com',
  'skunksocial.com',
  'skunkcourses.com',
  'skunkmemberships.com',
];

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

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getDateRanges() {
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);

  const eightDaysAgo = new Date(today);
  eightDaysAgo.setDate(today.getDate() - 8);

  const fourteenDaysAgo = new Date(today);
  fourteenDaysAgo.setDate(today.getDate() - 14);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  return {
    today: formatDate(today),
    yesterday: formatDate(yesterday),
    sevenDaysAgo: formatDate(sevenDaysAgo),
    eightDaysAgo: formatDate(eightDaysAgo),
    fourteenDaysAgo: formatDate(fourteenDaysAgo),
    thirtyDaysAgo: formatDate(thirtyDaysAgo),
  };
}

function isStaging(hostname: string): boolean {
  return STAGING_PATTERNS.some(pattern => hostname.includes(pattern));
}

async function fetchGA4Data(auth: Auth.GoogleAuth) {
  const analyticsData = google.analyticsdata({ version: 'v1beta', auth });
  const propertyId = process.env.GA4_PROPERTY_ID || '513552077';
  const dates = getDateRanges();

  const bySite: PulseData['traffic']['bySite'] = {};
  const total = {
    sessions: { current: 0, previous: 0 },
    users: { current: 0, previous: 0 },
    pageViews: { current: 0, previous: 0 },
  };

  // a) Current 7d by hostname
  const currentByHost = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'hostName' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
      ],
    },
  });

  // Previous 7d by hostname
  const previousByHost = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: '14daysAgo', endDate: '8daysAgo' }],
      dimensions: [{ name: 'hostName' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
      ],
    },
  });

  // Process current data
  for (const row of currentByHost.data.rows || []) {
    const hostname = row.dimensionValues?.[0]?.value || '';
    if (isStaging(hostname)) continue;

    const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
    const users = parseInt(row.metricValues?.[1]?.value || '0', 10);
    const pageViews = parseInt(row.metricValues?.[2]?.value || '0', 10);

    if (!bySite[hostname]) {
      bySite[hostname] = {
        current: { sessions: 0, users: 0, pageViews: 0 },
        previous: { sessions: 0, users: 0, pageViews: 0 },
        daily: [],
        organicDaily: [],
      };
    }
    bySite[hostname].current = { sessions, users, pageViews };
  }

  // Process previous data
  for (const row of previousByHost.data.rows || []) {
    const hostname = row.dimensionValues?.[0]?.value || '';
    if (isStaging(hostname)) continue;

    const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
    const users = parseInt(row.metricValues?.[1]?.value || '0', 10);
    const pageViews = parseInt(row.metricValues?.[2]?.value || '0', 10);

    if (!bySite[hostname]) {
      bySite[hostname] = {
        current: { sessions: 0, users: 0, pageViews: 0 },
        previous: { sessions: 0, users: 0, pageViews: 0 },
        daily: [],
        organicDaily: [],
      };
    }
    bySite[hostname].previous = { sessions, users, pageViews };
  }

  // b) 30-day daily sessions by hostname (for sparklines)
  const dailyByHost = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
      dimensions: [{ name: 'hostName' }, { name: 'date' }],
      metrics: [{ name: 'sessions' }],
      limit: '500',
    },
  });

  for (const row of dailyByHost.data.rows || []) {
    const hostname = row.dimensionValues?.[0]?.value || '';
    const date = row.dimensionValues?.[1]?.value || '';
    const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);

    if (isStaging(hostname)) continue;
    if (!bySite[hostname]) continue;

    bySite[hostname].daily.push({ date, sessions });
  }

  // Sort daily arrays by date
  for (const hostname of Object.keys(bySite)) {
    bySite[hostname].daily.sort((a, b) => a.date.localeCompare(b.date));
  }

  // c) 30-day daily organic sessions by hostname
  const organicByHost = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
      dimensions: [
        { name: 'hostName' },
        { name: 'date' },
        { name: 'sessionDefaultChannelGroup' },
      ],
      metrics: [{ name: 'sessions' }],
      dimensionFilter: {
        filter: {
          fieldName: 'sessionDefaultChannelGroup',
          inListFilter: {
            values: ['Organic Search', 'Organic Social', 'Organic Video'],
          },
        },
      },
      limit: '1000',
    },
  });

  // Aggregate organic sessions by hostname and date
  const organicMap: Record<string, Record<string, number>> = {};
  for (const row of organicByHost.data.rows || []) {
    const hostname = row.dimensionValues?.[0]?.value || '';
    const date = row.dimensionValues?.[1]?.value || '';
    const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);

    if (isStaging(hostname)) continue;
    if (!organicMap[hostname]) organicMap[hostname] = {};
    organicMap[hostname][date] = (organicMap[hostname][date] || 0) + sessions;
  }

  for (const hostname of Object.keys(organicMap)) {
    if (!bySite[hostname]) continue;
    bySite[hostname].organicDaily = Object.entries(organicMap[hostname])
      .map(([date, sessions]) => ({ date, sessions }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // d) Totals (current 7d and previous 7d, no dimensions)
  const totalCurrent = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
      ],
    },
  });

  const totalPrevious = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: '14daysAgo', endDate: '8daysAgo' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
      ],
    },
  });

  const currentRow = totalCurrent.data.rows?.[0];
  const previousRow = totalPrevious.data.rows?.[0];

  total.sessions.current = parseInt(currentRow?.metricValues?.[0]?.value || '0', 10);
  total.users.current = parseInt(currentRow?.metricValues?.[1]?.value || '0', 10);
  total.pageViews.current = parseInt(currentRow?.metricValues?.[2]?.value || '0', 10);

  total.sessions.previous = parseInt(previousRow?.metricValues?.[0]?.value || '0', 10);
  total.users.previous = parseInt(previousRow?.metricValues?.[1]?.value || '0', 10);
  total.pageViews.previous = parseInt(previousRow?.metricValues?.[2]?.value || '0', 10);

  return { total, bySite };
}

async function fetchGSCData(auth: Auth.GoogleAuth) {
  const searchConsole = google.searchconsole({ version: 'v1', auth });
  const dates = getDateRanges();

  const gsc: PulseData['gsc'] = {};

  for (const site of GSC_SITES) {
    const siteUrl = `sc-domain:${site}`;

    try {
      // Current 7d
      const currentRes = await searchConsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: dates.sevenDaysAgo,
          endDate: dates.today,
          dimensions: [],
        },
      });

      // Previous 7d
      const previousRes = await searchConsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: dates.fourteenDaysAgo,
          endDate: dates.eightDaysAgo,
          dimensions: [],
        },
      });

      // 30-day daily
      const dailyRes = await searchConsole.searchanalytics.query({
        siteUrl,
        requestBody: {
          startDate: dates.thirtyDaysAgo,
          endDate: dates.today,
          dimensions: ['date'],
          rowLimit: 30,
        },
      });

      const currentData = currentRes.data.rows?.[0] || { impressions: 0, clicks: 0 };
      const previousData = previousRes.data.rows?.[0] || { impressions: 0, clicks: 0 };

      gsc[site] = {
        impressions: {
          current: currentData.impressions || 0,
          previous: previousData.impressions || 0,
        },
        clicks: {
          current: currentData.clicks || 0,
          previous: previousData.clicks || 0,
        },
        daily: (dailyRes.data.rows || [])
          .map(row => ({
            date: row.keys?.[0] || '',
            impressions: row.impressions || 0,
            clicks: row.clicks || 0,
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    } catch (error) {
      // Site might not have GSC access, skip it
      console.error(`GSC error for ${site}:`, error);
      gsc[site] = {
        impressions: { current: 0, previous: 0 },
        clicks: { current: 0, previous: 0 },
        daily: [],
      };
    }
  }

  return gsc;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check cache
    if (pulseCache && Date.now() - pulseCache.timestamp < CACHE_TTL) {
      return NextResponse.json(pulseCache.data);
    }

    // Set up Google Auth
    const clientEmail = process.env.GA4_CLIENT_EMAIL;
    const privateKey = process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
      return NextResponse.json(
        { configured: false, error: 'GA4 credentials not configured' },
        { status: 200 }
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/webmasters.readonly',
      ],
    });

    // Fetch data with partial failure handling
    let traffic: PulseData['traffic'] = {
      total: {
        sessions: { current: 0, previous: 0 },
        users: { current: 0, previous: 0 },
        pageViews: { current: 0, previous: 0 },
      },
      bySite: {},
    };
    let gsc: PulseData['gsc'] = {};

    try {
      traffic = await fetchGA4Data(auth);
    } catch (error) {
      console.error('GA4 fetch error:', error);
      // Continue with empty traffic data
    }

    try {
      gsc = await fetchGSCData(auth);
    } catch (error) {
      console.error('GSC fetch error:', error);
      // Continue with empty GSC data
    }

    const data: PulseData = {
      timestamp: new Date().toISOString(),
      traffic,
      gsc,
    };

    // Update cache
    pulseCache = { data, timestamp: Date.now() };

    return NextResponse.json(data);
  } catch (error) {
    console.error('Pulse API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pulse data' },
      { status: 500 }
    );
  }
}
