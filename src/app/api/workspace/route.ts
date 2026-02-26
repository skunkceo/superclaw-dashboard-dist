import { NextResponse } from 'next/server';
import { readFile, readdir, stat } from 'fs/promises';
import path from 'path';
import { getCurrentUser, hasRole } from '@/lib/auth';
import { getAgentWorkspacePath, getOpenClawWorkspace } from '@/lib/workspace';

// Read workspace path from clawdbot config or agent-specific path
async function getWorkspacePath(agentId?: string | null) {
  if (agentId) {
    return getAgentWorkspacePath(agentId);
  }
  return getOpenClawWorkspace();
}

// Read agent display name from IDENTITY.md
async function getAgentName(agentId: string, workspacePath: string): Promise<string | null> {
  try {
    const identityPath = path.join(workspacePath, 'IDENTITY.md');
    const content = await readFile(identityPath, 'utf-8');
    const match = content.match(/\*\*Name:\*\*\s*(.+)/);
    return match ? match[1].trim() : agentId;
  } catch {
    return agentId;
  }
}

// Files shown in main workspace editor
const MAIN_WORKSPACE_FILES = [
  'SOUL.md',
  'USER.md',
  'IDENTITY.md',
  'TOOLS.md',
  'AGENTS.md',
  'MEMORY.md',
  'HEARTBEAT.md'
];

// Files shown in an agent's workspace editor
const AGENT_WORKSPACE_FILES = [
  'AGENTS.md',
  'IDENTITY.md',
  'MEMORY.md',
];

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (!hasRole(user.role, 'edit')) {
    return NextResponse.json({ error: 'Edit access required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent');
    
    const workspacePath = await getWorkspacePath(agentId);
    const agentName = agentId ? await getAgentName(agentId, workspacePath) : null;
    
    const allowedFiles = agentId ? AGENT_WORKSPACE_FILES : MAIN_WORKSPACE_FILES;

    const files = await Promise.all(
      allowedFiles.map(async (filename) => {
        try {
          const filePath = path.join(workspacePath, filename);
          await readFile(filePath, 'utf-8');
          return { name: filename, exists: true };
        } catch {
          return { name: filename, exists: false };
        }
      })
    );

    // Include memory/ daily files
    const memoryFiles: Array<{ name: string; exists: boolean }> = [];
    try {
      const memoryDir = path.join(workspacePath, 'memory');
      const dirStat = await stat(memoryDir);
      if (dirStat.isDirectory()) {
        const entries = await readdir(memoryDir);
        const mdFiles = entries
          .filter(f => f.endsWith('.md') || f.endsWith('.json'))
          .sort()
          .reverse()
          .slice(0, 14);
        for (const f of mdFiles) {
          memoryFiles.push({ name: `memory/${f}`, exists: true });
        }
      }
    } catch {
      // no memory dir
    }

    return NextResponse.json({
      workspacePath,
      agentName,
      files: [...files, ...memoryFiles]
    });
  } catch (error) {
    console.error('Error listing workspace files:', error);
    return NextResponse.json(
      { error: 'Failed to list workspace files' },
      { status: 500 }
    );
  }
}
