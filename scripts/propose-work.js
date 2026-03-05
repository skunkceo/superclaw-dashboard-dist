#!/usr/bin/env node
/**
 * propose-work.js
 * 
 * Clawd runs this to generate work proposals from the Linear AI team backlog.
 * Reads Linear AI team issues (status: Todo/Backlog, priority 1-3)
 * For each issue not already in work_proposals: creates a proposal
 * Skips issues already proposed, in_progress, or done
 * 
 * Usage: sudo -u mike node scripts/propose-work.js
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';

const LINEAR_API_URL = 'https://api.linear.app/graphql';

// Load Linear config
function getLinearConfig() {
  // Check database first
  const dataDir = process.env.SUPERCLAW_DATA_DIR || '/home/mike/.superclaw';
  const dbPath = join(dataDir, 'superclaw.db');
  
  if (existsSync(dbPath)) {
    const db = new Database(dbPath);
    const row = db.prepare('SELECT value FROM proactivity_settings WHERE key = ?').get('linear_config');
    db.close();
    
    if (row) {
      const config = JSON.parse(row.value);
      if (config.apiKey && config.teamId) {
        return config;
      }
    }
  }

  // Fall back to credentials file
  const credPath = join(process.env.HOME || '/root', '.openclaw/workspace/credentials/linear-api.json');
  if (existsSync(credPath)) {
    const cred = JSON.parse(readFileSync(credPath, 'utf-8'));
    return {
      apiKey: cred.apiKey || cred.api_key,
      teamId: cred.teamId || cred.team_id,
    };
  }

  return null;
}

// Fetch Linear issues
async function fetchLinearIssues(config) {
  const query = `
    query Team($teamId: String!) {
      team(id: $teamId) {
        issues(
          filter: {
            state: { type: { in: ["backlog", "unstarted"] } }
          }
          orderBy: updatedAt
        ) {
          nodes {
            id
            identifier
            title
            description
            url
            priority
            state {
              id
              name
              type
            }
          }
        }
      }
    }
  `;

  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: config.apiKey,
    },
    body: JSON.stringify({
      query,
      variables: { teamId: config.teamId },
    }),
  });

  if (!response.ok) {
    throw new Error(`Linear API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data?.team?.issues?.nodes || [];
}

// Main logic
async function main() {
  const config = getLinearConfig();
  if (!config) {
    console.error('Error: Linear config not found. Configure Linear integration first.');
    process.exit(1);
  }

  console.log('Fetching Linear AI team issues...');
  const issues = await fetchLinearIssues(config);
  
  // Filter for priority 1-3
  const candidates = issues.filter(issue => issue.priority >= 1 && issue.priority <= 3);
  console.log(`Found ${candidates.length} candidate issue(s) (priority 1-3)`);

  // Open database
  const dataDir = process.env.SUPERCLAW_DATA_DIR || '/home/mike/.superclaw';
  const dbPath = join(dataDir, 'superclaw.db');
  const db = new Database(dbPath);

  // Get existing proposals to avoid duplicates
  const existingRows = db.prepare('SELECT linear_issue_id FROM work_proposals WHERE linear_issue_id IS NOT NULL').all();
  const existingIds = new Set(existingRows.map(row => row.linear_issue_id));

  let created = 0;

  for (const issue of candidates) {
    if (existingIds.has(issue.id)) {
      console.log(`  Skipping ${issue.identifier} (already tracked)`);
      continue;
    }

    // Determine effort
    let effort = 'medium';
    if (issue.priority === 1) effort = 'high';
    if (issue.priority >= 3) effort = 'low';

    // Extract repo hint from description
    let repo = null;
    const desc = issue.description || '';
    if (desc.includes('skunkcrm.com')) repo = 'skunkcrm.com';
    if (desc.includes('skunkforms.com')) repo = 'skunkforms.com';
    if (desc.includes('skunkpages.com')) repo = 'skunkpages.com';
    if (desc.includes('superclaw')) repo = 'superclaw-dashboard';

    const why = desc.substring(0, 200) || null;

    db.prepare(`
      INSERT INTO work_proposals (
        id, linear_issue_id, linear_identifier, linear_url, title, why, effort, repo, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      issue.id,
      issue.identifier,
      issue.url,
      issue.title,
      why,
      effort,
      repo,
      'proposed'
    );

    console.log(`  ✓ Created proposal: ${issue.identifier} - ${issue.title}`);
    created++;
  }

  db.close();

  console.log(`\nDone! Created ${created} new proposal(s).`);
  if (created > 0) {
    console.log('View them at: https://superclaw.skunkglobal.com/bridge');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
