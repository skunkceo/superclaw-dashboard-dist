import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getActivityLog } from '@/lib/db';

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const hoursParam = searchParams.get('hours');
  const limitParam = searchParams.get('limit');
  const agentParam = searchParams.get('agent');
  const typeParam = searchParams.get('type');

  const limit = limitParam ? parseInt(limitParam) : 50;

  // Only apply a time filter when explicitly requested — default to all history
  const since = hoursParam ? Date.now() - (parseInt(hoursParam) * 60 * 60 * 1000) : 0;

  const entries = getActivityLog({
    since,
    limit,
    ...(agentParam && agentParam !== 'all' ? { agent_label: agentParam } : {}),
    ...(typeParam && typeParam !== 'all' ? { action_type: typeParam } : {}),
  });

  return NextResponse.json({ entries, count: entries.length });
}
