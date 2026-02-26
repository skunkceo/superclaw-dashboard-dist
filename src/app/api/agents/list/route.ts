import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
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
    
    try {
      const sessionsRaw = execSync('openclaw sessions list --json', { 
        encoding: 'utf-8',
        timeout: 5000 
      });
      
      const sessionsRawData = JSON.parse(sessionsRaw);
      // OpenClaw returns { path, count, sessions: [...] } — unwrap the array
      const sessionsArray: Array<Record<string, unknown>> = Array.isArray(sessionsRawData)
        ? sessionsRawData
        : (sessionsRawData.sessions || []);
      
      const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

      // Filter for agent sessions matching workspace labels
      for (const session of sessionsArray) {
        const key = (session.key as string) || '';
        const ageMs = (session.ageMs as number) || 0;

        // Only match sub-agent or isolated sessions
        if (!key.includes(':subagent:') && !key.includes(':isolated:')) continue;

        // Skip stale sessions
        if (ageMs > MAX_AGE_MS) continue;

        // Extract label from session key: agent:main:subagent:LABEL
        const keyParts = key.split(':');
        const extractedLabel = keyParts.length > 3 ? keyParts.slice(3).join(':') : key;

        // Check if this matches an agent workspace
        const workspace = workspaces.find(w => w.label === extractedLabel);
        if (workspace) {
          const diff = ageMs;
          let status: 'active' | 'idle' | 'waiting' = 'waiting';
          if (diff < 5 * 60 * 1000) status = 'active';
          else if (diff < 60 * 60 * 1000) status = 'idle';

          sessions.push({
            label: workspace.label,
            sessionKey: key,
            status,
            lastActive: formatAge(diff),
            messageCount: (session.messageCount as number) || 0,
            model: (session.model as string) || 'claude-sonnet-4-6'
          });
        }
      }
    } catch (e) {
      // OpenClaw might not be running or sessions command failed
      console.error('Failed to get sessions from OpenClaw:', e);
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
