import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getActivityLog } from '@/lib/db';

export const dynamic = 'force-dynamic';

const OPENCLAW_WORKSPACE = process.env.OPENCLAW_WORKSPACE || '/root/.openclaw/workspace';

interface ActiveAgentState {
  sessionLabel: string;
  task?: string;
  branch?: string;
  repo?: string;
  linearId?: string;
  spawned: number;
}

interface WorkLoopState {
  updated: string;
  active_agents: ActiveAgentState[];
}

interface CronSession {
  sessionKey: string;
  label: string;
  updatedAt: number;
  status: 'running' | 'recent';
  ageMinutes: number;
}

function readWorkLoopState(): WorkLoopState | null {
  const workLoopPath = path.join(OPENCLAW_WORKSPACE, 'memory/work-loop-state.json');
  try {
    if (!fs.existsSync(workLoopPath)) return null;
    const raw = fs.readFileSync(workLoopPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readActiveSubagents(): ActiveAgentState[] {
  // Read recent subagent sessions from the sessions cache file.
  // This surfaces agents spawned directly (not via work-loop) so they
  // show as active on the dashboard immediately after being spawned.
  const sessionsPath = '/tmp/openclaw-sessions.json';
  try {
    if (!fs.existsSync(sessionsPath)) return [];
    const raw = fs.readFileSync(sessionsPath, 'utf-8');
    const sessions = JSON.parse(raw);
    const now = Date.now();
    const ACTIVE_WINDOW_MS = 45 * 60 * 1000; // 45 minutes

    const results: ActiveAgentState[] = [];
    for (const [key, data] of Object.entries(sessions)) {
      if (!key.includes(':subagent:') && !key.includes(':isolated:')) continue;
      const s = data as { updatedAt?: number; label?: string };
      const age = now - (s.updatedAt || 0);
      if (age > ACTIVE_WINDOW_MS) continue;
      const label = s.label || '';
      if (!label || label === 'main') continue;
      results.push({
        sessionLabel: label,
        spawned: s.updatedAt || now,
      });
    }
    return results;
  } catch {
    return [];
  }
}

function readRecentCronActivity(): CronSession[] {
  const sessionsPath = '/tmp/openclaw-sessions.json';
  try {
    if (!fs.existsSync(sessionsPath)) return [];
    const raw = fs.readFileSync(sessionsPath, 'utf-8');
    const sessions = JSON.parse(raw);
    const now = Date.now();
    const fifteenMinutesAgo = now - (15 * 60 * 1000);
    
    const cronSessions: CronSession[] = [];
    
    for (const [key, data] of Object.entries(sessions)) {
      if (key.includes(':cron:') && key.includes(':run:') && typeof data === 'object' && data !== null) {
        const session = data as { updatedAt?: number; label?: string };
        const updatedAt = session.updatedAt || 0;
        
        if (updatedAt > fifteenMinutesAgo) {
          const ageMs = now - updatedAt;
          const ageMinutes = Math.floor(ageMs / 60000);
          const status = ageMs < (5 * 60 * 1000) ? 'running' : 'recent';
          
          cronSessions.push({
            sessionKey: key,
            label: session.label || key.split(':').pop() || 'Cron',
            updatedAt,
            status,
            ageMinutes,
          });
        }
      }
    }
    
    return cronSessions.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    console.error('Error reading cron sessions:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      const sendUpdate = () => {
        if (isClosed) return;

        try {
          const workLoopState = readWorkLoopState();
          const workLoopAgents = workLoopState?.active_agents || [];
          const sessionAgents = readActiveSubagents();
          // Merge: session agents take precedence; work-loop agents add task/branch context
          const merged = new Map<string, ActiveAgentState>();
          for (const a of sessionAgents) merged.set(a.sessionLabel, a);
          for (const a of workLoopAgents) {
            if (merged.has(a.sessionLabel)) {
              // Enrich with task context from work-loop
              const existing = merged.get(a.sessionLabel)!;
              merged.set(a.sessionLabel, { ...existing, task: a.task, branch: a.branch, repo: a.repo, linearId: a.linearId });
            } else {
              merged.set(a.sessionLabel, a);
            }
          }
          const activeAgents = Array.from(merged.values());

          // Check if the main Clawd session is active (updated in last 5 min)
          const mainSessionPath = path.join(OPENCLAW_WORKSPACE, 'memory/main-session-heartbeat.json');
          let mainSessionActive = false;
          try {
            if (fs.existsSync(mainSessionPath)) {
              const ms = JSON.parse(fs.readFileSync(mainSessionPath, 'utf-8'));
              if (ms.updatedAt && (Date.now() - ms.updatedAt) < 5 * 60 * 1000) {
                mainSessionActive = true;
              }
            }
          } catch {}
          const allActiveAgents = mainSessionActive
            ? [{ sessionLabel: 'clawd', task: 'Responding to Sam', branch: null, repo: null, linearId: null, spawned: Date.now() }, ...activeAgents]
            : activeAgents;

          const recentActivity = getActivityLog({ limit: 8 });
          const recentCronActivity = readRecentCronActivity();

          const data = {
            timestamp: Date.now(),
            activeAgents: allActiveAgents.map(a => ({
              label: a.sessionLabel,
              task: a.task,
              branch: a.branch,
              repo: a.repo,
              linearId: a.linearId,
              spawned: a.spawned,
            })),
            recentActivity: recentActivity.map(entry => ({
              id: entry.id,
              timestamp: entry.timestamp,
              agent_label: entry.agent_label,
              action_type: entry.action_type,
              summary: entry.summary,
              links: entry.links,
            })),
            recentCronActivity: recentCronActivity,
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (error) {
          console.error('Error in SSE stream:', error);
        }
      };

      sendUpdate();
      const interval = setInterval(sendUpdate, 5000);

      request.signal.addEventListener('abort', () => {
        isClosed = true;
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
