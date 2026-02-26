import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { licenseKey } = await request.json();

    if (!licenseKey || typeof licenseKey !== 'string') {
      return NextResponse.json(
        { valid: false, message: 'License key is required' },
        { status: 400 }
      );
    }

    // Validate against SuperClaw-specific endpoint on skunkglobal.com
    const response = await fetch('https://skunkglobal.com/api/superclaw/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ licenseKey }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { valid: false, message: 'Failed to validate license with server' },
        { status: 500 }
      );
    }

    const data = await response.json();

    if (data.valid) {
      // Store license locally
      const configDir = process.env.SUPERCLAW_DATA_DIR || path.join(os.homedir(), '.superclaw');

      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const licensePath = path.join(configDir, 'license.json');
      fs.writeFileSync(licensePath, JSON.stringify({
        key: licenseKey,
        activatedAt: Date.now(),
        product: 'superclaw-dashboard-pro',
        tier: data.tier || 'pro',
        email: data.email || null,
        features: data.features || ['pro', 'smart-router', 'advanced-analytics'],
        expiresAt: data.expiresAt || null,
      }, null, 2));

      return NextResponse.json({
        valid: true,
        message: 'License activated successfully',
        tier: data.tier || 'pro',
      });
    } else {
      return NextResponse.json({
        valid: false,
        message: data.message || 'Invalid license key',
      });
    }

  } catch (error) {
    console.error('License validation error:', error);
    return NextResponse.json(
      { valid: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
