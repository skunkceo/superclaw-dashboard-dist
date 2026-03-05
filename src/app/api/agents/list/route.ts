import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getOpenClawWorkspace } from '@/lib/workspace';
import { getActivityLog } from '@/lib/db';

export const dynamic = 'force-dynamic';

function formatAge(ms: number): string {
  if (ms < 60 * 1000) return 'just now';
  if (ms < 60 * 60 * 1000) return `${Math.round(ms / 60000)}m ago`;
  if (ms < 24 * 60 * 60 * 1000) return `${Math.round(ms / 3600000)}h ago`;
  return `${Math.round(ms / 86400000)}d ago`;
}

interface AgentWorkspace {
  label: string;
  name: string;
  emoji: string;
  workspacePath: string;
  hasMemory: boolean;
  memorySize: number;
}

interface AgentSession {
  label: string;
  sessionKey: string;
  status: 'active' | 'idle' | 'waiting';
  lastActive: string;
  messageCount: number;
  model: string;
  task?: string;
  branch?: string;
  repo?: string;
  linearId?: string;
}

interface Team {
  id: string;
  name: string;
  lead: string;
  members: string[];
}

export async function GET() {
  try {
    const openclawWorkspace = getOpenClawWorkspace();
    const agentsDir = path.join(openclawWorkspace, 'agents');

    // Read teams configuration
    let teams: Team[] = [];
    const teamsPath = path.join(agentsDir, 'teams.json');
    if (fs.existsSync(teamsPath)) {
      try {
        const teamsData = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));
        teams = teamsData.teams || [];
      } catch (e) {
        console.error('Failed to parse teams.json:', e);
      }
    }

    // Get configured agent workspaces
    const workspaces: AgentWorkspace[] = [];
    
    if (fs.existsSync(agentsDir)) {
      const agentDirs = fs.readdirSync(agentsDir).filter(name => {
        const fullPath = path.join(agentsDir, name);
        return fs.statSync(fullPath).isDirectory() && name !== 'shared';
      });

      for (const label of agentDirs) {
        const agentPath = path.join(agentsDir, label);
        const identityPath = path.join(agentPath, 'IDENTITY.md');
        const memoryPath = path.join(agentPath, 'MEMORY.md');
        
        let name = label;
        let emoji = '🤖';
        
        // Read identity if exists
        if (fs.existsSync(identityPath)) {
          const identity = fs.readFileSync(identityPath, 'utf-8');
          const nameMatch = identity.match(/\*\*Name:\*\*\s*(.+)/);
          if (nameMatch) name = nameMatch[1].trim();
          const emojiMatch = identity.match(/\*\*Emoji:\*\*\s*(.+)/);
          if (emojiMatch) emoji = emojiMatch[1].trim();
        }
        
        let memorySize = 0;
        if (fs.existsSync(memoryPath)) {
          const stats = fs.statSync(memoryPath);
          memorySize = stats.size;
        }
        
        workspaces.push({
          label,
          name,
          emoji,
          workspacePath: agentPath,
          hasMemory: fs.existsSync(memoryPath),
          memorySize
        });
      }
    }

    // Get active agent sessions from OpenClaw
    const sessions: AgentSession[] = [];

    // Read work-loop-state.json as secondary source of truth for active agents
    const workLoopPath = path.join(openclawWorkspace, 'memory', 'work-loop-state.json');
    const activeFromWorkLoop: Map<string, { task?: string; branch?: string; repo?: string; linearId?: string }> = new Map();

    if (fs.existsSync(workLoopPath)) {
      try {
        const workLoopData = JSON.parse(fs.readFileSync(workLoopPath, 'utf-8'));
        const activeSessions = workLoopData.active_agents || [];
        for (const s of activeSessions) {
          if (s.sessionLabel) {
            activeFromWorkLoop.set(s.sessionLabel, {
              task: s.task,
              branch: s.branch,
              repo: s.repo,
              linearId: s.linearId
            });
          }
        }
      } catch (e) {
        console.error('Failed to read work-loop-state.json:', e);
      }
    }
    
    try {
      // Read from synced sessions file (updated every minute by cron) — more reliable than CLI
      // The CLI binary path isn't always on PATH in the Next.js server process
      const sessionsJsonPath = '/tmp/openclaw-sessions.json';
      const sessionsRawData: Record<string, Record<string, unknown>> = fs.existsSync(sessionsJsonPath)
        ? JSON.parse(fs.readFileSync(sessionsJsonPath, 'utf-8'))
        : {};

      const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

      // Filter for agent sessions matching workspace labels
      for (const [key, session] of Object.entries(sessionsRawData)) {
        // Only match sub-agent or isolated sessions
        if (!key.includes(':subagent:') && !key.includes(':isolated:')) continue;

        const updatedAt = (session.updatedAt as number) || 0;
        const ageMs = updatedAt ? Date.now() - updatedAt : Infinity;

        // Skip stale sessions
        if (ageMs > MAX_AGE_MS) continue;

        // Use session.label field directly — session key format is agent:main:subagent:<UUID>
        // so extracting from the key just gives a UUID, not the human-readable label
        const resolvedLabel = (session.label as string) || '';
        if (!resolvedLabel) continue;

        // Check if this matches an agent workspace
        const workspace = workspaces.find(w => w.label === resolvedLabel);
        if (workspace) {
          const diff = ageMs;
          let status: 'active' | 'idle' | 'waiting' = 'waiting';
          // active = updated in last 45 min (agents on long coding tasks may be silent for 30+ min)
          if (diff < 45 * 60 * 1000) status = 'active';
          else if (diff < 60 * 60 * 1000) status = 'idle';

          // Get task details from work-loop-state if available
          const workLoopData = activeFromWorkLoop.get(workspace.label);
          sessions.push({
            label: workspace.label,
            sessionKey: key,
            status,
            lastActive: formatAge(diff),
            messageCount: (session.messageCount as number) || 0,
            model: (session.modelOverride as string) || (session.model as string) || 'claude-sonnet-4-6',
            task: workLoopData?.task,
            branch: workLoopData?.branch,
            repo: workLoopData?.repo,
            linearId: workLoopData?.linearId,
          });
        }
      }
    } catch (e) {
      // OpenClaw might not be running or sessions command failed
      console.error('Failed to get sessions from OpenClaw:', e);
    }

    // Supplement sessions using work-loop-state.json as immediate source of truth.
    // This ensures agents appear the moment they are spawned (agent-state.sh start writes
    // immediately) rather than waiting up to 60s for the sessions.json cron sync.
    // Per-agent staleness guard: ignore entries older than 24h (phantom cleanup).
    const MAX_AGENT_AGE_MS = 24 * 60 * 60 * 1000;

    for (const label of activeFromWorkLoop.keys()) {
      const existing = sessions.find(s => s.label === label);
      const workLoopExtra = activeFromWorkLoop.get(label) as any;

      // Staleness check per-agent using startedAt (not file-level updated timestamp)
      const startedAt = workLoopExtra?.startedAt ? new Date(workLoopExtra.startedAt).getTime() : Date.now();
      const agentAge = Date.now() - startedAt;
      const agentStale = agentAge > MAX_AGENT_AGE_MS;

      if (existing) {
        // Enrich with task context from work-loop-state
        existing.task = existing.task || workLoopExtra?.task;
        existing.branch = existing.branch || workLoopExtra?.branch;
        existing.repo = existing.repo || workLoopExtra?.repo;
        existing.linearId = existing.linearId || workLoopExtra?.linearId;
      } else if (!agentStale) {
        // Agent is in work-loop-state but not yet in sessions.json (cron lag up to 60s).
        // Create a synthetic active entry so it shows immediately on spawn.
        const workspace = workspaces.find(w => w.label === label);
        if (workspace) {
          const lastActiveSince = agentAge < 60000 ? 'just now' : formatAge(agentAge);
          sessions.push({
            label,
            sessionKey: `synthetic:${label}`,
            status: 'active',
            lastActive: lastActiveSince,
            messageCount: 0,
            model: 'claude-sonnet-4-6',
            task: workLoopExtra?.task,
            branch: workLoopExtra?.branch,
            repo: workLoopExtra?.repo,
            linearId: workLoopExtra?.linearId,
          });
        }
      }
    }

    // Transform workspaces into agents list
    const agents = workspaces.map(w => {
      
      // Get the most recent activity for this agent
      const recentActivity = getActivityLog({ agent_label: w.label, limit: 1 });
      const lastActivity = recentActivity[0] || null;
      
      // Extract description from AGENTS.md if exists
      let description = 'AI agent';
      const agentsPath = path.join(w.workspacePath, 'AGENTS.md');
      if (fs.existsSync(agentsPath)) {
        const agentsContent = fs.readFileSync(agentsPath, 'utf-8');
        
        // Try to find "Primary Focus" line (better description)
        const focusMatch = agentsContent.match(/\*\*Primary Focus:\*\*\s*(.+)/);
        if (focusMatch) {
          // Remove emoji from description
          description = focusMatch[1].trim().replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim().substring(0, 150);
        } else {
          // Fall back to first paragraph after headers, but skip Identity section
          const lines = agentsContent.split('\n');
          let inIdentitySection = false;
          
          for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip empty lines and headers
            if (!trimmed || trimmed.startsWith('#')) {
              // Check if this is the Identity section header
              if (trimmed.toLowerCase().includes('## identity')) {
                inIdentitySection = true;
              } else if (trimmed.startsWith('##')) {
                inIdentitySection = false;
              }
              continue;
            }
            
            // Skip lines in Identity section
            if (inIdentitySection) continue;
            
            // Skip markdown bullets/lists
            if (trimmed.startsWith('-') || trimmed.startsWith('*')) continue;
            
            // Found a good description line - remove emoji
            description = trimmed.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim().substring(0, 150);
            break;
          }
        }
      }
      
      return {
        label: w.label,
        name: w.name,
        emoji: w.emoji,
        description,
        hasMemory: w.hasMemory,
        memorySize: w.memorySize,
        lastActivity
      };
    });

    return NextResponse.json({
      agents,
      workspaces,
      sessions,
      teams,
      agentsDir
    });

  } catch (error) {
    console.error('Error listing agents:', error);
    return NextResponse.json(
      { error: 'Failed to list agents' },
      { status: 500 }
    );
  }
}
