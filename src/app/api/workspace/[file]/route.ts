import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { getCurrentUser, hasRole } from '@/lib/auth';
import { getAgentWorkspacePath, getMainWorkspace } from '@/lib/workspace';

// Read workspace path from clawdbot config or agent-specific path
async function getWorkspacePath(agentId?: string | null) {
  if (agentId) {
    return getAgentWorkspacePath(agentId);
  }
  return getMainWorkspace();
}

const ALLOWED_FILES = [
  'SOUL.md',
  'USER.md',
  'IDENTITY.md',
  'TOOLS.md',
  'AGENTS.md',
  'MEMORY.md',
  'HEARTBEAT.md'
];

// Validate filename to prevent path traversal attacks
function validateFilename(filename: string): boolean {
  // Must be one of the allowed files
  if (!ALLOWED_FILES.includes(filename)) {
    return false;
  }
  
  // Must not contain path separators or traversal patterns
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return false;
  }
  
  // Must end with .md
  if (!filename.endsWith('.md')) {
    return false;
  }
  
  return true;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ file: string }> }
) {
  // Check authentication
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Check role - need at least 'edit' to view workspace files
  if (!hasRole(user.role, 'edit')) {
    return NextResponse.json({ error: 'Edit access required' }, { status: 403 });
  }

  const { file } = await context.params;
  
  try {
    if (!validateFilename(file)) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }
    
    // Get agent ID from query params
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent');
    
    const workspacePath = await getWorkspacePath(agentId);
    const filePath = path.join(workspacePath, file);
    
    try {
      const content = await readFile(filePath, 'utf-8');
      return NextResponse.json({
        filename: file,
        content
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return NextResponse.json({
          filename: file,
          content: '',
          exists: false
        });
      }
      throw error;
    }
  } catch (error) {
    console.error(`Error reading file ${file}:`, error);
    return NextResponse.json(
      { error: 'Failed to read file' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ file: string }> }
) {
  // Check authentication
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Check role - need 'edit' to modify workspace files
  if (!hasRole(user.role, 'edit')) {
    return NextResponse.json({ error: 'Edit access required' }, { status: 403 });
  }

  const { file } = await context.params;
  
  try {
    if (!validateFilename(file)) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { content } = body;
    
    if (typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content must be a string' },
        { status: 400 }
      );
    }
    
    // Get agent ID from query params
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent');
    
    const workspacePath = await getWorkspacePath(agentId);
    const filePath = path.join(workspacePath, file);
    
    await writeFile(filePath, content, 'utf-8');
    
    return NextResponse.json({
      success: true,
      filename: file
    });
  } catch (error) {
    console.error(`Error writing file ${file}:`, error);
    return NextResponse.json(
      { error: 'Failed to write file' },
      { status: 500 }
    );
  }
}