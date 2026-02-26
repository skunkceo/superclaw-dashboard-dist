import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { getCurrentUser } from '@/lib/auth';
import { getSessionsDirs } from '@/lib/workspace';

function getSessionsDir(): string {
  const paths = [
    ...getSessionsDirs(),
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return paths[0];
}

const slackChannels: Record<string, string> = {
  'C0ACV8Y8AHW': '#dev',
  'C0ABZ068W22': '#dailies',
  'C0AC4JZ0M44': '#marketing',
  'C0ABKHH98VD': '#product',
  'C0AC11G4N4A': '#support',
  'C0AC06RAWG2': '#social',
  'C0ADVJB9ETA': '#projects',
  'C0ACBTVCWAY': '#progress',
  'D0AC0T1M4KU': 'DM',
  'C0AFE1STJSV': '#superclaw',
};

function getDisplayName(key: string): string {
  if (key.includes('slack:channel:')) {
    const parts = key.split(':');
    const channelIdx = parts.indexOf('channel');
    const channelId = channelIdx >= 0 ? parts[channelIdx + 1] : '';
    const channelName = slackChannels[channelId.toUpperCase()] || channelId;
    return parts.includes('thread') ? `Thread in ${channelName}` : channelName;
  }
  if (key.includes('subagent:')) return 'Sub-agent';
  if (key === 'agent:main' || key.includes(':main:')) return 'Main Session';
  return key.split(':').pop() || key;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId } = await params;
  const sessionsDir = getSessionsDir();

  // Find the session file - could be exact ID or topic file
  const files = existsSync(sessionsDir)
    ? readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl') && f.includes(sessionId))
    : [];

  if (files.length === 0) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const filePath = join(sessionsDir, files[0]);
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return NextResponse.json({ error: 'Cannot read session' }, { status: 500 });
  }

  const lines = content.split('\n').filter(l => l.trim());
  
  // Also look up session key from sessions.json
  let sessionKey = '';
  let updatedAt = 0;
  try {
    const sessionsJson = JSON.parse(readFileSync(join(sessionsDir, 'sessions.json'), 'utf8'));
    for (const [key, val] of Object.entries(sessionsJson)) {
      const v = val as any;
      if (v.sessionId === sessionId) {
        sessionKey = key;
        updatedAt = v.updatedAt || 0;
        break;
      }
    }
  } catch {}

  let model = 'unknown';
  let thinkingLevel = '';
  const messages: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: string;
    type: string;
    model?: string;
    usage?: any;
    toolCalls?: any[];
  }> = [];

  for (const line of lines) {
    let entry: any;
    try { entry = JSON.parse(line); } catch { continue; }

    if (entry.type === 'model_change') {
      model = entry.modelId || model;
    } else if (entry.type === 'thinking_level_change') {
      thinkingLevel = entry.thinkingLevel || thinkingLevel;
    } else if (entry.type === 'message' && entry.message) {
      const msg = entry.message;
      let text = '';
      
      if (typeof msg.content === 'string') {
        text = msg.content;
      } else if (Array.isArray(msg.content)) {
        text = msg.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text)
          .join('\n');
      }

      // Extract tool use from content
      const toolCalls = Array.isArray(msg.content)
        ? msg.content
            .filter((c: any) => c.type === 'tool_use')
            .map((c: any) => ({ name: c.name, id: c.id }))
        : [];

      // Extract tool results
      const toolResults = Array.isArray(msg.content)
        ? msg.content
            .filter((c: any) => c.type === 'tool_result')
            .map((c: any) => ({ tool_use_id: c.tool_use_id, content: typeof c.content === 'string' ? c.content.substring(0, 200) : '' }))
        : [];

      messages.push({
        id: entry.id || '',
        role: msg.role || 'unknown',
        content: text,
        timestamp: entry.timestamp || '',
        type: toolCalls.length > 0 ? 'tool_use' : toolResults.length > 0 ? 'tool_result' : 'message',
        model: model,
        usage: msg.usage ? {
          input: msg.usage.input || 0,
          output: msg.usage.output || 0,
          total: msg.usage.totalTokens || (msg.usage.input || 0) + (msg.usage.output || 0),
          cost: msg.usage.cost?.total || 0,
        } : undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : toolResults.length > 0 ? toolResults : undefined,
      });
    }
  }

  const now = Date.now();
  const status = updatedAt
    ? (now - updatedAt < 5 * 60 * 1000 ? 'active' : now - updatedAt < 60 * 60 * 1000 ? 'idle' : 'done')
    : 'unknown';

  return NextResponse.json({
    sessionId,
    sessionKey,
    displayName: getDisplayName(sessionKey),
    model: model.replace('anthropic/', ''),
    thinkingLevel,
    status,
    updatedAt,
    messageCount: messages.length,
    messages,
  });
}
