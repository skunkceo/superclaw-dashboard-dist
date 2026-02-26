import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

const ENV_FILE = path.join(process.cwd(), '.env.local');

function readEnvFile(): Record<string, string> {
  if (!fs.existsSync(ENV_FILE)) return {};
  const lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n');
  const env: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    env[key] = value;
  }
  return env;
}

function writeEnvFile(env: Record<string, string>): void {
  const lines = Object.entries(env).map(([k, v]) => {
    // Wrap multi-line values (private keys) in double quotes
    const escaped = v.replace(/\n/g, '\\n');
    return `${k}="${escaped}"`;
  });
  fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n', 'utf8');
}

// GET — return current config status
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const clientEmail = process.env.GA4_CLIENT_EMAIL;
    const privateKey = process.env.GA4_PRIVATE_KEY;
    const propertyId = process.env.GA4_PROPERTY_ID;

    return NextResponse.json({
      configured: !!(clientEmail && privateKey),
      propertyId: propertyId || '',
      // Don't expose the email/key values
    });
  } catch {
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 });
  }
}

// POST — save credentials to .env.local
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { serviceAccountJson, propertyId } = body;

    const env = readEnvFile();

    if (serviceAccountJson?.client_email && serviceAccountJson?.private_key) {
      env['GA4_CLIENT_EMAIL'] = serviceAccountJson.client_email;
      env['GA4_PRIVATE_KEY'] = serviceAccountJson.private_key;
    }

    if (propertyId) {
      env['GA4_PROPERTY_ID'] = propertyId;
    }

    if (!env['GA4_CLIENT_EMAIL'] || !env['GA4_PROPERTY_ID']) {
      return NextResponse.json(
        { error: 'Both service account JSON and property ID are required' },
        { status: 400 }
      );
    }

    writeEnvFile(env);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to save analytics credentials:', err);
    return NextResponse.json({ error: 'Failed to save credentials' }, { status: 500 });
  }
}
