import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getCurrentUser } from '@/lib/auth';
import { getMainWorkspace, getOpenClawWorkspace } from '@/lib/workspace';
import { getCronJobsPaths } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = getMainWorkspace();
  const openclawWorkspace = getOpenClawWorkspace();

  // --- Step 1: Business profile ---
  const businessProfilePath = join(workspace, 'business-profile.md');
  const hasBusinessProfile = existsSync(businessProfilePath);

  // --- Step 2: WordPress / CLI skill ---
  const wpSkillPaths = [
    join(openclawWorkspace, 'skills', 'wp-cli', 'SKILL.md'),
    join(openclawWorkspace, 'skills', 'wp-studio', 'SKILL.md'),
    join(workspace, 'skills', 'wp-cli', 'SKILL.md'),
  ];
  const hasWpSkill = wpSkillPaths.some(existsSync);

  // --- Step 3: Linear ---
  const linearCredPaths = [
    join(workspace, 'credentials', 'linear-api.json'),
    join(workspace, 'skills', 'linear', 'credentials.json'),
  ];
  const hasLinear = linearCredPaths.some(p => {
    if (!existsSync(p)) return false;
    try {
      const cred = JSON.parse(readFileSync(p, 'utf8'));
      return !!(cred.api_key || cred.apiKey || cred.token);
    } catch { return false; }
  });

  // --- Step 5: Cron jobs customised? ---
  const cronPaths = getCronJobsPaths();
  let cronJobCount = 0;
  for (const p of cronPaths) {
    if (existsSync(p)) {
      try {
        const data = JSON.parse(readFileSync(p, 'utf8'));
        cronJobCount = (data.jobs || []).filter((j: any) => j.enabled).length;
      } catch { /* ignore */ }
      break;
    }
  }
  const hasCronJobs = cronJobCount > 0;

  // --- Step 6: Memory embeddings ---
  const embeddingsSettingPath = join(openclawWorkspace, '..', 'superclaw.db');
  // We'll just check if there's any embeddings config in the superclaw DB
  // For now, return false (user hasn't configured it)
  const hasEmbeddings = false;

  // --- Workspace quick links ---
  const workspaceFiles = [
    { name: 'SOUL.md', path: join(workspace, 'SOUL.md'), exists: existsSync(join(workspace, 'SOUL.md')) },
    { name: 'MEMORY.md', path: join(workspace, 'MEMORY.md'), exists: existsSync(join(workspace, 'MEMORY.md')) },
    { name: 'TOOLS.md', path: join(workspace, 'TOOLS.md'), exists: existsSync(join(workspace, 'TOOLS.md')) },
    { name: 'AGENTS.md', path: join(workspace, 'AGENTS.md'), exists: existsSync(join(workspace, 'AGENTS.md')) },
    { name: 'HEARTBEAT.md', path: join(workspace, 'HEARTBEAT.md'), exists: existsSync(join(workspace, 'HEARTBEAT.md')) },
    { name: 'business-profile.md', path: businessProfilePath, exists: hasBusinessProfile },
  ];

  return NextResponse.json({
    steps: {
      businessProfile: hasBusinessProfile,
      wpSkill: hasWpSkill,
      linear: hasLinear,
      // Steps 4, 7, 8 are always action-based, no completion detection
      cronJobs: hasCronJobs,
      embeddings: hasEmbeddings,
    },
    cronJobCount,
    workspaceFiles: workspaceFiles.filter(f => f.exists).map(f => f.name),
  });
}
