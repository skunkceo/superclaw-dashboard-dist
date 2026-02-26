import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import os from 'os';

// Skills that require manual setup to enable
const SETUP_REQUIRED: Record<string, { instructions: string; settingsPath: string }> = {
  email: {
    instructions: "To enable Email, configure your IMAP/SMTP credentials in Settings. You'll need your email host, port, username, and app password.",
    settingsPath: '/settings',
  },
  calendar: {
    instructions: "To enable Calendar, connect your Google account in Settings. You'll need to authorise OpenClaw to access Google Calendar.",
    settingsPath: '/settings',
  },
};

function getDb() {
  const dataDir = process.env.SUPERCLAW_DATA_DIR || join(os.homedir(), '.superclaw');
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const db = new Database(join(dataDir, 'superclaw.db'));
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_states (
      name TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    )
  `);
  return db;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await params;
  const skillName = name.toLowerCase();
  let body: { enabled?: boolean } = {};
  try { body = await request.json(); } catch { /* ignore */ }
  const enabled = body.enabled !== false; // default true

  // Check if setup is required to enable this skill
  if (enabled && SETUP_REQUIRED[skillName]) {
    const setup = SETUP_REQUIRED[skillName];
    return NextResponse.json({
      needsSetup: true,
      skillName,
      instructions: setup.instructions,
      settingsPath: setup.settingsPath,
    });
  }

  // Persist the state in the DB
  const db = getDb();
  try {
    db.prepare(`
      INSERT INTO skill_states (name, enabled, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at
    `).run(skillName, enabled ? 1 : 0, Date.now());
  } finally {
    db.close();
  }

  return NextResponse.json({ success: true, skillName, enabled });
}
