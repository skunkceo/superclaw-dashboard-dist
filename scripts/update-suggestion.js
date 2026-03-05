#!/usr/bin/env node
/**
 * update-suggestion.js
 * Update a suggestion's status from the command line.
 *
 * Usage: node scripts/update-suggestion.js <id> <status> [notes]
 * Example: node scripts/update-suggestion.js abc123 in_progress
 *          node scripts/update-suggestion.js abc123 completed "Wrote 1200-word post, published"
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dataDir = process.env.SUPERCLAW_DATA_DIR || '/home/mike/.superclaw';
const db = new Database(path.join(dataDir, 'superclaw.db'));

const [,, id, status, notes] = process.argv;

if (!id || !status) {
  console.error('Usage: node update-suggestion.js <id> <status> [notes]');
  process.exit(1);
}

const allowed = ['pending', 'approved', 'dismissed', 'queued', 'in_progress', 'completed'];
if (!allowed.includes(status)) {
  console.error(`Invalid status. Must be one of: ${allowed.join(', ')}`);
  process.exit(1);
}

try {
  const existing = db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id);
  if (!existing) {
    console.error(`Suggestion ${id} not found`);
    process.exit(1);
  }

  db.prepare('UPDATE suggestions SET status = ?, actioned_at = ?, notes = ? WHERE id = ?')
    .run(status, Date.now(), notes || existing.notes, id);

  console.log(JSON.stringify({ success: true, id, status, notes }));
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
