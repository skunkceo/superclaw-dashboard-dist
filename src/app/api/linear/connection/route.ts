import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getProactivitySetting, setProactivitySetting } from '@/lib/db';
import { testLinearConnection } from '@/lib/linear';

interface LinearConfigData {
  apiKey: string;
  teamId: string;
  teamName: string;
}

/**
 * GET /api/linear/connection
 * Returns the current Linear connection status (never exposes apiKey).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const configStr = getProactivitySetting('linear_config');
    if (!configStr) {
      return NextResponse.json({ connected: false });
    }

    const config: LinearConfigData = JSON.parse(configStr);
    return NextResponse.json({
      connected: true,
      teamName: config.teamName,
      teamId: config.teamId,
    });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

/**
 * POST /api/linear/connection
 * Connect to Linear by validating the API key and saving the config.
 * Body: { apiKey: string, teamId: string, teamName: string }
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role === 'view') {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { apiKey, teamId, teamName } = body;

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    if (!teamId || typeof teamId !== 'string') {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    if (!teamName || typeof teamName !== 'string') {
      return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
    }

    // Validate the API key by making a test query
    const testResult = await testLinearConnection(apiKey);
    if (!testResult.valid) {
      return NextResponse.json(
        { error: testResult.error || 'Invalid API key' },
        { status: 400 }
      );
    }

    // Save the config to proactivity_settings
    const config: LinearConfigData = { apiKey, teamId, teamName };
    setProactivitySetting('linear_config', JSON.stringify(config));

    return NextResponse.json({ success: true, teamName });
  } catch (err) {
    console.error('Failed to save Linear connection:', err);
    return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 });
  }
}

/**
 * DELETE /api/linear/connection
 * Disconnect from Linear by removing the config.
 */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role === 'view') {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  try {
    // Remove the linear_config setting by setting it to empty
    setProactivitySetting('linear_config', '');

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to remove Linear connection:', err);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
