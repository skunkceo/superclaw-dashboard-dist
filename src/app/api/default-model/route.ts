import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getConfigPaths } from '@/lib/workspace';

const execAsync = promisify(exec);

// Read OpenClaw config
function getConfig() {
  const configPaths = [
    ...getConfigPaths(),
    join(process.env.HOME || '', '.openclaw/openclaw.json'),
    join(process.env.HOME || '', '.clawdbot/clawdbot.json'),
  ];

  for (const path of configPaths) {
    if (existsSync(path)) {
      try {
        const config = JSON.parse(readFileSync(path, 'utf8'));
        return { config, path };
      } catch {
        continue;
      }
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { modelId } = await request.json();
  if (!modelId) {
    return NextResponse.json({ error: 'Model ID is required' }, { status: 400 });
  }

  const configData = getConfig();
  if (!configData) {
    return NextResponse.json({ error: 'No OpenClaw config found' }, { status: 404 });
  }

  const { config, path } = configData;

  try {
    // Update the default model in the config
    if (!config.agents) {
      config.agents = {};
    }
    if (!config.agents.defaults) {
      config.agents.defaults = {};
    }
    if (!config.agents.defaults.model) {
      config.agents.defaults.model = {};
    }
    
    config.agents.defaults.model.primary = modelId;

    // Write the updated config
    writeFileSync(path, JSON.stringify(config, null, 2));

    // Restart the OpenClaw gateway
    try {
      await execAsync('openclaw gateway restart');
    } catch (restartError) {
      console.error('Failed to restart gateway:', restartError);
      // Return success anyway since the config was updated
    }

    return NextResponse.json({ 
      success: true, 
      defaultModel: modelId,
      message: 'Default model updated and gateway restarted'
    });
  } catch (error) {
    console.error('Failed to update config:', error);
    return NextResponse.json({ error: 'Failed to update default model' }, { status: 500 });
  }
}