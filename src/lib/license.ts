import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface LicenseData {
  key: string;
  email: string;
  status: 'active' | 'expired' | 'invalid';
  activatedAt: number;
  expiresAt?: number;
  features: string[];
}

const LICENSE_FILE = join(process.env.HOME || '/root', '.superclaw/license.json');

export function getLicense(): LicenseData | null {
  if (!existsSync(LICENSE_FILE)) {
    return null;
  }

  try {
    const data = JSON.parse(readFileSync(LICENSE_FILE, 'utf8'));
    return data;
  } catch {
    return null;
  }
}

export function saveLicense(license: LicenseData): void {
  const dir = join(process.env.HOME || '/root', '.superclaw');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(LICENSE_FILE, JSON.stringify(license, null, 2));
}

export function hasProFeature(feature: string): boolean {
  const license = getLicense();
  if (!license || license.status !== 'active') {
    return false;
  }

  // Check expiry
  if (license.expiresAt && license.expiresAt < Date.now()) {
    return false;
  }

  return license.features.includes(feature) || license.features.includes('pro');
}

export function getProFeatures(): string[] {
  const license = getLicense();
  if (!license || license.status !== 'active') {
    return [];
  }
  return license.features;
}

export async function validateLicenseKey(key: string, email: string): Promise<{ valid: boolean; message: string; features?: string[] }> {
  try {
    // Validate against Stripe/license server
    // For now, using basic validation - replace with real API call
    const response = await fetch('https://skunkglobal.com/api/license/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, email }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        valid: true,
        message: 'License activated successfully',
        features: data.features || ['pro', 'smart-router', 'advanced-analytics'],
      };
    } else {
      return {
        valid: false,
        message: 'Invalid license key',
      };
    }
  } catch (error) {
    // Fallback: validate format only (for testing)
    if (key.startsWith('SUPERCLAW-PRO-')) {
      return {
        valid: true,
        message: 'License activated (offline mode)',
        features: ['pro', 'smart-router', 'advanced-analytics'],
      };
    }
    
    return {
      valid: false,
      message: 'Unable to validate license. Check your connection.',
    };
  }
}
