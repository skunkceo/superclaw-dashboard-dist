import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// GET - List all agents
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { stdout } = await execAsync('openclaw agents list --json 2>&1');

    // Try to parse JSON from output
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('{')) {
        try {
          const data = JSON.parse(line);
          return NextResponse.json(data);
        } catch {}
      }
    }

    // Fallback: parse text output
    const agents = [];
    const agentMatches = stdout.matchAll(/- (\w+)(?:\s+\(default\))?/g);
    for (const match of agentMatches) {
      agents.push({
        id: match[1],
        name: match[1],
        isDefault: stdout.includes(`${match[1]} (default)`)
      });
    }

    return NextResponse.json({ agents });
  } catch (error: any) {
    console.error('Failed to list agents:', error);
    return NextResponse.json({
      error: 'Failed to list agents',
      details: error.message
    }, { status: 500 });
  }
}

// POST - Create a new agent
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, workspace, model, bind } = body;

    if (!name || !workspace) {
      return NextResponse.json({
        error: 'Name and workspace are required'
      }, { status: 400 });
    }

    // Build command
    let cmd = `openclaw agents add ${name} --non-interactive --workspace "${workspace}"`;

    if (model) {
      cmd += ` --model "${model}"`;
    }

    if (bind && Array.isArray(bind)) {
      for (const binding of bind) {
        cmd += ` --bind "${binding}"`;
      }
    }

    const { stdout, stderr } = await execAsync(cmd + ' 2>&1');

    // Check for errors
    if (stderr && !stdout.includes('successfully')) {
      throw new Error(stderr);
    }

    return NextResponse.json({
      success: true,
      message: `Agent '${name}' created successfully`,
      output: stdout
    });
  } catch (error: any) {
    console.error('Failed to create agent:', error);
    return NextResponse.json({
      error: 'Failed to create agent',
      details: error.message
    }, { status: 500 });
  }
}
