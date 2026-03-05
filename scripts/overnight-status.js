#!/usr/bin/env node
/**
 * overnight-status.js
 * Called by Clawd's cron to check the overnight queue.
 * Outputs JSON: { enabled, activeRun, queuedTasks }
 *
 * Usage: node scripts/overnight-status.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dataDir = process.env.SUPERCLAW_DATA_DIR || '/home/mike/.superclaw';
const db = new Database(path.join(dataDir, 'superclaw.db'));

try {
  const enabledRow = db.prepare("SELECT value FROM proactivity_settings WHERE key = 'overnight_mode'").get();
  const enabled = enabledRow?.value === 'true';

  const activeRun = db.prepare("SELECT * FROM overnight_runs WHERE status = 'running' ORDER BY started_at DESC LIMIT 1").get();

  const queuedTasks = db.prepare(
    "SELECT id, title, why, effort, impact, category, priority FROM suggestions WHERE status = 'queued' ORDER BY priority ASC, impact_score DESC"
  ).all();

  const result = {
    enabled,
    activeRun: activeRun || null,
    queuedTasks,
    queuedCount: queuedTasks.length,
  };

  process.stdout.write(JSON.stringify(result, null, 2));
  process.exit(0);
} catch (err) {
  process.stdout.write(JSON.stringify({ error: err.message }));
  process.exit(1);
}
