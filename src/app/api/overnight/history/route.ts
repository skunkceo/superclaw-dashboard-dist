import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import db from '@/lib/db';

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10');

  const runs = db.prepare(
    'SELECT * FROM overnight_runs ORDER BY started_at DESC LIMIT ?'
  ).all(limit);

  return NextResponse.json({ runs });
}
