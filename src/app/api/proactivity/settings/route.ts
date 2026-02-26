import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllProactivitySettings, setProactivitySetting } from '@/lib/db';

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings = getAllProactivitySettings();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { settings } = body as { settings: Record<string, string> };

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'settings object required' }, { status: 400 });
    }

    // Whitelist of allowed settings
    const allowedKeys = [
      'overnight_mode',
      'overnight_start_time',
      'overnight_end_time',
      'intel_refresh_interval_hours',
      'suggestion_auto_generate',
    ];

    for (const [key, value] of Object.entries(settings)) {
      if (allowedKeys.includes(key)) {
        setProactivitySetting(key, String(value));
      }
    }

    return NextResponse.json({ success: true, settings: getAllProactivitySettings() });
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
