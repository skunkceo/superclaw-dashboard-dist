import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getCurrentUser, hasRole } from '@/lib/auth';
import { getMainWorkspace, getAgentWorkspacePath } from '@/lib/workspace';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasRole(user.role, 'edit')) {
    return NextResponse.json({ error: 'Edit access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get('path');
  const agentId = searchParams.get('agent');

  if (!filePath) {
    return NextResponse.json({ error: 'Path parameter required' }, { status: 400 });
  }

  try {
    const workspaceRoot = agentId
      ? await getAgentWorkspacePath(agentId)
      : getMainWorkspace();

    const resolvedPath = join(workspaceRoot, filePath);

    // Security: ensure resolved path stays within workspace root
    if (!resolvedPath.startsWith(workspaceRoot)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
    }

    const content = await readFile(resolvedPath, 'utf8');
    return NextResponse.json({ content, path: filePath, filename: filePath });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    console.error('Failed to read workspace file:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
