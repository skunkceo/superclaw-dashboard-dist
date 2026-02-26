import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getTeamWorkflowStates } from '@/lib/linear';

/**
 * GET /api/linear/states
 * Fetch all workflow states for the configured team.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const states = await getTeamWorkflowStates();
    return NextResponse.json({ states });
  } catch (err) {
    console.error('Failed to fetch Linear states:', err);
    return NextResponse.json({ error: 'Failed to fetch states' }, { status: 500 });
  }
}
