#!/usr/bin/env node
/**
 * approved-proposals.js
 * List approved bridge work proposals that are ready for agent pickup.
 *
 * Usage:
 *   node approved-proposals.js           — JSON array of approved proposals
 *   node approved-proposals.js start <id> <branch> — mark proposal in_progress
 *   node approved-proposals.js complete <id> <pr_url> [pr_number] — mark done
 */

const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

const dataDir = process.env.SUPERCLAW_DATA_DIR || path.join(os.homedir(), '.superclaw');
const db = new Database(path.join(dataDir, 'superclaw.db'));

const [,, command, ...args] = process.argv;

try {
  if (!command || command === 'list') {
    const proposals = db.prepare(
      "SELECT * FROM work_proposals WHERE status = 'approved' ORDER BY approved_at ASC"
    ).all();
    console.log(JSON.stringify(proposals));

  } else if (command === 'start') {
    const [id, branchName] = args;
    if (!id) { console.error('Proposal ID required'); process.exit(1); }
    db.prepare(
      "UPDATE work_proposals SET status = 'in_progress', branch_name = ? WHERE id = ?"
    ).run(branchName || null, id);
    console.log(JSON.stringify({ success: true, id, status: 'in_progress' }));

  } else if (command === 'complete') {
    const [id, prUrl, prNumber] = args;
    if (!id) { console.error('Proposal ID required'); process.exit(1); }
    db.prepare(
      "UPDATE work_proposals SET status = 'done', completed_at = ?, pr_url = ?, pr_number = ? WHERE id = ?"
    ).run(Date.now(), prUrl || null, prNumber ? parseInt(prNumber) : null, id);
    console.log(JSON.stringify({ success: true, id, status: 'done' }));

  } else {
    console.error('Usage: approved-proposals.js [list|start <id> [branch]|complete <id> <pr_url> [pr_number]]');
    process.exit(1);
  }
} catch (err) {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
}
