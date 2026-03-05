import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSetting, setSetting } from '@/lib/db';

// GET — return current config status
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check DB first, then fall back to env vars
    const storedJson = getSetting('google_service_account');
    let clientEmail: string | undefined;
    let privateKey: string | undefined;

    if (storedJson) {
      try {
        const parsed = JSON.parse(storedJson);
        clientEmail = parsed.client_email;
        privateKey = parsed.private_key;
      } catch {
        // Corrupt stored JSON — ignore
      }
    }

    if (!clientEmail) clientEmail = process.env.GA4_CLIENT_EMAIL;
    if (!privateKey) privateKey = process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, '\n');

    const configured = !!(clientEmail && privateKey);

    return NextResponse.json({ configured });
  } catch {
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 });
  }
}

// POST — save service account credentials to DB
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { serviceAccountJson } = body;

    if (!serviceAccountJson?.client_email || !serviceAccountJson?.private_key) {
      return NextResponse.json(
        { error: 'Service account JSON must contain client_email and private_key fields' },
        { status: 400 }
      );
    }

    // Store the full JSON blob in the DB
    setSetting('google_service_account', JSON.stringify(serviceAccountJson));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to save analytics credentials:', err);
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
  }
}
