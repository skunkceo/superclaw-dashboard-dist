import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllIntelItems, createIntelItem, markAllIntelRead, getIntelStats, archiveAllIntelItems } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || undefined;
  const unread = searchParams.get('unread') === 'true';
  const archived = searchParams.get('archived') === 'true';
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
  const statsOnly = searchParams.get('stats') === 'true';

  if (statsOnly) {
    return NextResponse.json(getIntelStats());
  }

  const items = getAllIntelItems({ category, unread, archived, limit });
  const stats = getIntelStats();
  return NextResponse.json({ items, stats });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { category, title, summary, url, source, relevance_score } = body;

    if (!category || !title || !summary) {
      return NextResponse.json({ error: 'category, title, and summary are required' }, { status: 400 });
    }

    const item = {
      id: uuidv4(),
      category,
      title,
      summary,
      url: url || null,
      source: source || 'manual',
      relevance_score: relevance_score || 50,
    };

    createIntelItem(item);
    return NextResponse.json({ success: true, item: { ...item, created_at: Date.now(), read_at: null } });
  } catch {
    return NextResponse.json({ error: 'Failed to create intel item' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'mark_all_read') {
    markAllIntelRead();
    return NextResponse.json({ success: true });
  }

  if (action === 'archive_all') {
    const count = archiveAllIntelItems();
    return NextResponse.json({ success: true, archived: count });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
