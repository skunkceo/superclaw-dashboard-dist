#!/usr/bin/env node
/**
 * post-report.js
 * Post a report directly to the SuperClaw database.
 *
 * Usage: node scripts/post-report.js <title> <type> [suggestion_id] [content_file]
 *
 * If no content_file given, reads content from stdin.
 * Types: sprint, research, seo, competitor, content, intelligence, general
 *
 * Example:
 *   echo "# My Report\n\nContent here" | node scripts/post-report.js "Weekly SEO" seo
 *   node scripts/post-report.js "Competitor Analysis" competitor abc-suggestion-id ./report.md
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { randomUUID } = require('crypto');

const dataDir = process.env.SUPERCLAW_DATA_DIR || '/home/mike/.superclaw';
const db = new Database(path.join(dataDir, 'superclaw.db'));

const [,, title, type, suggestionId, contentFile] = process.argv;

if (!title || !type) {
  console.error('Usage: node post-report.js <title> <type> [suggestion_id] [content_file]');
  console.error('Types: sprint, research, seo, competitor, content, intelligence, general');
  process.exit(1);
}

function readContent(file) {
  if (file) {
    return fs.readFileSync(file, 'utf8');
  }
  // Read from stdin
  return fs.readFileSync('/dev/stdin', 'utf8');
}

try {
  const content = readContent(contentFile);
  const now = Date.now();

  // Ensure table exists (safe if db.ts already created it)
  db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      suggestion_id TEXT,
      overnight_run_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // Deduplicate: check if a report with the same title already exists
  const existing = db.prepare('SELECT id FROM reports WHERE title = ?').get(title);

  let reportId;
  let wasUpdated = false;

  if (existing) {
    // Update content instead of inserting a duplicate
    reportId = existing.id;
    db.prepare('UPDATE reports SET content = ?, type = ?, suggestion_id = ? WHERE id = ?')
      .run(content, type, suggestionId || null, reportId);
    wasUpdated = true;
  } else {
    reportId = randomUUID();
    db.prepare(`
      INSERT INTO reports (id, title, type, content, suggestion_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(reportId, title, type, content, suggestionId || null, now);
  }

  // If suggestion_id given, mark it completed
  if (suggestionId) {
    const existingSuggestion = db.prepare('SELECT id FROM suggestions WHERE id = ?').get(suggestionId);
    if (existingSuggestion) {
      db.prepare('UPDATE suggestions SET status = ?, report_id = ?, actioned_at = ? WHERE id = ?')
        .run('completed', reportId, now, suggestionId);
    }
  }

  console.log(JSON.stringify({ success: true, reportId, title, type, updated: wasUpdated }));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
