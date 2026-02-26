import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readFileSync, existsSync } from 'fs';
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
        return JSON.parse(readFileSync(path, 'utf8'));
      } catch {
        continue;
      }
    }
  }
  return null;
}

// Map model tier based on name heuristics
function getModelTier(name: string): string {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('opus')) return 'Premium';
  if (nameLower.includes('haiku')) return 'Fast';
  if (nameLower.includes('sonnet')) return 'Balanced';
  if (nameLower.includes('gpt-4o-mini')) return 'Fast';
  if (nameLower.includes('gpt-4')) return 'Premium';
  return 'Balanced';
}

// Get provider from model key
function getProvider(key: string): string {
  if (key.startsWith('anthropic/')) return 'Anthropic';
  if (key.startsWith('openai/')) return 'OpenAI';
  if (key.startsWith('google/')) return 'Google';
  if (key.includes('claude')) return 'Anthropic';
  if (key.includes('gpt')) return 'OpenAI';
  return 'Unknown';
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = getConfig();
  if (!config) {
    return NextResponse.json({ error: 'No OpenClaw config found' }, { status: 404 });
  }

  // Get models from OpenClaw CLI
  let models: Array<{
    provider: string;
    modelId: string;
    displayName: string;
    tier: string;
    available: boolean;
  }> = [];

  try {
    const { stdout } = await execAsync('openclaw models list --json 2>&1');
    const modelData = JSON.parse(stdout);

    if (modelData.models && Array.isArray(modelData.models)) {
      models = modelData.models
        .filter((m: any) => m.available)
        .map((m: any) => ({
          provider: getProvider(m.key),
          modelId: m.key,
          displayName: m.name,
          tier: getModelTier(m.name),
          available: true,
        }));
    }
  } catch (error) {
    console.error('Failed to get models from OpenClaw:', error);
    // Fallback to empty array - the UI will show no models available
  }

  // Get default model from config
  const defaultModel = config?.agents?.defaults?.model?.primary || config?.agents?.defaults?.model || '';

  // Get configured providers
  const profiles = config?.auth?.profiles || {};
  const configured = {
    anthropic: Object.keys(profiles).some(k => k.includes('anthropic')),
    openai: Object.keys(profiles).some(k => k.includes('openai')),
  };

  return NextResponse.json({
    models,
    defaultModel,
    configured,
  });
}
