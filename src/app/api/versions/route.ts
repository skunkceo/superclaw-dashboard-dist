import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import packageJson from '../../../../package.json';
import { getCurrentUser } from '@/lib/auth';

const GITHUB_RELEASES_DASHBOARD = 'https://api.github.com/repos/skunkceo/superclaw-dashboard/releases/latest';
const GITHUB_RELEASES_OPENCLAW = 'https://api.github.com/repos/openclaw/openclaw/releases/latest';
const NPM_REGISTRY_OPENCLAW = 'https://registry.npmjs.org/openclaw';

const GITHUB_HEADERS = {
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Dashboard version
  const dashboardCurrent = packageJson.version;
  let dashboardLatest = dashboardCurrent;
  let dashboardUpdateAvailable = false;
  let dashboardReleaseNotes: string | null = null;

  try {
    const res = await fetch(GITHUB_RELEASES_DASHBOARD, {
      headers: GITHUB_HEADERS,
      next: { revalidate: 3600 }
    });
    if (res.ok) {
      const data = await res.json();
      // tag_name is e.g. "v2.2.1" — strip the leading "v"
      dashboardLatest = (data.tag_name || dashboardCurrent).replace(/^v/, '');
      dashboardUpdateAvailable = compareVersions(dashboardLatest, dashboardCurrent) > 0;
      if (dashboardUpdateAvailable && data.body) {
        dashboardReleaseNotes = data.body as string;
      }
    }
  } catch (e) {
    console.error('Failed to check dashboard version:', e);
  }

  // OpenClaw version
  let openclawCurrent = 'unknown';
  let openclawLatest = 'unknown';
  let openclawUpdateAvailable = false;
  let openclawCommand = 'openclaw'; // or 'clawdbot' for legacy
  let openclawReleaseNotes: string | null = null;

  try {
    // Try openclaw first, fall back to clawdbot
    try {
      openclawCurrent = execSync('openclaw --version 2>/dev/null', { encoding: 'utf8' }).trim();
    } catch {
      try {
        openclawCurrent = execSync('clawdbot --version 2>/dev/null', { encoding: 'utf8' }).trim();
        openclawCommand = 'clawdbot';
      } catch {
        openclawCurrent = 'not installed';
      }
    }

    // Check npm for latest version
    const res = await fetch(NPM_REGISTRY_OPENCLAW, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 3600 }
    });
    if (res.ok) {
      const data = await res.json();
      openclawLatest = data['dist-tags']?.latest || openclawCurrent;
      if (openclawCurrent !== 'not installed' && openclawCurrent !== 'unknown') {
        openclawUpdateAvailable = compareVersions(openclawLatest, openclawCurrent) > 0;
      }
    }

    // If there's an update, try to fetch release notes from GitHub
    if (openclawUpdateAvailable) {
      try {
        const ghRes = await fetch(GITHUB_RELEASES_OPENCLAW, {
          headers: GITHUB_HEADERS,
          next: { revalidate: 3600 }
        });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          if (ghData.body) {
            openclawReleaseNotes = ghData.body as string;
          }
        }
      } catch (e) {
        console.error('Failed to fetch OpenClaw release notes:', e);
      }
    }
  } catch (e) {
    console.error('Failed to check OpenClaw version:', e);
  }

  // Node version
  const nodeVersion = process.version;

  return NextResponse.json({
    dashboard: {
      current: dashboardCurrent,
      latest: dashboardLatest,
      updateAvailable: dashboardUpdateAvailable,
      updateCommand: 'superclaw update',
      changelog: dashboardUpdateAvailable 
        ? `https://github.com/skunkceo/superclaw-dashboard/releases/tag/v${dashboardLatest}` 
        : null,
      releaseNotes: dashboardReleaseNotes,
    },
    openclaw: {
      current: openclawCurrent,
      latest: openclawLatest,
      updateAvailable: openclawUpdateAvailable,
      command: openclawCommand,
      updateCommand: openclawCommand === 'clawdbot' 
        ? 'npm uninstall -g clawdbot && npm install -g openclaw'
        : 'npm update -g openclaw',
      isLegacy: openclawCommand === 'clawdbot',
      // Strip npm patch suffix (e.g. "2026.2.21-2") — GitHub tags don't include it
      releaseUrl: openclawUpdateAvailable
        ? `https://github.com/openclaw/openclaw/releases/tag/v${openclawLatest.replace(/-\d+$/, '')}`
        : null,
      changelog: openclawUpdateAvailable
        ? `https://github.com/openclaw/openclaw/releases/tag/v${openclawLatest.replace(/-\d+$/, '')}`
        : null,
      releaseNotes: openclawReleaseNotes,
    },
    node: {
      version: nodeVersion
    },
    checkedAt: new Date().toISOString()
  });
}

function compareVersions(a: string, b: string): number {
  // Handle date-based versions like 2026.2.13
  const partsA = a.split(/[.-]/).map(p => parseInt(p) || 0);
  const partsB = b.split(/[.-]/).map(p => parseInt(p) || 0);
  
  const maxLen = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLen; i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
