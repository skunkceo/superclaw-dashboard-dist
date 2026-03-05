import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getLatestBrief, saveBrief } from '@/lib/db';
import { randomBytes } from 'crypto';

interface SynthesisData {
  whatsWorking: string[];
  needsAttention: string[];
  now: string[];
  next: string[];
  later: string[];
}

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';

  // Check if we have a recent brief (less than 6 hours old)
  if (!force) {
    const latest = getLatestBrief();
    if (latest && Date.now() - latest.generated_at < 6 * 60 * 60 * 1000) {
      return NextResponse.json({ brief: latest.brief, generated_at: latest.generated_at });
    }
  }

  try {
    // Fetch all data sources (including intel)
    const [gscRes, ga4Res, githubRes, activityRes, intelRes] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/bridge/gsc`),
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/bridge/ga4`),
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/github-activity`),
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/activity?hours=72&limit=50`),
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/bridge/intel`),
    ]);

    const gscData = gscRes.ok ? await gscRes.json() : null;
    const ga4Data = ga4Res.ok ? await ga4Res.json() : null;
    const githubData = githubRes.ok ? await githubRes.json() : null;
    const activityData = activityRes.ok ? await activityRes.json() : null;
    const intelData = intelRes.ok ? await intelRes.json() : null;

    // Synthesize the brief
    const brief: SynthesisData = {
      whatsWorking: [],
      needsAttention: [],
      now: [],
      next: [],
      later: [],
    };

    // What's working
    if (ga4Data && ga4Data.sessionsChange > 0) {
      brief.whatsWorking.push(
        `Traffic up ${ga4Data.sessionsChange.toFixed(1)}% — ${ga4Data.sessions} sessions in last 7 days (${ga4Data.organicPercent.toFixed(0)}% organic)`
      );
    }

    if (gscData && gscData.topQueries.length > 0) {
      const topQuery = gscData.topQueries[0];
      brief.whatsWorking.push(
        `Top keyword: "${topQuery.query}" (${topQuery.clicks} clicks, position ${topQuery.position.toFixed(1)})`
      );
    }

    if (ga4Data && ga4Data.topPages.length > 0) {
      const topPage = ga4Data.topPages[0];
      brief.whatsWorking.push(
        `Top page: ${topPage.path} (${topPage.sessions} sessions)`
      );
    }

    // Needs attention
    if (githubData && githubData.prs) {
      const openPRs = githubData.prs.filter((pr: any) => pr.state === 'OPEN');
      const stalePRs = openPRs.filter((pr: any) => {
        const age = Date.now() - new Date(pr.createdAt).getTime();
        return age > 7 * 24 * 60 * 60 * 1000; // >7 days
      });
      if (stalePRs.length > 0) {
        brief.needsAttention.push(
          `${stalePRs.length} stale PR${stalePRs.length > 1 ? 's' : ''} open for >7 days`
        );
      }
    }

    if (ga4Data && ga4Data.sessionsChange < 0) {
      brief.needsAttention.push(
        `Traffic down ${Math.abs(ga4Data.sessionsChange).toFixed(1)}% from previous period`
      );
    }

    // Add high-relevance competitor intel (max 2)
    if (intelData && intelData.intel) {
      const competitorIntel = intelData.intel
        .filter((item: any) => item.category === 'competitor' && item.relevance_score > 60)
        .slice(0, 2);
      for (const item of competitorIntel) {
        const summarySnippet = item.summary.length > 100 
          ? item.summary.substring(0, 100) + '...' 
          : item.summary;
        brief.needsAttention.push(
          `Competitor signal: ${item.title} — ${summarySnippet}`
        );
      }
    }

    // Now: Immediate actions
    if (gscData && gscData.opportunities.length > 0) {
      const topOpp = gscData.opportunities[0];
      brief.now.push(
        `Optimize "${topOpp.query}" — ${topOpp.impressions} impressions, only ${topOpp.clicks} clicks (position ${topOpp.position.toFixed(1)})`
      );
    }

    if (githubData && githubData.prs) {
      const openPRs = githubData.prs.filter((pr: any) => pr.state === 'OPEN');
      if (openPRs.length > 0) {
        brief.now.push(`Review and merge ${openPRs.length} open PR${openPRs.length > 1 ? 's' : ''}`);
      }
    }

    if (activityData && activityData.activities) {
      const recentTasks = activityData.activities.filter(
        (a: any) => a.action_type === 'task_started' || a.action_type === 'task_completed'
      );
      if (recentTasks.length > 0) {
        brief.now.push(`Follow up on ${recentTasks.length} recent agent tasks`);
      }
    }

    // Next: Short-term priorities
    if (gscData && gscData.opportunities.length > 1) {
      brief.next.push(
        `Target ${gscData.opportunities.length} keyword opportunities with high impressions but low CTR`
      );
    }

    if (ga4Data && ga4Data.organicPercent < 50) {
      brief.next.push(
        `Increase organic traffic share (currently ${ga4Data.organicPercent.toFixed(0)}%)`
      );
    }

    // Add opportunity intel (max 2)
    if (intelData && intelData.intel) {
      const opportunityIntel = intelData.intel
        .filter((item: any) => item.category === 'opportunity')
        .slice(0, 2);
      for (const item of opportunityIntel) {
        brief.next.push(`Market opportunity: ${item.title}`);
      }
    }

    brief.next.push('Publish weekly content to capture new keywords');

    // Later: Long-term strategy
    brief.later.push('Build content for competitor keywords where Skunk has no presence');
    brief.later.push('Launch new features based on user feedback and market gaps');
    
    if (gscData && gscData.topQueries.length > 10) {
      brief.later.push('Expand into adjacent keyword clusters beyond core topics');
    }

    // Save the brief
    const briefId = randomBytes(16).toString('hex');
    saveBrief(briefId, brief);

    return NextResponse.json({ brief, generated_at: Date.now() });
  } catch (error: any) {
    console.error('Synthesis error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate synthesis' },
      { status: 500 }
    );
  }
}
