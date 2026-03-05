import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSetting } from '@/lib/db';
import { google, Auth } from 'googleapis';

// In-memory cache with 5-minute TTL
let pulseCache: { data: PulseData; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

// Staging hostnames to exclude
const STAGING_PATTERNS = ['staging.', 'stage.', 'dev.', 'test.', 'localhost', '.local', '.test'];

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

/**
 * Resolve credentials from DB first, then fall back to env vars.
 * Returns { clientEmail, privateKey } or null if neither source has creds.
 */
function resolveCredentials(): { clientEmail: string; privateKey: string } | null {
  // Check DB
  const storedJson = getSetting('google_service_account');
  if (storedJson) {
    try {
      const parsed = JSON.parse(storedJson);
      if (parsed.client_email && parsed.private_key) {
        return {
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key.replace(/\\n/g, '\n'),
        };
      }
    } catch {
      // Fall through to env vars
    }
  }

  // Fall back to env vars
  const clientEmail = process.env.GA4_CLIENT_EMAIL;
  const privateKey = process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (clientEmail && privateKey) {
    return { clientEmail, privateKey };
  }

  return null;
}

/**
 * Discover all GSC site URLs the service account has access to.
 * Returns an array of siteUrl strings (e.g. "sc-domain:example.com" or "https://example.com/")
 */
async function discoverGSCSites(auth: Auth.GoogleAuth): Promise<string[]> {
  const searchConsole = google.searchconsole({ version: 'v1', auth });
  const res = await searchConsole.sites.list();
  const sites = res.data.siteEntry || [];
  return sites
    .filter(s => s.siteUrl)
    .map(s => s.siteUrl as string);
}

/**
 * Discover all GA4 property IDs the service account has access to.
 * Uses the Analytics Admin API v1beta accountSummaries endpoint.
 */
async function discoverGA4Properties(auth: Auth.GoogleAuth): Promise<string[]> {
  const adminClient = google.analyticsadmin({ version: 'v1beta', auth });
  const propertyIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const res = await adminClient.accountSummaries.list({
      pageToken,
    });
    const accounts = res.data.accountSummaries || [];
    for (const account of accounts) {
      for (const prop of account.propertySummaries || []) {
        if (prop.property) {
          // prop.property is like "properties/123456789"
          const id = prop.property.replace('properties/', '');
          propertyIds.push(id);
        }
      }
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return propertyIds;
}

/**
 * Extract a clean hostname from a GSC siteUrl for use as a map key.
 * "sc-domain:example.com" → "example.com"
 * "https://example.com/" → "example.com"
 */
function gscSiteToHostname(siteUrl: string): string {
  if (siteUrl.startsWith('sc-domain:')) {
    return siteUrl.replace('sc-domain:', '');
  }
  try {
    const url = new URL(siteUrl);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return siteUrl;
  }
}

async function fetchGA4Data(auth: Auth.GoogleAuth, propertyIds: string[]) {
  const analyticsData = google.analyticsdata({ version: 'v1beta', auth });

  const bySite: PulseData['traffic']['bySite'] = {};
  const total = {
    sessions: { current: 0, previous: 0 },
    users: { current: 0, previous: 0 },
    pageViews: { current: 0, previous: 0 },
  };

  // Query each property in parallel (up to 10 at a time to avoid rate limits)
  const BATCH = 10;
  for (let i = 0; i < propertyIds.length; i += BATCH) {
    const batch = propertyIds.slice(i, i + BATCH);
    await Promise.all(batch.map(async (propertyId) => {
      try {
        // a) Current 7d by hostname
        const [currentByHost, previousByHost, dailyByHost, organicByHost, totalCurrent, totalPrevious] =
          await Promise.all([
            analyticsData.properties.runReport({
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
            }),
            analyticsData.properties.runReport({
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
            }),
            analyticsData.properties.runReport({
              property: `properties/${propertyId}`,
              requestBody: {
                dateRanges: [{ startDate: '30daysAgo', endDate: 'yesterday' }],
                dimensions: [{ name: 'hostName' }, { name: 'date' }],
                metrics: [{ name: 'sessions' }],
                limit: '500',
              },
            }),
            analyticsData.properties.runReport({
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
            }),
            analyticsData.properties.runReport({
              property: `properties/${propertyId}`,
              requestBody: {
                dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
                metrics: [
                  { name: 'sessions' },
                  { name: 'totalUsers' },
                  { name: 'screenPageViews' },
                ],
              },
            }),
            analyticsData.properties.runReport({
              property: `properties/${propertyId}`,
              requestBody: {
                dateRanges: [{ startDate: '14daysAgo', endDate: '8daysAgo' }],
                metrics: [
                  { name: 'sessions' },
                  { name: 'totalUsers' },
                  { name: 'screenPageViews' },
                ],
              },
            }),
          ]);

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
          bySite[hostname].current.sessions += sessions;
          bySite[hostname].current.users += users;
          bySite[hostname].current.pageViews += pageViews;
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
          bySite[hostname].previous.sessions += sessions;
          bySite[hostname].previous.users += users;
          bySite[hostname].previous.pageViews += pageViews;
        }

        // 30-day daily sessions
        const dailyMap: Record<string, Record<string, number>> = {};
        for (const row of dailyByHost.data.rows || []) {
          const hostname = row.dimensionValues?.[0]?.value || '';
          const date = row.dimensionValues?.[1]?.value || '';
          const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
          if (isStaging(hostname)) continue;
          if (!dailyMap[hostname]) dailyMap[hostname] = {};
          dailyMap[hostname][date] = (dailyMap[hostname][date] || 0) + sessions;
        }

        // 30-day daily organic sessions
        const organicMap: Record<string, Record<string, number>> = {};
        for (const row of organicByHost.data.rows || []) {
          const hostname = row.dimensionValues?.[0]?.value || '';
          const date = row.dimensionValues?.[1]?.value || '';
          const sessions = parseInt(row.metricValues?.[0]?.value || '0', 10);
          if (isStaging(hostname)) continue;
          if (!organicMap[hostname]) organicMap[hostname] = {};
          organicMap[hostname][date] = (organicMap[hostname][date] || 0) + sessions;
        }

        // Merge daily data into bySite
        for (const [hostname, dateSessions] of Object.entries(dailyMap)) {
          if (!bySite[hostname]) continue;
          // Merge (in case multiple properties share a hostname)
          const existingDates = new Set(bySite[hostname].daily.map(d => d.date));
          for (const [date, sessions] of Object.entries(dateSessions)) {
            if (existingDates.has(date)) {
              const entry = bySite[hostname].daily.find(d => d.date === date);
              if (entry) entry.sessions += sessions;
            } else {
              bySite[hostname].daily.push({ date, sessions });
              existingDates.add(date);
            }
          }
        }

        // Merge organic daily data
        for (const [hostname, dateSessions] of Object.entries(organicMap)) {
          if (!bySite[hostname]) continue;
          const existingDates = new Set(bySite[hostname].organicDaily.map(d => d.date));
          for (const [date, sessions] of Object.entries(dateSessions)) {
            if (existingDates.has(date)) {
              const entry = bySite[hostname].organicDaily.find(d => d.date === date);
              if (entry) entry.sessions += sessions;
            } else {
              bySite[hostname].organicDaily.push({ date, sessions });
              existingDates.add(date);
            }
          }
        }

        // Accumulate totals
        const currentRow = totalCurrent.data.rows?.[0];
        const previousRow = totalPrevious.data.rows?.[0];
        total.sessions.current += parseInt(currentRow?.metricValues?.[0]?.value || '0', 10);
        total.users.current += parseInt(currentRow?.metricValues?.[1]?.value || '0', 10);
        total.pageViews.current += parseInt(currentRow?.metricValues?.[2]?.value || '0', 10);
        total.sessions.previous += parseInt(previousRow?.metricValues?.[0]?.value || '0', 10);
        total.users.previous += parseInt(previousRow?.metricValues?.[1]?.value || '0', 10);
        total.pageViews.previous += parseInt(previousRow?.metricValues?.[2]?.value || '0', 10);
      } catch (err) {
        // Property might not have data or access — skip it
        console.error(`GA4 error for property ${propertyId}:`, err);
      }
    }));
  }

  // Sort daily arrays by date
  for (const hostname of Object.keys(bySite)) {
    bySite[hostname].daily.sort((a, b) => a.date.localeCompare(b.date));
    bySite[hostname].organicDaily.sort((a, b) => a.date.localeCompare(b.date));
    // Align organicDaily to daily dates (fill missing)
    const dailyDates = bySite[hostname].daily.map(d => d.date);
    const organicByDate: Record<string, number> = {};
    for (const { date, sessions } of bySite[hostname].organicDaily) {
      organicByDate[date] = sessions;
    }
    bySite[hostname].organicDaily = dailyDates.map(date => ({
      date,
      sessions: organicByDate[date] || 0,
    }));
  }

  return { total, bySite };
}

async function fetchGSCData(auth: Auth.GoogleAuth, siteUrls: string[]) {
  const searchConsole = google.searchconsole({ version: 'v1', auth });
  const dates = getDateRanges();

  const gsc: PulseData['gsc'] = {};

  // Query all sites in parallel
  await Promise.all(siteUrls.map(async (siteUrl) => {
    const hostname = gscSiteToHostname(siteUrl);

    try {
      const [currentRes, previousRes, dailyRes] = await Promise.all([
        searchConsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate: dates.sevenDaysAgo,
            endDate: dates.today,
            dimensions: [],
          },
        }),
        searchConsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate: dates.fourteenDaysAgo,
            endDate: dates.eightDaysAgo,
            dimensions: [],
          },
        }),
        searchConsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate: dates.thirtyDaysAgo,
            endDate: dates.today,
            dimensions: ['date'],
            rowLimit: 30,
          },
        }),
      ]);

      const currentData = currentRes.data.rows?.[0] || { impressions: 0, clicks: 0 };
      const previousData = previousRes.data.rows?.[0] || { impressions: 0, clicks: 0 };

      gsc[hostname] = {
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
      // Site might not have GSC access — skip it
      console.error(`GSC error for ${siteUrl}:`, error);
    }
  }));

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

    // Resolve credentials from DB first, then env vars
    const creds = resolveCredentials();
    if (!creds) {
      return NextResponse.json(
        { configured: false, error: 'Google credentials not configured' },
        { status: 200 }
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: creds.clientEmail,
        private_key: creds.privateKey,
      },
      scopes: [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/analytics.edit',
      ],
    });

    // Discover sites/properties dynamically
    let gscSiteUrls: string[] = [];
    let ga4PropertyIds: string[] = [];

    try {
      [gscSiteUrls, ga4PropertyIds] = await Promise.all([
        discoverGSCSites(auth),
        discoverGA4Properties(auth),
      ]);
      console.log(`Pulse: discovered ${ga4PropertyIds.length} GA4 properties, ${gscSiteUrls.length} GSC sites`);
    } catch (err) {
      console.error('Discovery error:', err);
    }

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

    if (ga4PropertyIds.length > 0) {
      try {
        traffic = await fetchGA4Data(auth, ga4PropertyIds);
      } catch (error) {
        console.error('GA4 fetch error:', error);
      }
    }

    if (gscSiteUrls.length > 0) {
      try {
        gsc = await fetchGSCData(auth, gscSiteUrls);
      } catch (error) {
        console.error('GSC fetch error:', error);
      }
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
