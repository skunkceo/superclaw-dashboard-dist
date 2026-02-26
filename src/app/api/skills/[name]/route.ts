import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { getCurrentUser } from '@/lib/auth';
import { getSkillsDir } from '@/lib/workspace';

function findSkillPath(skillName: string): string | null {
  const searchPaths = [
    process.env.OPENCLAW_SYSTEM_SKILLS || join(os.homedir(), '.nvm/versions/node/v24.13.0/lib/node_modules/openclaw/skills'),
    getSkillsDir(),
    '/usr/local/lib/node_modules/openclaw/skills',
    process.env.OPENCLAW_USER_SKILLS || join(os.homedir(), 'clawd/skills'),
  ];
  
  for (const basePath of searchPaths) {
    const skillPath = join(basePath, skillName);
    if (existsSync(skillPath) && existsSync(join(skillPath, 'SKILL.md'))) {
      return skillPath;
    }
  }
  
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name: skillName } = await params;
  const url = new URL(request.url);
  const file = url.searchParams.get('file');

  const skillPath = findSkillPath(skillName);
  if (!skillPath) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }

  // If requesting a specific file
  if (file) {
    const filePath = join(skillPath, file);
    
    // Security: ensure the file is within the skill directory
    if (!filePath.startsWith(skillPath)) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }
    
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    
    try {
      const content = readFileSync(filePath, 'utf8');
      return NextResponse.json({ 
        name: file,
        content,
        path: filePath,
      });
    } catch (err) {
      return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
    }
  }

  // Otherwise return skill metadata
  try {
    const skillMd = readFileSync(join(skillPath, 'SKILL.md'), 'utf8');
    const files = readdirSync(skillPath).filter(f => f !== 'node_modules');
    
    return NextResponse.json({
      name: skillName,
      location: skillPath,
      skillMd,
      files,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to read skill' }, { status: 500 });
  }
}
