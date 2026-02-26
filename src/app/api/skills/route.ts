import { NextResponse } from 'next/server';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { getCurrentUser } from '@/lib/auth';
import { getSkillsDir } from '@/lib/workspace';

interface SkillFile {
  name: string;
  path: string;
  size: number;
}

interface Skill {
  name: string;
  source: 'openclaw-bundled' | 'openclaw-workspace' | 'custom';
  location: string;
  description: string;
  enabled: boolean;
  files: SkillFile[];
}

function scanSkillDirectory(dir: string, source: 'openclaw-bundled' | 'openclaw-workspace' | 'custom'): Skill[] {
  if (!existsSync(dir)) return [];

  const skills: Skill[] = [];
  
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const skillPath = join(dir, entry.name);
      const skillMdPath = join(skillPath, 'SKILL.md');
      
      if (!existsSync(skillMdPath)) continue;
      
      // Read SKILL.md to extract description
      const skillMd = readFileSync(skillMdPath, 'utf8');
      const descMatch = skillMd.match(/^#[^#\n]+\n\n([^\n]+)/);
      const description = descMatch ? descMatch[1] : 'No description available';
      
      // List all files in the skill directory
      const files: SkillFile[] = [];
      try {
        const skillFiles = readdirSync(skillPath);
        for (const file of skillFiles) {
          const filePath = join(skillPath, file);
          const stats = statSync(filePath);
          if (stats.isFile()) {
            files.push({
              name: file,
              path: join(entry.name, file),
              size: stats.size,
            });
          }
        }
      } catch {}
      
      skills.push({
        name: entry.name,
        source,
        location: skillPath,
        description,
        enabled: true, // Would need to check config
        files,
      });
    }
  } catch (err) {
    console.error(`Error scanning skill directory ${dir}:`, err);
  }
  
  return skills;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const skills: Skill[] = [];
  
  // 1. OpenClaw bundled skills
  const openclawPaths = [
    process.env.OPENCLAW_SYSTEM_SKILLS || join(os.homedir(), '.nvm/versions/node/v24.13.0/lib/node_modules/openclaw/skills'),
    '/usr/local/lib/node_modules/openclaw/skills',
  ];
  
  for (const path of openclawPaths) {
    if (existsSync(path)) {
      skills.push(...scanSkillDirectory(path, 'openclaw-bundled'));
      break;
    }
  }
  
  // 2. Workspace skills
  const workspacePaths = [
    getSkillsDir(),
    process.env.OPENCLAW_USER_SKILLS || join(os.homedir(), 'clawd/skills'),
  ];
  
  for (const path of workspacePaths) {
    if (existsSync(path)) {
      skills.push(...scanSkillDirectory(path, 'openclaw-workspace'));
      break;
    }
  }
  
  return NextResponse.json({ skills });
}
