#!/usr/bin/env node
/**
 * Standalone script to sync cc_tasks with Linear.
 * Run: sudo -u mike node /home/mike/apps/websites/superclaw-dashboard/scripts/sync-cc-tasks-linear.js
 */

const Database = require('better-sqlite3');
const { join } = require('path');
const { existsSync } = require('fs');

// Database paths
const superclawDbPath = join(process.env.HOME || '/root', '.superclaw', 'superclaw.db');
const marketingDbPath = '/home/mike/apps/websites/growth-marketing/marketing.db';

if (!existsSync(marketingDbPath)) {
  console.error('❌ Marketing database not found:', marketingDbPath);
  process.exit(1);
}

const superclawDb = new Database(superclawDbPath);
const marketingDb = new Database(marketingDbPath);

const LINEAR_API_URL = 'https://api.linear.app/graphql';

// ─── Get Linear config ────────────────────────────────────────────────────────

function getLinearConfig() {
  try {
    const row = superclawDb.prepare("SELECT value FROM proactivity_settings WHERE key = 'linear_config'").get();
    if (row?.value) {
      const config = JSON.parse(row.value);
      if (config.apiKey && config.teamId) {
        return config;
      }
    }
  } catch (err) {
    console.error('Failed to read Linear config from database:', err);
  }

  // Fallback to credentials file
  const credPath = '/root/.openclaw/workspace/credentials/linear-api.json';
  if (existsSync(credPath)) {
    try {
      const cred = require(credPath);
      return {
        apiKey: cred.apiKey || cred.api_key,
        teamId: cred.teamId || cred.team_id || '097e59de-e354-4f3c-b8b2-02a09dd1d873', // AI team
      };
    } catch (err) {
      console.error('Failed to read Linear credentials file:', err);
    }
  }

  return null;
}

// ─── GraphQL query helper ─────────────────────────────────────────────────────

async function linearQuery(query, variables, apiKey) {
  try {
    const res = await fetch(LINEAR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
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

    return data.data;
  } catch (err) {
    console.error('Linear request failed:', err);
    return null;
  }
}

// ─── Get workflow states ──────────────────────────────────────────────────────

async function getTeamWorkflowStates(config) {
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

  const result = await linearQuery(query, { teamId: config.teamId }, config.apiKey);
  return result?.team?.states?.nodes || [];
}

// ─── Get or create label ──────────────────────────────────────────────────────

async function getCategoryLabelId(category, config) {
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

  const result = await linearQuery(query, { teamId: config.teamId }, config.apiKey);
  const labels = result?.team?.labels?.nodes || [];
  const label = labels.find(l => l.name.toLowerCase() === category.toLowerCase());
  return label?.id || null;
}

// ─── Create Linear issue ──────────────────────────────────────────────────────

async function createLinearIssue(params, config) {
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

  const input = {
    teamId: config.teamId,
    title: params.title,
    description: params.description || '',
    priority: params.priority ?? 3,
  };

  if (params.labelIds && params.labelIds.length > 0) {
    input.labelIds = params.labelIds;
  }
  if (params.stateId) {
    input.stateId = params.stateId;
  }

  const result = await linearQuery(query, { input }, config.apiKey);
  if (result?.issueCreate?.success && result.issueCreate.issue) {
    const issue = result.issueCreate.issue;
    return { id: issue.id, identifier: issue.identifier, url: issue.url };
  }
  return null;
}

// ─── Map priority ─────────────────────────────────────────────────────────────

function mapCCTaskPriorityToLinear(priority) {
  switch (priority?.toLowerCase()) {
    case 'critical': return 1;
    case 'high': return 2;
    case 'medium': return 3;
    case 'low': return 4;
    default: return 3;
  }
}

// ─── Map status to state type ─────────────────────────────────────────────────

function mapCCTaskStatusToStateType(status) {
  switch (status?.toLowerCase()) {
    case 'backlog': return 'backlog';
    case 'in_progress': return 'started';
    case 'review': return 'started';
    case 'completed': return 'completed';
    default: return 'unstarted';
  }
}

// ─── Main sync function ───────────────────────────────────────────────────────

async function syncCCTasksToLinear() {
  const config = getLinearConfig();
  if (!config) {
    console.error('❌ No Linear configuration found');
    process.exit(1);
  }

  console.log('📊 Linear Team ID:', config.teamId);
  console.log('');

  // Get tasks without Linear IDs
  const tasks = marketingDb.prepare("SELECT * FROM cc_tasks WHERE linear_issue_id IS NULL AND status != 'completed' ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END").all();

  console.log(`📋 Found ${tasks.length} cc_tasks to sync to Linear\n`);

  if (tasks.length === 0) {
    console.log('✅ All tasks already synced!');
    process.exit(0);
  }

  // Get workflow states
  const workflowStates = await getTeamWorkflowStates(config);
  console.log(`🔄 Fetched ${workflowStates.length} workflow states\n`);

  let synced = 0;
  let failed = 0;

  for (const task of tasks) {
    try {
      console.log(`\n🔨 Processing: ${task.title}`);
      console.log(`   Priority: ${task.priority} | Status: ${task.status} | Product: ${task.product || 'none'} | Area: ${task.area || 'none'}`);

      // Get label IDs
      const labelIds = [];
      
      if (task.product) {
        const productLabelId = await getCategoryLabelId(task.product, config);
        if (productLabelId) {
          labelIds.push(productLabelId);
          console.log(`   ✓ Found product label: ${task.product}`);
        }
      }
      
      if (task.area) {
        const areaLabelId = await getCategoryLabelId(task.area, config);
        if (areaLabelId) {
          labelIds.push(areaLabelId);
          console.log(`   ✓ Found area label: ${task.area}`);
        }
      }
      
      const ccLabelId = await getCategoryLabelId('command-centre', config);
      if (ccLabelId) {
        labelIds.push(ccLabelId);
        console.log('   ✓ Added command-centre label');
      }

      // Find state
      const stateType = mapCCTaskStatusToStateType(task.status);
      const state = workflowStates.find(s => s.type === stateType);
      if (state) {
        console.log(`   ✓ Mapped to state: ${state.name} (${stateType})`);
      }

      // Build description
      const descriptionParts = [];
      if (task.description) descriptionParts.push(task.description);
      
      const metadata = [];
      if (task.product) metadata.push(`**Product:** ${task.product}`);
      if (task.area) metadata.push(`**Area:** ${task.area}`);
      if (task.status) metadata.push(`**Status:** ${task.status}`);
      if (task.priority) metadata.push(`**Priority:** ${task.priority}`);
      if (metadata.length > 0) descriptionParts.push('\n\n' + metadata.join(' | '));
      
      descriptionParts.push('\n\n---\n*Synced from Superclaw Command Centre*');

      // Create Linear issue
      const issue = await createLinearIssue({
        title: task.title,
        description: descriptionParts.join(''),
        priority: mapCCTaskPriorityToLinear(task.priority),
        labelIds: labelIds.length > 0 ? labelIds : undefined,
        stateId: state?.id,
      }, config);

      if (issue) {
        // Update cc_task with Linear info
        marketingDb.prepare('UPDATE cc_tasks SET linear_issue_id = ?, linear_identifier = ?, linear_url = ? WHERE id = ?')
          .run(issue.id, issue.identifier, issue.url, task.id);
        
        console.log(`   ✅ Created Linear issue: ${issue.identifier} - ${issue.url}`);
        synced++;
      } else {
        console.error(`   ❌ Failed to create Linear issue`);
        failed++;
      }

      // Rate limit: 300ms between creates
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`   ❌ Error:`, err.message);
      failed++;
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`\n✅ Sync complete!`);
  console.log(`   Synced: ${synced}`);
  console.log(`   Failed: ${failed}`);
  console.log('');
}

// Run the sync
syncCCTasksToLinear().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
