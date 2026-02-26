import { NextResponse } from 'next/server';
import { getOpenClawWorkspace } from '@/lib/workspace';
import { existsSync, writeFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

export async function GET() {
  try {
    const workspace = getOpenClawWorkspace();

    // Primary check: has the setup wizard been run? (flag file written by /api/setup/scaffold)
    const flagPath = path.join(workspace, '.setup_complete');
    if (existsSync(flagPath)) {
      return NextResponse.json({ needsSetup: false });
    }

    // Secondary check: if agents directory exists with 3+ scaffolded agent dirs, treat as set up
    // (handles existing installs that ran scaffold before the flag file was introduced)
    const agentsDir = path.join(workspace, 'agents');
    if (existsSync(agentsDir)) {
      try {
        const agentDirs = readdirSync(agentsDir).filter((name) => {
          const fullPath = path.join(agentsDir, name);
          return statSync(fullPath).isDirectory() && existsSync(path.join(fullPath, 'MEMORY.md'));
        });
        if (agentDirs.length >= 3) {
          // Looks like a configured install — write the flag so we don't check again
          try { writeFileSync(flagPath, new Date().toISOString(), 'utf-8'); } catch { /* non-fatal */ }
          return NextResponse.json({ needsSetup: false });
        }
      } catch {
        // Fall through to needsSetup: true
      }
    }

    return NextResponse.json({ needsSetup: true, reason: 'setup_not_run' });
  } catch (error) {
    console.error('Setup status check error:', error);
    // Don't block access if the check fails
    return NextResponse.json({ needsSetup: false });
  }
}
