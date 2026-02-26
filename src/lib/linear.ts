/**
 * Linear GraphQL client for Superclaw.
 * Reads config from proactivity_settings.linear_config FIRST,
 * falls back to {workspace}/credentials/linear-api.json
 */

import { readFileSync, existsSync } from 'fs';
import { getCredentialPath } from '@/lib/workspace';
import { getProactivitySetting } from '@/lib/db';

const LINEAR_API_URL = 'https://api.linear.app/graphql';

// State IDs for Skunk Global workspace
export const LINEAR_STATES = {
  backlog: '5a1c2e3d-4f5b-6c7a-8b9d-0e1f2a3b4c5d', // Placeholder - will be fetched
  todo: '6b2d3f4e-5g6c-7d8b-9c0e-1f2g3h4i5j6k',
  inProgress: '7c3e4g5f-6h7d-8e9c-0d1f-2g3h4i5j6k7l',
  done: '8d4f5h6g-7i8e-9f0d-1e2g-3h4i5j6k7l8m',
};

// Label IDs for categorization
export const LINEAR_LABELS = {
  proactivity: 'proactivity-auto',
  content: 'content',
  seo: 'seo',
  research: 'research',
  marketing: 'marketing',
  product: 'product',
  code: 'code',
};

export interface LinearConfig {
  apiKey: string;
  teamId: string;
  teamName?: string;
  projectId?: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  url: string;
  state: { id: string; name: string; type?: string };
  priority: number;
  labels: { nodes: Array<{ id: string; name: string }> };
  createdAt: string;
  stateType?: string;
}

export interface LinearState {
  id: string;
  name: string;
  type: string;
}

interface LinearCreateIssueResponse {
  issueCreate: {
    success: boolean;
    issue?: LinearIssue;
  };
}

interface LinearIssuesResponse {
  team: {
    issues: {
      nodes: LinearIssue[];
    };
  };
}

/**
 * Get Linear config from proactivity_settings first, then fall back to credentials file.
 */
export function getLinearConfig(): LinearConfig | null {
  // Check proactivity_settings.linear_config FIRST
  try {
    const dbConfig = getProactivitySetting('linear_config');
    if (dbConfig) {
      const parsed = JSON.parse(dbConfig);
      if (parsed.apiKey && parsed.teamId) {
        return {
          apiKey: parsed.apiKey,
          teamId: parsed.teamId,
          teamName: parsed.teamName,
          projectId: parsed.projectId,
        };
      }
    }
  } catch (err) {
    // Fall through to file-based config
  }

  // Fall back to credentials file
  const credPath = getCredentialPath('linear-api.json');
  if (!existsSync(credPath)) {
    return null;
  }
  try {
    const cred = JSON.parse(readFileSync(credPath, 'utf8'));
    return {
      apiKey: cred.apiKey || cred.api_key,
      teamId: cred.teamId || cred.team_id,
      projectId: cred.projectId || cred.project_id,
    };
  } catch (err) {
    console.error('Failed to parse Linear credentials:', err);
    return null;
  }
}

export async function linearQuery<T>(query: string, variables?: Record<string, unknown>, apiKey?: string): Promise<T | null> {
  const config = getLinearConfig();
  const key = apiKey || config?.apiKey;
  if (!key) return null;

  try {
    const res = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': key,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      console.error('Linear API error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    if (data.errors) {
      console.error('Linear GraphQL errors:', data.errors);
      return null;
    }

    return data.data as T;
  } catch (err) {
    console.error('Linear request failed:', err);
    return null;
  }
}

/**
 * Test a Linear API key by fetching the viewer info.
 */
export async function testLinearConnection(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const query = `{ viewer { id name email } }`;
    const res = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      return { valid: false, error: `API error: ${res.status}` };
    }

    const data = await res.json();
    if (data.errors) {
      return { valid: false, error: data.errors[0]?.message || 'Invalid API key' };
    }

    if (data.data?.viewer?.id) {
      return { valid: true };
    }

    return { valid: false, error: 'Could not verify API key' };
  } catch (err) {
    return { valid: false, error: 'Connection failed' };
  }
}

/**
 * Fetch teams accessible with the given API key.
 */
export async function fetchTeamsWithApiKey(apiKey: string): Promise<Array<{ id: string; name: string; key: string }>> {
  const query = `{ teams { nodes { id name key } } }`;

  try {
    const res = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.data?.teams?.nodes || [];
  } catch {
    return [];
  }
}

export async function getOpenLinearIssues(): Promise<LinearIssue[]> {
  const config = getLinearConfig();
  if (!config) return [];

  const query = `
    query TeamIssues($teamId: String!) {
      team(id: $teamId) {
        issues(
          filter: {
            state: { type: { nin: ["completed", "canceled"] } }
          }
          first: 50
          orderBy: updatedAt
        ) {
          nodes {
            id
            identifier
            title
            description
            url
            priority
            state { id name type }
            labels { nodes { id name } }
            createdAt
          }
        }
      }
    }
  `;

  const result = await linearQuery<LinearIssuesResponse>(query, { teamId: config.teamId });
  const issues = result?.team?.issues?.nodes || [];

  // Add stateType field for easier filtering
  return issues.map(issue => ({
    ...issue,
    stateType: issue.state?.type,
  }));
}

/**
 * Fetch all workflow states for the configured team.
 */
export async function getTeamWorkflowStates(): Promise<LinearState[]> {
  const config = getLinearConfig();
  if (!config) return [];

  const query = `
    query TeamStates($teamId: String!) {
      team(id: $teamId) {
        states {
          nodes {
            id
            name
            type
          }
        }
      }
    }
  `;

  const result = await linearQuery<{ team: { states: { nodes: LinearState[] } } }>(query, { teamId: config.teamId });
  return result?.team?.states?.nodes || [];
}

/**
 * Get the state ID for a given state type (e.g., "started", "completed", "backlog", "unstarted").
 * Returns the first matching state.
 */
export async function getStateIdByType(stateType: string): Promise<string | null> {
  const states = await getTeamWorkflowStates();
  const state = states.find(s => s.type === stateType);
  return state?.id || null;
}

export async function createLinearIssue(params: {
  title: string;
  description?: string;
  priority?: number;
  labelIds?: string[];
  stateId?: string;
}): Promise<{ id: string; identifier: string; url: string } | null> {
  const config = getLinearConfig();
  if (!config) return null;

  const query = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          url
        }
      }
    }
  `;

  const input: Record<string, unknown> = {
    teamId: config.teamId,
    title: params.title,
    description: params.description || '',
    priority: params.priority ?? 3,
  };

  if (config.projectId) {
    input.projectId = config.projectId;
  }
  if (params.labelIds && params.labelIds.length > 0) {
    input.labelIds = params.labelIds;
  }
  if (params.stateId) {
    input.stateId = params.stateId;
  }

  const result = await linearQuery<LinearCreateIssueResponse>(query, { input });
  if (result?.issueCreate?.success && result.issueCreate.issue) {
    const issue = result.issueCreate.issue;
    return { id: issue.id, identifier: issue.identifier, url: issue.url };
  }
  return null;
}

export async function updateLinearIssueState(issueId: string, stateId: string): Promise<boolean> {
  const query = `
    mutation UpdateIssue($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) {
        success
      }
    }
  `;

  const result = await linearQuery<{ issueUpdate: { success: boolean } }>(query, { id: issueId, stateId });
  return result?.issueUpdate?.success ?? false;
}

// Helper to get label ID by category
export async function getCategoryLabelId(category: string): Promise<string | null> {
  const config = getLinearConfig();
  if (!config) return null;

  const query = `
    query TeamLabels($teamId: String!) {
      team(id: $teamId) {
        labels {
          nodes {
            id
            name
          }
        }
      }
    }
  `;

  const result = await linearQuery<{ team: { labels: { nodes: Array<{ id: string; name: string }> } } }>(query, { teamId: config.teamId });
  const labels = result?.team?.labels?.nodes || [];
  const label = labels.find((l: { id: string; name: string }) => l.name.toLowerCase() === category.toLowerCase());
  return label?.id || null;
}

// Map suggestion priority (1-4) to Linear priority (0-4, where 0=none, 1=urgent, 4=low)
export function mapPriorityToLinear(sugPriority: number): number {
  // Suggestion priority: 1=highest, 4=lowest
  // Linear priority: 0=none, 1=urgent, 2=high, 3=medium, 4=low
  if (sugPriority === 1) return 1; // urgent
  if (sugPriority === 2) return 2; // high
  if (sugPriority === 3) return 3; // medium
  return 4; // low
}
