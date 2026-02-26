import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllSuggestions, createSuggestion, getSuggestionStats } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;
  const statsOnly = searchParams.get('stats') === 'true';

  if (statsOnly) {
    return NextResponse.json(getSuggestionStats());
  }

  const suggestions = getAllSuggestions({ status, limit });
  const stats = getSuggestionStats();
  return NextResponse.json({ suggestions, stats });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { title, why, effort, impact, impact_score, category, source_intel_ids, priority, notes } = body;

    if (!title || !why || !effort || !impact || !category) {
      return NextResponse.json({ error: 'title, why, effort, impact, and category are required' }, { status: 400 });
    }

    const suggestion = {
      id: uuidv4(),
      title,
      why,
      effort: effort as 'low' | 'medium' | 'high',
      impact: impact as 'low' | 'medium' | 'high',
      impact_score: impact_score || 50,
      category,
      source_intel_ids: source_intel_ids ? JSON.stringify(source_intel_ids) : '[]',
      status: 'pending' as const,
      priority: priority || 3,
      notes: notes || null,
      linear_issue_id: null,
      linear_identifier: null,
      linear_url: null,
    };

    createSuggestion(suggestion);
    return NextResponse.json({ success: true, suggestion: { ...suggestion, created_at: Date.now(), actioned_at: null, report_id: null } });
  } catch {
    return NextResponse.json({ error: 'Failed to create suggestion' }, { status: 500 });
  }
}
