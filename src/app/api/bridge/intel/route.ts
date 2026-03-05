import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllIntelItems, getAllSuggestions } from '@/lib/db';

export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch top 10 most recent non-archived intel items, sorted by relevance and recency
    const intelItems = getAllIntelItems({ archived: false, limit: 100 });
    const sortedIntel = intelItems
      .sort((a, b) => {
        // Sort by relevance_score DESC, then created_at DESC
        if (b.relevance_score !== a.relevance_score) {
          return b.relevance_score - a.relevance_score;
        }
        return b.created_at - a.created_at;
      })
      .map(item => ({
        id: item.id,
        category: item.category,
        title: item.title,
        summary: item.summary,
        url: item.url,
        relevance_score: item.relevance_score,
        created_at: item.created_at,
        insight: item.insight || null,
      }));

    // Fetch top 5 pending/queued suggestions, sorted by priority and impact
    const allSuggestions = getAllSuggestions();
    const activeSuggestions = allSuggestions
      .filter(s => s.status === 'pending' || s.status === 'queued')
      .sort((a, b) => {
        // Sort by priority ASC (1 = highest), then impact_score DESC
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return b.impact_score - a.impact_score;
      })
      .slice(0, 5)
      .map(s => ({
        id: s.id,
        title: s.title,
        why: s.why,
        effort: s.effort,
        impact: s.impact,
        status: s.status,
        priority: s.priority,
      }));

    return NextResponse.json({
      intel: sortedIntel,
      suggestions: activeSuggestions,
    });
  } catch (error: any) {
    console.error('Intel fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch intel data' },
      { status: 500 }
    );
  }
}
