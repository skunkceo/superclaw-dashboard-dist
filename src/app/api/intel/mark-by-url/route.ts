import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import db from '@/lib/db';

/**
 * PATCH /api/intel/mark-by-url
 * Body: { url: string }
 * Finds the most recent unarchived intel item with this URL and marks it as commented.
 * Used by the report page to mark Reddit threads directly from rendered links.
 */
export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { url } = body as { url?: string };

  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

  const item = db
    .prepare(
      'SELECT id FROM intel_items WHERE url = ? AND archived_at IS NULL ORDER BY created_at DESC LIMIT 1'
    )
    .get(url) as { id: string } | undefined;

  if (!item) {
    // Already archived or not in intel feed — still return success
    return NextResponse.json({ success: true, found: false });
  }

  const now = Date.now();
  db.prepare(
    'UPDATE intel_items SET commented_at = ?, archived_at = COALESCE(archived_at, ?), read_at = COALESCE(read_at, ?) WHERE id = ?'
  ).run(now, now, now, item.id);

  return NextResponse.json({ success: true, found: true, id: item.id });
}
