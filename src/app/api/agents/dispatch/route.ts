import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getCurrentUser } from '@/lib/auth';
import { getOpenClawWorkspace } from '@/lib/workspace';
import { getConfigPaths, getCredentialPath } from '@/lib/workspace';
import { updateLinearIssueState, getStateIdByType } from '@/lib/linear';

const LINEAR_API_URL = 'https://api.linear.app/graphql';
const LINEAR_AI_TEAM_ID = '097e59de-e354-4f3c-b8b2-02a09dd1d873';

function getLinearApiKey(): string {
  const credPaths = [
    getCredentialPath('linear-api.json'),
    join(process.env.HOME || '', '.openclaw/workspace/credentials/linear-api.json'),
  ];
  for (const p of credPaths) {
    if (existsSync(p)) {
      try {
        const creds = JSON.parse(readFileSync(p, 'utf-8'));
        if (creds.api_key) return creds.api_key;
      } catch { continue; }
    }
  }
  return process.env.LINEAR_API_KEY || '';
}

function getGatewayConfig() {
  const configPaths = [
    ...getConfigPaths(),
    join(process.env.HOME || '', '.clawdbot/clawdbot.json'),
  ];

  for (const path of configPaths) {
    if (existsSync(path)) {
      try {
        const config = JSON.parse(readFileSync(path, 'utf8'));
        return {
          port: config?.gateway?.port || 18789,
          token: config?.gateway?.auth?.token || '',
        };
      } catch {
        continue;
      }
    }
  }
  return null;
}

interface RoutingRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  conditions: {
    channels?: string[];
    keywords?: string[];
  };
  action: {
    agent: string;
    model: string;
    spawnNew: boolean;
    linearProject?: string;
  };
}

function matchRoutingRule(message: string, channel: string, rules: RoutingRule[]): RoutingRule | null {
  const lowerMessage = message.toLowerCase();
  const lowerChannel = channel.toLowerCase();

  const sorted = [...rules]
    .filter(r => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    const keywordMatch = rule.conditions.keywords?.some(kw =>
      lowerMessage.includes(kw.toLowerCase())
    );
    const channelMatch = rule.conditions.channels?.some(ch =>
      lowerChannel.includes(ch.toLowerCase().replace('#', ''))
    );

    // Keywords are primary — match regardless of channel
    if (keywordMatch) return rule;
    // Channel match without keywords also routes
    if (channelMatch && !rule.conditions.keywords?.length) return rule;
  }

  return null;
}

async function linearQuery(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getLinearApiKey(),
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}

async function getOrCreateDailyProject(): Promise<{ id: string; name: string; url: string } | null> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const projectName = `Bug Fix / Maintenance — ${today}`;

  // Search for today's project
  const listRes = await linearQuery(`{
    projects(first: 10, orderBy: updatedAt) {
      nodes { id name url state }
    }
  }`);

  const existing = listRes?.data?.projects?.nodes?.find(
    (p: { name: string }) => p.name.includes(today)
  );
  if (existing) return existing;

  // Create today's project
  const createRes = await linearQuery(`
    mutation CreateProject($input: ProjectCreateInput!) {
      projectCreate(input: $input) {
        success
        project { id name url }
      }
    }
  `, {
    input: {
      teamIds: [LINEAR_AI_TEAM_ID],
      name: projectName,
      description: `Daily reactive work — bugs, fixes, and maintenance tasks raised in chat.`,
      state: 'started',
    }
  });

  return createRes?.data?.projectCreate?.project || null;
}

async function createLinearIssue(
  title: string,
  description: string,
  agentLabel: string,
  projectId: string
): Promise<{ identifier: string; url: string } | null> {
  const res = await linearQuery(`
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier title url }
      }
    }
  `, {
    input: {
      teamId: LINEAR_AI_TEAM_ID,
      title,
      description: `${description}\n\n---\n**Routed to:** \`${agentLabel}\``,
      priority: 2,
      projectId,
    }
  });

  return res?.data?.issueCreate?.issue || null;
}

async function sendToAgent(
  agentLabel: string,
  task: string,
  model: string,
  linearIssue: { identifier: string; url: string } | null,
  gatewayConfig: { port: number; token: string }
) {
  const linearContext = linearIssue
    ? `\nLinear issue created: ${linearIssue.identifier} — ${linearIssue.url}\nUpdate the issue when work is complete.`
    : '';

  // Try sending directly to the agent's labeled session first
  const agentSessionUrl = `http://127.0.0.1:${gatewayConfig.port}/sessions/${agentLabel}/messages`;
  
  try {
    const directRes = await fetch(agentSessionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayConfig.token}`,
      },
      body: JSON.stringify({ text: `${task}${linearContext}` }),
    });

    if (directRes.ok) {
      return { mode: 'direct', agent: agentLabel };
    }
  } catch {
    // Session doesn't exist yet — fall through to spawn via main
  }

  // Fall back: tell main to spawn the agent
  const spawnInstruction = `Route the following task to the ${agentLabel} agent (model: ${model}). Spawn a new isolated sub-agent with label "${agentLabel}" if one isn't already running.${linearContext}\n\nTask:\n${task}`;

  const mainRes = await fetch(
    `http://127.0.0.1:${gatewayConfig.port}/sessions/main/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayConfig.token}`,
      },
      body: JSON.stringify({ text: spawnInstruction }),
    }
  );

  if (!mainRes.ok) {
    throw new Error(`Gateway error: ${mainRes.status}`);
  }

  return { mode: 'spawn-via-main', agent: agentLabel };
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role === 'view') {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = await request.json();
  // task = the work to do, channel = where it came from (for routing), mode = 'direct' bypasses routing
  // linearIssueId = optional Linear issue ID to update state when dispatching
  const { task, channel = 'general', mode, agentOverride, linearIssueId } = body;

  if (!task || typeof task !== 'string' || task.trim().length === 0) {
    return NextResponse.json({ error: 'Task is required' }, { status: 400 });
  }

  // If a Linear issue ID is provided, set it to "In Progress" (started state)
  let linearStateUpdated = false;
  if (linearIssueId && typeof linearIssueId === 'string') {
    try {
      const startedStateId = await getStateIdByType('started');
      if (startedStateId) {
        linearStateUpdated = await updateLinearIssueState(linearIssueId, startedStateId);
      }
    } catch (err) {
      console.error('Failed to update Linear issue state:', err);
      // Non-fatal — continue with dispatch
    }
  }

  const gatewayConfig = getGatewayConfig();
  if (!gatewayConfig) {
    return NextResponse.json({ error: 'Gateway not configured' }, { status: 500 });
  }

  // Direct mode — skip routing, send straight to main
  if (mode === 'direct') {
    const res = await fetch(
      `http://127.0.0.1:${gatewayConfig.port}/sessions/main/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${gatewayConfig.token}`,
        },
        body: JSON.stringify({ text: task.trim() }),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: `Gateway error: ${res.status}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, mode: 'direct', agent: 'main' });
  }

  // Load routing rules
  const workspace = getOpenClawWorkspace();
  const rulesPath = join(workspace, 'routing-rules.json');
  let rules: RoutingRule[] = [];

  if (existsSync(rulesPath)) {
    try {
      const data = JSON.parse(readFileSync(rulesPath, 'utf-8'));
      rules = data.rules || [];
    } catch {
      // Use empty rules
    }
  }

  // Route: agentOverride bypasses the router (used for direct dispatch from agent detail page)
  let agentLabel: string;
  let model: string;
  let matchedRuleName: string;

  if (agentOverride) {
    agentLabel = agentOverride;
    // Find the routing rule for this agent to get its preferred model
    const ruleForAgent = rules.find((r: RoutingRule) => r.action.agent === agentOverride);
    model = ruleForAgent?.action.model || 'claude-sonnet-4-6';
    matchedRuleName = `direct:${agentOverride}`;
  } else {
    const matched = matchRoutingRule(task, channel, rules);
    agentLabel = matched?.action.agent || 'main';
    model = matched?.action.model || 'claude-sonnet-4-6';
    matchedRuleName = matched?.name || 'fallback';
  }

  // Create Linear issue in today's daily project
  let linearIssue = null;
  try {
    const project = await getOrCreateDailyProject();
    if (project) {
      // Extract a short title from the task (first line, max 80 chars)
      const title = task.split('\n')[0].substring(0, 80);
      linearIssue = await createLinearIssue(title, task, agentLabel, project.id);
    }
  } catch (err) {
    console.error('Linear issue creation failed:', err);
    // Non-fatal — continue without Linear
  }

  // Route to agent
  try {
    const result = await sendToAgent(agentLabel, task, model, linearIssue, gatewayConfig);
    return NextResponse.json({
      success: true,
      ...result,
      matchedRule: matchedRuleName,
      linearIssue: linearIssue ? {
        identifier: linearIssue.identifier,
        url: linearIssue.url,
      } : null,
      linearStateUpdated,
    });
  } catch (err) {
    console.error('Error dispatching to agent:', err);
    return NextResponse.json({ error: 'Failed to dispatch task' }, { status: 500 });
  }
}
