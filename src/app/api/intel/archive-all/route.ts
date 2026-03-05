import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import db from '@/lib/db';

export async function POST() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = Date.now();
  const result = db.prepare(
    'UPDATE intel_items SET archived_at = ? WHERE archived_at IS NULL'
  ).run(now);

  return NextResponse.json({ success: true, count: result.changes });
}
