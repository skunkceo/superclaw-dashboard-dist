import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import { getCurrentUser, hasRole } from '@/lib/auth';
import { getConfigPath } from '@/lib/workspace';

const CONFIG_PATH = getConfigPath();

interface MemorySearchConfig {
  enabled?: boolean;
  provider?: 'openai' | 'gemini' | 'voyage' | 'local';
  remote?: {
    apiKey?: string;
  };
  model?: string;
  sync?: {
    onSessionStart?: boolean;
    watch?: boolean;
  };
}

interface ConfigStructure {
  agents?: {
    defaults?: {
      memorySearch?: MemorySearchConfig;
    };
  };
  gateway?: {
    auth?: {
      token?: string;
    };
  };
}

function maskApiKey(apiKey: string | undefined): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 4) return apiKey;
  return `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 4)}`;
}

function isConfigured(config: MemorySearchConfig | undefined): boolean {
  if (!config) return false;
  if (config.provider === 'local') return config.enabled === true;
  return !!(config.enabled && config.provider && config.remote?.apiKey && config.model);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (!hasRole(user.role, 'view')) {
    return NextResponse.json({ error: 'View access required' }, { status: 403 });
  }

  try {
    const configContent = await readFile(CONFIG_PATH, 'utf-8');
    const config: ConfigStructure = JSON.parse(configContent);
    const memorySearch = config.agents?.defaults?.memorySearch;

    return NextResponse.json({
      enabled: memorySearch?.enabled ?? false,
      provider: memorySearch?.provider ?? null,
      apiKey: maskApiKey(memorySearch?.remote?.apiKey),
      model: memorySearch?.model ?? null,
      syncOnStart: memorySearch?.sync?.onSessionStart ?? false,
      syncWatch: memorySearch?.sync?.watch ?? false,
      configured: isConfigured(memorySearch)
    });
  } catch (error) {
    console.error('Error reading embeddings config:', error);
    return NextResponse.json(
      { error: 'Failed to read embeddings config' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (!hasRole(user.role, 'admin')) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { provider, apiKey, model, enabled, syncOnStart, syncWatch } = body;

    // Validate provider
    if (!['openai', 'gemini', 'voyage', 'local'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    // Read existing config
    const configContent = await readFile(CONFIG_PATH, 'utf-8');
    const config: ConfigStructure = JSON.parse(configContent);

    // Ensure structure exists
    if (!config.agents) config.agents = {};
    if (!config.agents.defaults) config.agents.defaults = {};

    // Build memorySearch config
    const memorySearchConfig: MemorySearchConfig = {
      enabled: enabled === true,
      provider: provider as 'openai' | 'gemini' | 'voyage' | 'local',
      sync: {
        onSessionStart: syncOnStart === true,
        watch: syncWatch === true
      }
    };

    // Add model
    if (model) {
      memorySearchConfig.model = model;
    }

    // Add API key for non-local providers
    if (provider !== 'local' && apiKey) {
      memorySearchConfig.remote = {
        apiKey: apiKey
      };
    }

    // Merge into config
    config.agents.defaults.memorySearch = memorySearchConfig;

    // Write config back
    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');

    // Try to restart gateway
    let restartRequired = false;
    const gatewayToken = config.gateway?.auth?.token;
    
    if (gatewayToken) {
      try {
        // Try restart endpoint
        const restartRes = await fetch('http://127.0.0.1:18789/api/restart', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${gatewayToken}`
          }
        });
        
        if (!restartRes.ok) {
          // Try reload endpoint as fallback
          const reloadRes = await fetch('http://127.0.0.1:18789/api/reload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${gatewayToken}`
            }
          });
          
          if (!reloadRes.ok) {
            restartRequired = true;
          }
        }
      } catch {
        // Gateway not responding, manual restart needed
        restartRequired = true;
      }
    } else {
      restartRequired = true;
    }

    return NextResponse.json({
      success: true,
      restartRequired
    });
  } catch (error) {
    console.error('Error saving embeddings config:', error);
    return NextResponse.json(
      { error: 'Failed to save embeddings config' },
      { status: 500 }
    );
  }
}
