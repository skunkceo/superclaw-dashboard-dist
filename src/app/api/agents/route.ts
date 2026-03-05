import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
import { getOpenClawWorkspace } from '@/lib/workspace';

// GET - List all agents from the workspace agents directory
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const workspace = getOpenClawWorkspace();
    const agentsDir = path.join(workspace, 'agents');

    if (!fs.existsSync(agentsDir)) {
      return NextResponse.json({ agents: [] });
    }

    const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
    const agents = entries
      .filter(e => e.isDirectory())
      .map(e => ({
        id: e.name,
        name: e.name,
        isDefault: false,
      }));

    return NextResponse.json({ agents });
  } catch (error: any) {
    console.error('Failed to list agents:', error);
    return NextResponse.json({
      error: 'Failed to list agents',
      details: error.message
    }, { status: 500 });
  }
}

// POST - placeholder
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    error: 'Agent creation via API not supported. Use the OpenClaw CLI directly.'
  }, { status: 501 });
}
