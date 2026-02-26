import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchTeamsWithApiKey } from '@/lib/linear';

/**
 * GET /api/linear/teams?apiKey=xxx
 * Fetch teams accessible with the provided API key.
 * Used during connection setup before saving the config.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = request.nextUrl.searchParams.get('apiKey');

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 400 });
  }

  try {
    const teams = await fetchTeamsWithApiKey(apiKey);

    if (teams.length === 0) {
      return NextResponse.json(
        { error: 'No teams found or invalid API key' },
        { status: 400 }
      );
    }

    return NextResponse.json({ teams });
  } catch (err) {
    console.error('Failed to fetch Linear teams:', err);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
