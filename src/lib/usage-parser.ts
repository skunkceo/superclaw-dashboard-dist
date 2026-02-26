import fs from 'fs';
import path from 'path';

interface UsageData {
  input: number;
  output: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
}

interface MessageEntry {
  type: string;
  timestamp?: string;
  message?: {
    role?: string;
    usage?: UsageData;
    model?: string;
    timestamp?: string | number;
  };
  model?: string;
  usage?: UsageData;
}

interface AggregatedUsage {
  today: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
    byModel: Record<string, { input: number; output: number; total: number; cost: number }>;
  };
  thisWeek: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
    byModel: Record<string, { input: number; output: number; total: number; cost: number }>;
  };
  thisMonth: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
    byModel: Record<string, { input: number; output: number; total: number; cost: number }>;
  };
  allTime: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
    byModel: Record<string, { input: number; output: number; total: number; cost: number }>;
  };
}

function getTimeRanges() {
  const now = new Date();
  
  // Start of today (UTC)
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  
  // Start of this week (Monday)
  const dayOfWeek = now.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(weekStart.getUTCDate() - daysToMonday);
  
  // Start of this month
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  
  return { todayStart, weekStart, monthStart };
}

// Normalize model names to a canonical form for aggregation
function normalizeModelName(modelId: string): string {
  // Strip provider prefix
  let normalized = modelId.replace(/^(anthropic|openai)\//, '');
  
  // Map variants to canonical names (preserve point versions)
  const modelMap: Record<string, string> = {
    'claude-opus-4-20250514': 'claude-opus-4.0',
    'claude-opus-4-5-20250514': 'claude-opus-4.5',
    'claude-opus-4-6': 'claude-opus-4.6',
    'claude-sonnet-4-20250514': 'claude-sonnet-4.0',
    'claude-sonnet-4-5-20250514': 'claude-sonnet-4.5',
    'claude-sonnet-4-5': 'claude-sonnet-4.5',
    'claude-haiku-3-5-20241022': 'claude-haiku-3.5',
    'claude-haiku-4': 'claude-haiku-4.0',
  };
  
  return modelMap[normalized] || normalized;
}

export function parseSessionUsage(sessionsDir: string): AggregatedUsage {
  const result: AggregatedUsage = {
    today: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0, byModel: {} },
    thisWeek: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0, byModel: {} },
    thisMonth: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0, byModel: {} },
    allTime: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0, byModel: {} },
  };

  if (!fs.existsSync(sessionsDir)) {
    return result;
  }

  const { todayStart, weekStart, monthStart } = getTimeRanges();
  const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));

  for (const file of files) {
    const filePath = path.join(sessionsDir, file);
    let content: string;
    
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split('\n').filter(l => l.trim());
    let currentModel = 'unknown';
    
    for (const line of lines) {
      let entry: any;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }

      // Track model changes
      if (entry.type === 'model_change' && entry.modelId) {
        currentModel = entry.modelId;
        continue;
      }
      if (entry.type === 'custom' && entry.data?.modelId) {
        currentModel = entry.data.modelId;
        continue;
      }

      // Extract usage from message
      const usage = entry.message?.usage || entry.usage;
      if (!usage) continue;

      // Get model from message field if available, otherwise use tracked model
      const rawModel = entry.message?.model || currentModel;
      const model = normalizeModelName(rawModel);
      const rawTimestamp = entry.timestamp || entry.message?.timestamp;
      const timestamp = rawTimestamp ? String(rawTimestamp) : undefined;

      const input = usage.input || 0;
      const output = usage.output || 0;
      const cacheRead = usage.cacheRead || 0;
      const cacheWrite = usage.cacheWrite || 0;
      // ALWAYS calculate total as input + output (exclude cache reads/writes)
      const total = input + output;
      const cost = usage.cost?.total || 0;

      // Add to allTime
      result.allTime.inputTokens += input;
      result.allTime.outputTokens += output;
      result.allTime.totalTokens += total;
      result.allTime.cost += cost;

      if (!result.allTime.byModel[model]) {
        result.allTime.byModel[model] = { input: 0, output: 0, total: 0, cost: 0 };
      }
      result.allTime.byModel[model].input += input;
      result.allTime.byModel[model].output += output;
      result.allTime.byModel[model].total += total;
      result.allTime.byModel[model].cost += cost;

      // Check time ranges
      if (timestamp) {
        const msgDate = new Date(timestamp);
        
        if (msgDate >= monthStart) {
          result.thisMonth.inputTokens += input;
          result.thisMonth.outputTokens += output;
          result.thisMonth.totalTokens += total;
          result.thisMonth.cost += cost;

          if (!result.thisMonth.byModel[model]) {
            result.thisMonth.byModel[model] = { input: 0, output: 0, total: 0, cost: 0 };
          }
          result.thisMonth.byModel[model].input += input;
          result.thisMonth.byModel[model].output += output;
          result.thisMonth.byModel[model].total += total;
          result.thisMonth.byModel[model].cost += cost;
        }

        if (msgDate >= weekStart) {
          result.thisWeek.inputTokens += input;
          result.thisWeek.outputTokens += output;
          result.thisWeek.totalTokens += total;
          result.thisWeek.cost += cost;

          if (!result.thisWeek.byModel[model]) {
            result.thisWeek.byModel[model] = { input: 0, output: 0, total: 0, cost: 0 };
          }
          result.thisWeek.byModel[model].input += input;
          result.thisWeek.byModel[model].output += output;
          result.thisWeek.byModel[model].total += total;
          result.thisWeek.byModel[model].cost += cost;
        }

        if (msgDate >= todayStart) {
          result.today.inputTokens += input;
          result.today.outputTokens += output;
          result.today.totalTokens += total;
          result.today.cost += cost;

          if (!result.today.byModel[model]) {
            result.today.byModel[model] = { input: 0, output: 0, total: 0, cost: 0 };
          }
          result.today.byModel[model].input += input;
          result.today.byModel[model].output += output;
          result.today.byModel[model].total += total;
          result.today.byModel[model].cost += cost;
        }
      }
    }
  }

  return result;
}

// Get subscription info from config and Claude credentials
export function getSubscriptionInfo(configPath: string): { plan: string; provider: string; isSubscription: boolean } | null {
  // First check for Claude.ai OAuth credentials (Max subscription)
  const claudeCredsPaths = [
    '/root/.claude/.credentials.json',
    path.join(process.env.HOME || '', '.claude/.credentials.json'),
  ];
  
  for (const credPath of claudeCredsPaths) {
    if (fs.existsSync(credPath)) {
      try {
        const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        if (creds.claudeAiOauth) {
          return {
            provider: 'Anthropic',
            plan: 'Claude Max (OAuth)',
            isSubscription: true, // Flat subscription, not per-token billing
          };
        }
      } catch {
        // ignore
      }
    }
  }
  
  if (!fs.existsSync(configPath)) return null;
  
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const profiles = config?.auth?.profiles || {};
    
    // Find the primary provider
    for (const [key, profile] of Object.entries(profiles)) {
      const p = profile as { provider?: string; mode?: string };
      if (p.provider) {
        return {
          provider: p.provider,
          plan: p.mode === 'token' ? 'API Key' : 'OAuth',
          isSubscription: false,
        };
      }
    }
  } catch {
    return null;
  }
  
  return null;
}
