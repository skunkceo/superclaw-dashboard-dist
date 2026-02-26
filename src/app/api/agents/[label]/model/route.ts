import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getOpenClawWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

// GET: return current preferred model for an agent
export async function GET(
  request: Request,
  { params }: { params: Promise<{ label: string }> }
) {
  try {
    const { label } = await params;
    const agentPath = path.join(getOpenClawWorkspace(), 'agents', label);

    if (!fs.existsSync(agentPath)) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Check config.json first
    const configPath = path.join(agentPath, 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.preferredModel) {
        return NextResponse.json({ model: config.preferredModel });
      }
    }

    return NextResponse.json({ model: null });
  } catch (error) {
    console.error('Error reading agent model:', error);
    return NextResponse.json({ error: 'Failed to read model' }, { status: 500 });
  }
}

// PUT: save preferred model for an agent
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ label: string }> }
) {
  try {
    const { label } = await params;
    const agentPath = path.join(getOpenClawWorkspace(), 'agents', label);

    if (!fs.existsSync(agentPath)) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const body = await request.json();
    const { model } = body;

    if (!model || typeof model !== 'string') {
      return NextResponse.json({ error: 'model is required' }, { status: 400 });
    }

    // Read or create config.json
    const configPath = path.join(agentPath, 'config.json');
    let config: Record<string, unknown> = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }

    config.preferredModel = model;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    return NextResponse.json({ ok: true, model });
  } catch (error) {
    console.error('Error saving agent model:', error);
    return NextResponse.json({ error: 'Failed to save model' }, { status: 500 });
  }
}
