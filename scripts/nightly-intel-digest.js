#!/usr/bin/env node
/**
 * nightly-intel-digest.js
 * Run intel refresh, summarize into a digest report, and post to SuperClaw.
 * 
 * Usage: node scripts/nightly-intel-digest.js
 */

'use strict';

const { execSync } = require('child_process');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.SUPERCLAW_DATA_DIR || '/home/mike/.superclaw';
const db = new Database(path.join(dataDir, 'superclaw.db'));

console.log('[intel-digest] Starting nightly intel digest...');

// Step 1: Run intel refresh
console.log('[intel-digest] Running intel refresh...');
try {
  const output = execSync('node /home/mike/apps/websites/superclaw-dashboard/scripts/intel-refresh.js', {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log(output);
} catch (error) {
  console.error('[intel-digest] Intel refresh failed:', error.message);
  process.exit(1);
}

// Step 2: Fetch today's intel items
console.log('[intel-digest] Fetching intel items...');
const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
const intelItems = db.prepare(`
  SELECT * FROM intel_items 
  WHERE created_at > ? AND archived_at IS NULL 
  ORDER BY created_at DESC
`).all(oneDayAgo);

console.log(`[intel-digest] Found ${intelItems.length} new intel items`);

// Step 3: Generate markdown report
const now = new Date();
const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

let markdown = `# Intel Digest — ${dateStr}\n\n`;

if (intelItems.length === 0) {
  markdown += 'No new intelligence gathered today.\n';
} else {
  // Group by category
  const byCategory = {};
  for (const item of intelItems) {
    const cat = item.category || 'general';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(item);
  }

  // Render by category
  const categoryLabels = {
    competitor: 'Competitor News',
    competitor_feature: 'Competitor Features',
    opportunity: 'Opportunities',
    wordpress: 'WordPress Ecosystem',
    market: 'Market Trends',
    seo: 'SEO & Search',
    keyword: 'Keyword Signals',
    trend: 'Trends',
    roundup: 'Roundups & Lists',
    pain_point: 'User Pain Points',
    general: 'General',
  };

  const categoryOrder = ['roundup', 'competitor', 'competitor_feature', 'opportunity', 'trend', 'wordpress', 'market', 'seo', 'keyword', 'pain_point'];
  const categories = [...new Set([...categoryOrder, ...Object.keys(byCategory)])];

  for (const category of categories) {
    const items = byCategory[category];
    if (!items || items.length === 0) continue;

    const label = categoryLabels[category] || category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    markdown += `## ${label}\n\n`;

    for (const item of items) {
      markdown += `### ${item.title}\n\n`;
      
      if (item.url) {
        markdown += `**Source:** [${new URL(item.url).hostname}](${item.url})\n\n`;
      }
      
      if (item.summary) {
        const cleanSummary = item.summary
          .replace(/<[^>]+>/g, '')
          .replace(/&[a-z]+;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        markdown += `${cleanSummary}\n\n`;
      }
      
      if (item.insight) {
        markdown += `**For Skunk:** ${item.insight}\n\n`;
      }
      
      markdown += '---\n\n';
    }
  }
}

markdown += `\n_Total intel items: ${intelItems.length}_\n`;

// Step 4: Post to SuperClaw reports
console.log('[intel-digest] Posting report to SuperClaw...');
try {
  const reportTitle = `Intel Digest — ${dateStr}`;
  // Write to temp file to avoid shell escaping issues with newlines
  const tmpFile = `/tmp/intel-digest-${Date.now()}.md`;
  fs.writeFileSync(tmpFile, markdown, 'utf8');
  
  const cmd = `SUPERCLAW_DATA_DIR=${dataDir} node /home/mike/apps/websites/superclaw-dashboard/scripts/post-report.js "${reportTitle}" intelligence "" "${tmpFile}"`;
  
  try {
    execSync(cmd, {
      encoding: 'utf8',
      shell: '/bin/bash'
    });
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (e) {}
  }
  const _ = '';
  
  console.log('[intel-digest] Report posted successfully');
  console.log(`[intel-digest] View at: https://superclaw.skunkglobal.com/reports`);
  
  // Output summary for cron to post to Slack
  console.log('\n' + '='.repeat(60));
  console.log(`Intel Digest — ${dateStr}`);
  console.log(`${intelItems.length} new intelligence items gathered`);
  console.log(`View full report: https://superclaw.skunkglobal.com/reports`);
  console.log('='.repeat(60));
  
} catch (error) {
  console.error('[intel-digest] Failed to post report:', error.message);
  process.exit(1);
} finally {
  db.close();
}
