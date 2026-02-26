import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { runEnhancedIntelRefresh } from '@/lib/enhanced-intel';
import { generateSuggestionsFromIntel } from '@/lib/suggestions';
import { generateStrategicBrief } from '@/lib/strategic-briefs';
import { getProactivitySetting, setProactivitySetting } from '@/lib/db';
import { getBusinessContext } from '@/lib/business-context';

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';

  // Rate-limit: don't refresh more than once per hour unless forced
  const lastRefresh = parseInt(getProactivitySetting('last_intel_refresh') || '0');
  const hourAgo = Date.now() - 60 * 60 * 1000;
  if (!force && lastRefresh > hourAgo) {
    const nextRefreshIn = Math.ceil((lastRefresh + 60 * 60 * 1000 - Date.now()) / 60000);
    return NextResponse.json({
      skipped: true,
      message: `Last refresh was ${Math.floor((Date.now() - lastRefresh) / 60000)} min ago. Next refresh available in ${nextRefreshIn} min. Use ?force=true to override.`,
    });
  }

  try {
    setProactivitySetting('last_intel_refresh', Date.now().toString());
    
    // Get business context for personalized intelligence
    const businessContext = getBusinessContext();
    
    // Run enhanced intel refresh with context
    const intelResult = await runEnhancedIntelRefresh(businessContext || undefined);
    const totalAdded = intelResult.keywords.added + intelResult.productRadar.added;
    
    // Generate suggestions
    const sugResult = await generateSuggestionsFromIntel();
    
    // Generate strategic brief with context
    const brief = await generateStrategicBrief(businessContext || undefined);

    return NextResponse.json({
      success: true,
      intel: intelResult,
      totalItemsAdded: totalAdded,
      suggestions: sugResult,
      brief: brief.id,
      message: `Intelligence refresh complete: ${totalAdded} signals added (${intelResult.keywords.added} keywords, ${intelResult.productRadar.added} product radar), ${sugResult.fromIntel + sugResult.standing} suggestions generated`,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Intel refresh failed', detail: String(err) }, { status: 500 });
  }
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const lastRefresh = parseInt(getProactivitySetting('last_intel_refresh') || '0');
  const lastSuggestionRun = parseInt(getProactivitySetting('last_suggestion_run') || '0');

  return NextResponse.json({
    lastRefresh: lastRefresh || null,
    lastRefreshFormatted: lastRefresh ? new Date(lastRefresh).toISOString() : null,
    lastSuggestionRun: lastSuggestionRun || null,
    nextRefreshAvailable: lastRefresh ? new Date(lastRefresh + 60 * 60 * 1000).toISOString() : 'now',
  });
}
