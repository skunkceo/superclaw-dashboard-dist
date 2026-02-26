import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawWorkspace, getConfigPaths } from '@/lib/workspace';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import path from 'path';

interface AgentDefinition {
  label: string;
  name?: string;
  emoji?: string;
}

interface ScaffoldResult {
  label: string;
  created: string[];
}

interface GatewayConfig {
  gateway?: {
    port?: number;
  };
}

export async function POST(req: NextRequest) {
  try {
    const workspace = getOpenClawWorkspace();
    const teamsJsonPath = path.join(workspace, 'agents', 'teams.json');

    // Read agent definitions from teams.json
    let agentLabels: string[] = [];
    if (existsSync(teamsJsonPath)) {
      try {
        const teamsData = JSON.parse(readFileSync(teamsJsonPath, 'utf-8'));
        // Extract all agent labels from teams
        if (teamsData.teams && Array.isArray(teamsData.teams)) {
          teamsData.teams.forEach((team: any) => {
            if (team.lead) agentLabels.push(team.lead);
            if (team.members && Array.isArray(team.members)) {
              agentLabels.push(...team.members);
            }
          });
        }
      } catch (err) {
        console.error('Failed to parse teams.json:', err);
      }
    }

    // Remove duplicates
    agentLabels = [...new Set(agentLabels)];

    const scaffolded: ScaffoldResult[] = [];
    const errors: string[] = [];

    // Scaffold each agent
    for (const label of agentLabels) {
      const created: string[] = [];
      const agentDir = path.join(workspace, 'agents', label);

      try {
        // Create agent directory
        if (!existsSync(agentDir)) {
          mkdirSync(agentDir, { recursive: true });
          created.push('agents/' + label + '/');
        }

        // Create AGENTS.md if missing
        const agentsMdPath = path.join(agentDir, 'AGENTS.md');
        if (!existsSync(agentsMdPath)) {
          const agentsMdContent = `# ${label} - Agent Identity

## Role
[Define your role and responsibilities here]

## Responsibilities
- [List key responsibilities]
- [Add more as needed]

## Skills
- [List relevant skills]
- [Tools you use]

## Protocols
- [Document any specific workflows]
- [Communication protocols]
`;
          writeFileSync(agentsMdPath, agentsMdContent, 'utf-8');
          created.push('AGENTS.md');
        }

        // Create MEMORY.md if missing
        const memoryMdPath = path.join(agentDir, 'MEMORY.md');
        if (!existsSync(memoryMdPath)) {
          const memoryMdContent = `# ${label} - Long-Term Memory

## Key Context
[Important background information and context]

## Work Done
[Record of completed work and achievements]

## Lessons Learned
[Document mistakes, learnings, and best practices]

## Active State
[Current state, ongoing tasks, next steps]
`;
          writeFileSync(memoryMdPath, memoryMdContent, 'utf-8');
          created.push('MEMORY.md');
        }

        // Create memory/ subdirectory
        const memoryDir = path.join(agentDir, 'memory');
        if (!existsSync(memoryDir)) {
          mkdirSync(memoryDir, { recursive: true });
          created.push('memory/');
        }

        // Create today's daily file
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const dailyPath = path.join(memoryDir, `${today}.md`);
        if (!existsSync(dailyPath)) {
          const dailyContent = `# ${today}\n\n`;
          writeFileSync(dailyPath, dailyContent, 'utf-8');
          created.push(`memory/${today}.md`);
        }

        if (created.length > 0) {
          scaffolded.push({ label, created });
        }
      } catch (err) {
        errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Check gateway connection status
    let gatewayConnected = false;
    let gatewayPort = 3131; // default

    // Try to read gateway config
    const configPaths = getConfigPaths();
    for (const configPath of configPaths) {
      if (existsSync(configPath)) {
        try {
          const configData: GatewayConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
          if (configData.gateway?.port) {
            gatewayPort = configData.gateway.port;
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    // Try to ping the gateway
    try {
      const response = await fetch(`http://127.0.0.1:${gatewayPort}/status`, {
        signal: AbortSignal.timeout(2000),
      });
      gatewayConnected = response.ok;
    } catch {
      gatewayConnected = false;
    }

    // Write a flag file so the status endpoint knows setup has been run
    const flagPath = path.join(workspace, '.setup_complete');
    try {
      writeFileSync(flagPath, new Date().toISOString(), 'utf-8');
    } catch {
      // Non-fatal
    }

    return NextResponse.json({
      success: true,
      scaffolded,
      errors,
      gatewayConnected,
      workspace,
    });
  } catch (error) {
    console.error('Scaffold error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
