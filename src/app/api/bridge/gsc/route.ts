import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getGSCCredentials } from '@/lib/integrations';
import { getBridgeCache, setBridgeCache } from '@/lib/db';
import { google } from 'googleapis';

const SITES = [
  'sc-domain:skunkcrm.com',
  'sc-domain:skunkforms.com',
  'sc-domain:skunkglobal.com',
];

interface GSCQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  site: string;
}

interface GSCData {
  topQueries: GSCQuery[];
  opportunities: GSCQuery[];
  totalClicks: number;
  totalImpressions: number;
  avgCTR: number;
  avgPosition: number;
  previousClicks: number;
  previousImpressions: number;
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
    const cached = getBridgeCache('gsc_data');
    if (cached) {
      return NextResponse.json(cached);
    }
  }

  const creds = getGSCCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: 'Google Search Console not configured' },
      { status: 400 }
    );
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: creds.clientEmail,
        private_key: creds.privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });

    const searchconsole = google.searchconsole({ version: 'v1', auth });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 28);
    
    const prevStartDate = new Date();
    prevStartDate.setDate(prevStartDate.getDate() - 56);
    const prevEndDate = new Date();
    prevEndDate.setDate(prevEndDate.getDate() - 29);

    // Fetch data for all sites
    const allQueries: GSCQuery[] = [];
    let totalClicks = 0;
    let totalImpressions = 0;
    let previousClicks = 0;
    let previousImpressions = 0;

    for (const siteUrl of SITES) {
      try {
        // Current period
        const currentResponse = await searchconsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            dimensions: ['query'],
            rowLimit: 1000,
          },
        });

        // Previous period for comparison
        const previousResponse = await searchconsole.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate: prevStartDate.toISOString().split('T')[0],
            endDate: prevEndDate.toISOString().split('T')[0],
            dimensions: [],
            rowLimit: 1,
          },
        });

        const rows = currentResponse.data.rows || [];
        const siteName = siteUrl.replace('sc-domain:', '');

        for (const row of rows) {
          allQueries.push({
            query: row.keys?.[0] || '',
            clicks: row.clicks || 0,
            impressions: row.impressions || 0,
            ctr: row.ctr || 0,
            position: row.position || 0,
            site: siteName,
          });
        }

        // Aggregate totals
        const siteTotal = currentResponse.data.rows?.reduce(
          (acc, row) => ({
            clicks: (acc.clicks || 0) + (row.clicks || 0),
            impressions: (acc.impressions || 0) + (row.impressions || 0),
          }),
          { clicks: 0, impressions: 0 }
        ) || { clicks: 0, impressions: 0 };

        totalClicks += (siteTotal.clicks || 0);
        totalImpressions += (siteTotal.impressions || 0);

        if (previousResponse.data.rows?.[0]) {
          previousClicks += previousResponse.data.rows[0].clicks || 0;
          previousImpressions += previousResponse.data.rows[0].impressions || 0;
        }
      } catch (siteError: any) {
        console.error(`Failed to fetch GSC data for ${siteUrl}:`, siteError.message);
        // Continue with other sites
      }
    }

    // Sort by clicks and get top queries
    const topQueries = allQueries
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 20);

    // Find opportunities: high impressions (>100), low clicks (<5), position 5-20
    const opportunities = allQueries
      .filter(q => q.impressions > 100 && q.clicks < 5 && q.position >= 5 && q.position <= 20)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 20);

    const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgPosition = allQueries.length > 0
      ? allQueries.reduce((sum, q) => sum + q.position, 0) / allQueries.length
      : 0;

    const result: GSCData = {
      topQueries,
      opportunities,
      totalClicks,
      totalImpressions,
      avgCTR,
      avgPosition,
      previousClicks,
      previousImpressions,
      fetchedAt: Date.now(),
    };

    // Cache the result
    setBridgeCache('gsc_data', result);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('GSC API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch GSC data' },
      { status: 500 }
    );
  }
}
