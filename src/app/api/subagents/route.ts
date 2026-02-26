import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

export const dynamic = 'force-dynamic';

interface SubAgentSession {
  sessionKey: string;
  label: string;
  status: 'active' | 'idle' | 'done';
  model: string;
  lastMessage: string | null;
  duration: string;
  messageCount: number;
  updatedAt: number;
}

// Helper to format duration
function formatDuration(updatedAt: number): string {
  const diff = Date.now() - updatedAt;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  
  if (mins < 1) return 'just started';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

// Helper to truncate message content
function truncateMessage(content: string, maxLength = 100): string {
  if (typeof content !== 'string') {
    content = JSON.stringify(content);
  }
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength - 3) + '...';
}

export async function GET() {
  try {
    // Read synced sessions data (updated by root cron)
    const sessionsJsonPath = '/tmp/openclaw-sessions.json';
    
    if (!existsSync(sessionsJsonPath)) {
      console.error('Synced sessions file not found');
      return NextResponse.json({ sessions: [] });
    }

    const sessionsData = JSON.parse(readFileSync(sessionsJsonPath, 'utf8'));
    const subAgents: SubAgentSession[] = [];

    const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days — anything older is stale history

    // Filter for real sub-agent sessions only (:subagent: or :isolated: in key)
    for (const [sessionKey, sessionInfo] of Object.entries(sessionsData)) {
      const session = sessionInfo as any;
      
      // Only match actual sub-agent session patterns — not Slack channels, DMs, threads, or cron
      const isSubAgent = 
        sessionKey.includes(':subagent:') || 
        sessionKey.includes(':isolated:');
      
      if (!isSubAgent || !session.updatedAt) continue;

      // Skip sessions older than 3 days
      const diff = Date.now() - session.updatedAt;
      if (diff > MAX_AGE_MS) continue;

      // Skip orphaned sessions — done with 0 messages means the spawn failed or never ran
      const msgCount = session.messageCount || 0;
      if (msgCount === 0 && diff > 60 * 60 * 1000) continue; // 0 msgs + older than 1h = dead spawn

      // Extract label — prefer explicit label field, then displayName, then parse key
      let label: string = session.label || session.displayName || '';
      if (!label) {
        // Fallback: parse session key but skip UUID segments
        const parts = sessionKey.split(':');
        const nonUuid = parts.filter((p: string) => 
          !/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(p) && 
          p !== 'main' && p !== 'agent' && p !== 'subagent' && p !== 'isolated'
        );
        label = nonUuid[nonUuid.length - 1] || sessionKey;
      }
      
      // Parse last message
      let lastMessage: string | null = null;
      if (session.lastMessage) {
        lastMessage = truncateMessage(session.lastMessage);
      }
      
      // Determine status based on last activity
      // active  = updated in last 5 min (still running)
      // idle    = updated 5–60 min ago (recently finished)
      // done    = updated >60 min ago or explicitly marked done
      let status: 'active' | 'idle' | 'done' = 'done';
      if (diff < 5 * 60 * 1000) {
        status = 'active';
      } else if (diff < 60 * 60 * 1000) {
        status = 'idle';
      } else if (session.status === 'active') {
        // Gateway still considers it active despite being old — treat as idle
        status = 'idle';
      }
      
      subAgents.push({
        sessionKey,
        label,
        status,
        model: session.model || session.lastModel || 'claude-sonnet-4',
        lastMessage,
        duration: formatDuration(session.updatedAt),
        messageCount: session.messageCount || 0,
        updatedAt: session.updatedAt
      });
    }

    // Sort by most recent activity
    subAgents.sort((a, b) => b.updatedAt - a.updatedAt);

    return NextResponse.json({ sessions: subAgents });

  } catch (error) {
    console.error('Error fetching sub-agents:', error);
    return NextResponse.json({ sessions: [], error: 'Failed to fetch sessions' });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { task, label, model } = body;

    if (!task || !label) {
      return NextResponse.json(
        { error: 'Missing required fields: task, label' },
        { status: 400 }
      );
    }

    // Spawn sub-agent using OpenClaw CLI
    const modelArg = model || 'claude-sonnet-4-20250514';
    const cmd = `openclaw sessions spawn --label "${label}" --model "${modelArg}" --task "${task.replace(/"/g, '\\"')}"`;
    
    try {
      const result = execSync(cmd, {
        encoding: 'utf-8',
        timeout: 10000
      });

      return NextResponse.json({
        success: true,
        message: 'Sub-agent spawned successfully',
        output: result.trim()
      });
    } catch (spawnError: any) {
      console.error('Failed to spawn sub-agent:', spawnError);
      return NextResponse.json(
        { error: 'Failed to spawn sub-agent', details: spawnError.message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error spawning sub-agent:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionKey = searchParams.get('sessionKey');

    if (!sessionKey) {
      return NextResponse.json(
        { error: 'Missing sessionKey parameter' },
        { status: 400 }
      );
    }

    // Kill session using OpenClaw CLI
    const cmd = `openclaw sessions kill "${sessionKey}"`;
    
    try {
      const result = execSync(cmd, {
        encoding: 'utf-8',
        timeout: 5000
      });

      return NextResponse.json({
        success: true,
        message: 'Session killed successfully',
        output: result.trim()
      });
    } catch (killError: any) {
      console.error('Failed to kill session:', killError);
      return NextResponse.json(
        { error: 'Failed to kill session', details: killError.message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error killing session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
