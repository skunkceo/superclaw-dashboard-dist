import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path, { join } from 'path';
import os from 'os';
import { getConfigPaths } from '@/lib/workspace';

const execAsync = promisify(exec);

function getConfigPath(): string | null {
  const paths = [
    ...getConfigPaths(),
  ];
  
  for (const path of paths) {
    if (existsSync(path)) return path;
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { modelId } = await request.json();

    if (!modelId || typeof modelId !== 'string') {
      return NextResponse.json({ error: 'Model ID is required' }, { status: 400 });
    }

    const configPath = getConfigPath();
    if (!configPath) {
      return NextResponse.json({ error: 'OpenClaw config not found' }, { status: 500 });
    }

    // Read current config
    const config = JSON.parse(readFileSync(configPath, 'utf8'));

    // Update default model
    if (!config.agents) config.agents = {};
    if (!config.agents.defaults) config.agents.defaults = {};
    
    config.agents.defaults.model = `anthropic/${modelId}`;

    // Write back to config
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    // Restart gateway (fire-and-forget)
    setImmediate(() => {
      const pm2Path = process.env.PM2_PATH || path.join(os.homedir(), '.nvm/versions/node/v24.13.0/bin/pm2');
      const user = process.env.OPENCLAW_USER || process.env.USER;
      exec(`sudo -u ${user} ${pm2Path} restart clawdbot`, (error) => {
        if (error) {
          console.error('PM2 restart error:', error);
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Default model updated. Gateway restarting...',
      newModel: modelId,
    });

  } catch (error: any) {
    console.error('Change default model error:', error);
    return NextResponse.json({
      error: 'Failed to change default model',
      details: error.message,
    }, { status: 500 });
  }
}
