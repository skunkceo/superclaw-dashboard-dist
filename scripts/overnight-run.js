#!/usr/bin/env node
/**
 * overnight-run.js
 * Manage overnight run records in the database.
 *
 * Usage:
 *   node overnight-run.js start              — create a new run, prints run ID
 *   node overnight-run.js complete <id> <tasks_started> <tasks_completed> [summary]
 *   node overnight-run.js stop <id>          — mark as stopped
 *   node overnight-run.js status             — print current active run (if any)
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const { randomUUID } = require('crypto');

const dataDir = process.env.SUPERCLAW_DATA_DIR || '/home/mike/.superclaw';
const db = new Database(path.join(dataDir, 'superclaw.db'));

const [,, command, ...args] = process.argv;

try {
  if (command === 'start') {
    const id = randomUUID();
    db.prepare('INSERT INTO overnight_runs (id, started_at, status) VALUES (?, ?, ?)').run(id, Date.now(), 'running');
    db.prepare("INSERT OR REPLACE INTO proactivity_settings (key, value, updated_at) VALUES ('active_run_id', ?, ?)").run(id, Date.now());
    console.log(JSON.stringify({ success: true, runId: id }));

  } else if (command === 'complete') {
    const [id, tasksStarted, tasksCompleted, ...summaryParts] = args;
    if (!id) { console.error('Run ID required'); process.exit(1); }
    const summary = summaryParts.join(' ') || null;
    db.prepare('UPDATE overnight_runs SET status = ?, completed_at = ?, tasks_started = ?, tasks_completed = ?, summary = ? WHERE id = ?')
      .run('completed', Date.now(), parseInt(tasksStarted || '0'), parseInt(tasksCompleted || '0'), summary, id);
    db.prepare("INSERT OR REPLACE INTO proactivity_settings (key, value, updated_at) VALUES ('active_run_id', '', ?)").run(Date.now());
    db.prepare("INSERT OR REPLACE INTO proactivity_settings (key, value, updated_at) VALUES ('overnight_mode', 'false', ?)").run(Date.now());
    console.log(JSON.stringify({ success: true, runId: id, status: 'completed' }));

  } else if (command === 'stop') {
    const [id] = args;
    if (!id) {
      // Stop the active run
      const active = db.prepare("SELECT id FROM overnight_runs WHERE status = 'running' ORDER BY started_at DESC LIMIT 1").get();
      if (!active) { console.log(JSON.stringify({ success: true, message: 'No active run' })); process.exit(0); }
      db.prepare("UPDATE overnight_runs SET status = 'stopped', completed_at = ? WHERE id = ?").run(Date.now(), active.id);
      db.prepare("INSERT OR REPLACE INTO proactivity_settings (key, value, updated_at) VALUES ('active_run_id', '', ?)").run(Date.now());
      db.prepare("INSERT OR REPLACE INTO proactivity_settings (key, value, updated_at) VALUES ('overnight_mode', 'false', ?)").run(Date.now());
      console.log(JSON.stringify({ success: true, runId: active.id, status: 'stopped' }));
    } else {
      db.prepare("UPDATE overnight_runs SET status = 'stopped', completed_at = ? WHERE id = ?").run(Date.now(), id);
      console.log(JSON.stringify({ success: true, runId: id, status: 'stopped' }));
    }

  } else if (command === 'status') {
    const active = db.prepare("SELECT * FROM overnight_runs WHERE status = 'running' ORDER BY started_at DESC LIMIT 1").get();
    const enabled = db.prepare("SELECT value FROM proactivity_settings WHERE key = 'overnight_mode'").get();
    const queued = db.prepare("SELECT count(*) as n FROM suggestions WHERE status = 'queued'").get();
    console.log(JSON.stringify({
      enabled: enabled?.value === 'true',
      activeRun: active || null,
      queuedCount: queued?.n || 0,
    }));

  } else {
    console.error('Usage: overnight-run.js start|complete|stop|status');
    process.exit(1);
  }
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
