#!/usr/bin/env node
/**
 * backfill-intel-insights.js
 * One-off script to generate AI insights for existing intel items.
 * 
 * Usage: ANTHROPIC_API_KEY=sk-... sudo -u mike node scripts/backfill-intel-insights.js
 */

'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// ─── Config ───────────────────────────────────────────────────────────────────

const dataDir = process.env.SUPERCLAW_DATA_DIR || '/home/mike/.superclaw';
const db = new Database(path.join(dataDir, 'superclaw.db'));

// Load API key from environment or .env files
let ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
if (!ANTHROPIC_API_KEY) {
  // Try loading from .env.local or .env
  const envFiles = ['.env.local', '.env'];
  for (const envFile of envFiles) {
    const envPath = path.join(__dirname, '..', envFile);
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const match = line.match(/^ANTHROPIC_API_KEY=(.+)$/);
        if (match) {
          ANTHROPIC_API_KEY = match[1].trim();
          break;
        }
      }
      if (ANTHROPIC_API_KEY) break;
    }
  }
}

if (!ANTHROPIC_API_KEY) {
  console.error('ERROR: ANTHROPIC_API_KEY not found. Set it in environment or .env file.');
  console.error('Usage: ANTHROPIC_API_KEY=sk-... sudo -u mike node scripts/backfill-intel-insights.js');
  process.exit(1);
}

// ─── Anthropic API ────────────────────────────────────────────────────────────

async function generateInsight(category, title, summary) {
  const prompt = `You are a strategic advisor for Skunk Global, a WordPress plugin suite (SkunkCRM, SkunkForms, SkunkPages).

Given this market intelligence signal:
Category: ${category}
Title: ${title}
Summary: ${summary}

Write ONE sentence (max 20 words) explaining what this means for Skunk — a specific, actionable implication.
Start with an action verb or "Skunk should/could/needs".
Examples:
- "SkunkForms should highlight anti-spam features — competitors' users are frustrated with spam."
- "Reach out to wppool.dev for roundup inclusion — this is a backlink + visibility opportunity."
- "Build a FluentCRM comparison page before this competitor does."

Respond with ONLY the one sentence. No quotes, no bullet points.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022', // Cheap and fast
        max_tokens: 50,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Anthropic API error: ${response.status} ${error}`);
      return null;
    }

    const data = await response.json();
    return data.content[0].text.trim();
  } catch (error) {
    console.error(`Error calling Anthropic API: ${error.message}`);
    return null;
  }
}

// ─── Sleep helper ─────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  
  // Get all intel items without insights that are not archived
  const items = db.prepare(
    'SELECT id, category, title, summary FROM intel_items WHERE insight IS NULL AND archived_at IS NULL'
  ).all();

  if (items.length === 0) {
    console.log('No intel items need insights. All done!');
    return;
  }

  console.log(`Found ${items.length} intel items that need insights. Processing...`);
  
  let processed = 0;
  let updated = 0;
  let errors = 0;
  
  const updateStmt = db.prepare('UPDATE intel_items SET insight = ? WHERE id = ?');
  
  // Process in batches of 10 with delays to respect rate limits
  for (let i = 0; i < items.length; i += 10) {
    const batch = items.slice(i, i + 10);
    
    for (const item of batch) {
      try {
        console.log(`Processing ${processed + 1}/${items.length}: ${item.title.slice(0, 60)}...`);
        
        const insight = await generateInsight(item.category, item.title, item.summary);
        
        if (insight) {
          updateStmt.run(insight, item.id);
          updated++;
          console.log(`  → ${insight}`);
        } else {
          errors++;
          console.log(`  → Failed to generate insight`);
        }
        
        processed++;
        
        // Small delay between requests to avoid hitting rate limits
        await sleep(200);
        
      } catch (error) {
        errors++;
        console.error(`Error processing item ${item.id}: ${error.message}`);
        processed++;
      }
    }
    
    // Longer delay between batches
    if (i + 10 < items.length) {
      console.log(`Batch complete. Waiting 2 seconds before next batch...`);
      await sleep(2000);
    }
  }
  
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  
  console.log('\n--- Backfill Complete ---');
  console.log(`Processed: ${processed}/${items.length} items`);
  console.log(`Updated: ${updated} items with insights`);
  console.log(`Errors: ${errors} items`);
  console.log(`Time elapsed: ${elapsed} seconds`);
  console.log('Done.');
}

main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
