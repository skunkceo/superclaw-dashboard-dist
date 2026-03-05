import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Store database in user's config directory
const dataDir = process.env.SUPERCLAW_DATA_DIR || join(process.env.HOME || '/root', '.superclaw');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, 'superclaw.db');
const db = new Database(dbPath);

// Marketing database (for cc_tasks)
const marketingDbPath = '/home/mike/apps/websites/growth-marketing/marketing.db';
const marketingDb = existsSync(marketingDbPath) ? new Database(marketingDbPath) : null;

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'view',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    last_login INTEGER,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`);

// Agent definitions table
db.exec(`
  CREATE TABLE IF NOT EXISTS agent_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    soul TEXT,
    model TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    skills TEXT DEFAULT '[]',
    tools TEXT DEFAULT '[]',
    color TEXT DEFAULT '#f97316',
    icon TEXT DEFAULT 'bot',
    memory_dir TEXT,
    system_prompt TEXT,
    max_tokens INTEGER,
    thinking TEXT DEFAULT 'low',
    handoff_rules TEXT DEFAULT '[]',
    enabled BOOLEAN DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    created_by INTEGER,
    spawn_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );
`);

// Add handoff_rules column if it doesn't exist (migration)
try {
  db.exec(`ALTER TABLE agent_definitions ADD COLUMN handoff_rules TEXT DEFAULT '[]'`);
} catch (error) {
  // Column already exists, ignore the error
}

// Add enabled column if it doesn't exist (migration)
try {
  db.exec(`ALTER TABLE agent_definitions ADD COLUMN enabled BOOLEAN DEFAULT 1`);
} catch (error) {
  // Column already exists, ignore the error
}

// Add insight column to intel_items if it doesn't exist (migration)
try {
  db.exec(`ALTER TABLE intel_items ADD COLUMN insight TEXT`);
} catch (error) {
  // Column already exists, ignore the error
}

// Tasks table for Porter orchestration
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    assigned_agent TEXT,
    what_doing TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    completed_at INTEGER,
    session_id TEXT,
    FOREIGN KEY (assigned_agent) REFERENCES agent_definitions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(assigned_agent);
  CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
`);

// Licenses table for Pro tier
db.exec(`
  CREATE TABLE IF NOT EXISTS licenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    license_key TEXT UNIQUE NOT NULL,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    tier TEXT NOT NULL DEFAULT 'pro',
    activated_at INTEGER,
    expires_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    stripe_session_id TEXT,
    stripe_customer_id TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
  CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
`);

export type UserRole = 'view' | 'edit' | 'admin';

export interface User {
  id: number;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: number;
  last_login: number | null;
  created_by: number | null;
}

export interface Session {
  id: string;
  user_id: number;
  expires_at: number;
  created_at: number;
}

// User operations
export function getUserByEmail(email: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
}

export function getUserById(id: number): User | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function createUser(email: string, passwordHash: string, role: UserRole, createdBy?: number): number {
  const result = db.prepare(
    'INSERT INTO users (email, password_hash, role, created_by) VALUES (?, ?, ?, ?)'
  ).run(email, passwordHash, role, createdBy || null);
  return result.lastInsertRowid as number;
}

export function updateLastLogin(id: number): void {
  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').run(Date.now(), id);
}

export function getAllUsers(): Omit<User, 'password_hash'>[] {
  return db.prepare('SELECT id, email, role, created_at, last_login, created_by FROM users').all() as Omit<User, 'password_hash'>[];
}

export function updateUserRole(id: number, role: UserRole): void {
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
}

export function deleteUser(id: number): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export function updateUserPassword(id: number, passwordHash: string): void {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id);
}

export function getUserCount(): number {
  const result = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  return result.count;
}

// Session operations
export function createSession(userId: number, sessionId: string, expiresAt: number): void {
  db.prepare(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(sessionId, userId, expiresAt);
}

export function getSession(sessionId: string): (Session & { user: Omit<User, 'password_hash'> }) | undefined {
  const session = db.prepare(`
    SELECT s.*, u.id as u_id, u.email, u.role, u.created_at as u_created_at, u.last_login, u.created_by
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > ?
  `).get(sessionId, Date.now()) as (Session & { u_id: number; email: string; role: UserRole; u_created_at: number; last_login: number | null; created_by: number | null }) | undefined;
  
  if (!session) return undefined;
  
  return {
    id: session.id,
    user_id: session.user_id,
    expires_at: session.expires_at,
    created_at: session.created_at,
    user: {
      id: session.u_id,
      email: session.email,
      role: session.role,
      created_at: session.u_created_at,
      last_login: session.last_login,
      created_by: session.created_by,
    },
  };
}

export function deleteSession(sessionId: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function deleteUserSessions(userId: number): void {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

export function cleanExpiredSessions(): void {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}

// Agent definition types
export interface AgentDefinition {
  id: string;
  name: string;
  description: string | null;
  soul: string | null;
  model: string;
  skills: string; // JSON array
  tools: string; // JSON array
  color: string;
  icon: string;
  memory_dir: string | null;
  system_prompt: string | null;
  max_tokens: number | null;
  thinking: string;
  handoff_rules: string; // JSON array
  enabled: boolean;
  created_at: number;
  updated_at: number;
  created_by: number | null;
  spawn_count: number;
}

export function getAllAgentDefinitions(): AgentDefinition[] {
  return db.prepare('SELECT * FROM agent_definitions ORDER BY name').all() as AgentDefinition[];
}

export function getAgentDefinition(id: string): AgentDefinition | undefined {
  return db.prepare('SELECT * FROM agent_definitions WHERE id = ?').get(id) as AgentDefinition | undefined;
}

export function createAgentDefinition(agent: Omit<AgentDefinition, 'created_at' | 'updated_at' | 'spawn_count'>): void {
  db.prepare(`
    INSERT INTO agent_definitions (id, name, description, soul, model, skills, tools, color, icon, memory_dir, system_prompt, max_tokens, thinking, handoff_rules, enabled, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    agent.id, agent.name, agent.description, agent.soul, agent.model,
    agent.skills, agent.tools, agent.color, agent.icon, agent.memory_dir,
    agent.system_prompt, agent.max_tokens, agent.thinking, agent.handoff_rules, agent.enabled, agent.created_by
  );
}

export function updateAgentDefinition(id: string, updates: Partial<AgentDefinition>): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (['id', 'created_at', 'spawn_count'].includes(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }

  fields.push('updated_at = ?');
  values.push(Date.now());
  values.push(id);

  db.prepare(`UPDATE agent_definitions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteAgentDefinition(id: string): void {
  db.prepare('DELETE FROM agent_definitions WHERE id = ?').run(id);
}

export function incrementAgentSpawnCount(id: string): void {
  db.prepare('UPDATE agent_definitions SET spawn_count = spawn_count + 1 WHERE id = ?').run(id);
}

// Task types and functions
export interface Task {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'completed';
  assigned_agent: string | null;
  what_doing: string | null;
  created_at: number;
  completed_at: number | null;
  session_id: string | null;
}

export function getAllTasks(filters?: { status?: string; agent?: string; category?: string }): Task[] {
  let query = 'SELECT * FROM tasks';
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters?.status) {
    conditions.push('status = ?');
    values.push(filters.status);
  }

  if (filters?.category) {
    conditions.push('category = ?');
    values.push(filters.category);
  }

  if (filters?.agent) {
    conditions.push('assigned_agent = ?');
    values.push(filters.agent);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC';
  return db.prepare(query).all(...values) as Task[];
}

export function getTaskById(id: string): Task | undefined {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
}

export function createTask(task: Omit<Task, 'created_at'>): void {
  db.prepare(`
    INSERT INTO tasks (id, title, status, assigned_agent, what_doing, completed_at, session_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.id, task.title, task.status, task.assigned_agent,
    task.what_doing, task.completed_at, task.session_id
  );
}

export function updateTask(id: string, updates: Partial<Omit<Task, 'id' | 'created_at'>>): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'id' || key === 'created_at') continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return;

  values.push(id);
  db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteTask(id: string): void {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

// License types and functions
export interface License {
  id: number;
  license_key: string;
  email: string | null;
  status: 'active' | 'inactive' | 'expired';
  tier: 'pro';
  activated_at: number | null;
  expires_at: number | null;
  created_at: number;
  stripe_session_id: string | null;
  stripe_customer_id: string | null;
}

export function getLicenseByKey(key: string): License | undefined {
  return db.prepare('SELECT * FROM licenses WHERE license_key = ?').get(key) as License | undefined;
}

export function createLicense(license: Omit<License, 'id' | 'created_at'>): number {
  const result = db.prepare(`
    INSERT INTO licenses (license_key, email, status, tier, activated_at, expires_at, stripe_session_id, stripe_customer_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    license.license_key, license.email, license.status, license.tier,
    license.activated_at, license.expires_at, license.stripe_session_id, license.stripe_customer_id
  );
  return result.lastInsertRowid as number;
}

export function activateLicense(key: string, email?: string): boolean {
  const license = getLicenseByKey(key);
  if (!license || license.status !== 'active') return false;

  db.prepare('UPDATE licenses SET activated_at = ?, email = ? WHERE license_key = ?')
    .run(Date.now(), email || license.email, key);
  return true;
}

export function getActiveLicense(): License | undefined {
  return db.prepare('SELECT * FROM licenses WHERE status = ? AND activated_at IS NOT NULL ORDER BY activated_at DESC LIMIT 1')
    .get('active') as License | undefined;
}

export function getAllLicenses(): License[] {
  return db.prepare('SELECT * FROM licenses ORDER BY created_at DESC').all() as License[];
}

// ─── Proactivity Module ───────────────────────────────────────────────────────

// Intelligence items table
db.exec(`
  CREATE TABLE IF NOT EXISTS intel_items (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    url TEXT,
    source TEXT NOT NULL DEFAULT 'brave',
    relevance_score INTEGER DEFAULT 50,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    read_at INTEGER,
    archived_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_intel_category ON intel_items(category);
  CREATE INDEX IF NOT EXISTS idx_intel_created ON intel_items(created_at);
  CREATE INDEX IF NOT EXISTS idx_intel_archived ON intel_items(archived_at);
`);

// Suggestions table
db.exec(`
  CREATE TABLE IF NOT EXISTS suggestions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    why TEXT NOT NULL,
    effort TEXT NOT NULL,
    impact TEXT NOT NULL,
    impact_score INTEGER DEFAULT 50,
    category TEXT NOT NULL,
    source_intel_ids TEXT DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending',
    priority INTEGER DEFAULT 3,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    actioned_at INTEGER,
    notes TEXT,
    report_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
  CREATE INDEX IF NOT EXISTS idx_suggestions_priority ON suggestions(priority);
  CREATE INDEX IF NOT EXISTS idx_suggestions_created ON suggestions(created_at);
`);

// Linear integration columns migration
try {
  db.exec(`ALTER TABLE suggestions ADD COLUMN linear_issue_id TEXT`);
} catch { /* Column exists */ }
try {
  db.exec(`ALTER TABLE suggestions ADD COLUMN linear_identifier TEXT`);
} catch { /* Column exists */ }
try {
  db.exec(`ALTER TABLE suggestions ADD COLUMN linear_url TEXT`);
} catch { /* Column exists */ }

// intel_id and source columns migration
try {
  db.exec(`ALTER TABLE suggestions ADD COLUMN intel_id TEXT`);
} catch { /* Column exists */ }
try {
  db.exec(`ALTER TABLE suggestions ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`);
} catch { /* Column exists */ }
// Overnight runs table
db.exec(`
  CREATE TABLE IF NOT EXISTS overnight_runs (
    id TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    status TEXT NOT NULL DEFAULT 'running',
    tasks_started INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    summary TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_overnight_status ON overnight_runs(status);
`);

// Reports table
db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    suggestion_id TEXT,
    overnight_run_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
  );
  CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
  CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);
`);

// Proactivity settings table
db.exec(`
  CREATE TABLE IF NOT EXISTS proactivity_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
  );
`);

// Seed default settings if not present
const defaultSettings: Record<string, string> = {
  overnight_mode: 'false',
  overnight_start_time: '00:00',
  overnight_end_time: '06:00',
  intel_refresh_interval_hours: '6',
  suggestion_auto_generate: 'true',
  last_intel_refresh: '0',
  last_suggestion_run: '0',
};
for (const [key, value] of Object.entries(defaultSettings)) {
  db.prepare(`INSERT OR IGNORE INTO proactivity_settings (key, value) VALUES (?, ?)`).run(key, value);
}

// ─── Intel Item types & functions ────────────────────────────────────────────

export interface IntelItem {
  id: string;
  category: 'market' | 'competitor' | 'seo' | 'opportunity' | 'wordpress' | 'keyword' | string;
  title: string;
  summary: string;
  url: string | null;
  source: string;
  relevance_score: number;
  created_at: number;
  read_at: number | null;
  archived_at?: number | null;
  insight: string | null;
  commented_at?: number | null;
}

export function getAllIntelItems(filters?: { category?: string; unread?: boolean; limit?: number; archived?: boolean }): IntelItem[] {
  let query = 'SELECT * FROM intel_items';
  const conditions: string[] = [];
  const values: unknown[] = [];

  // By default, exclude archived items unless explicitly requested
  if (filters?.archived) {
    conditions.push('archived_at IS NOT NULL');
  } else {
    conditions.push('archived_at IS NULL');
  }

  if (filters?.category) {
    conditions.push('category = ?');
    values.push(filters.category);
  }
  if (filters?.unread) {
    conditions.push('read_at IS NULL');
  }

  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY created_at DESC';
  if (filters?.limit) {
    query += ' LIMIT ?';
    values.push(filters.limit);
  }

  return db.prepare(query).all(...values) as IntelItem[];
}

export function createIntelItem(item: Omit<IntelItem, 'created_at' | 'read_at' | 'archived_at'>): void {
  db.prepare(`
    INSERT INTO intel_items (id, category, title, summary, url, source, relevance_score)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(item.id, item.category, item.title, item.summary, item.url, item.source, item.relevance_score);
}

export function markIntelRead(id: string): void {
  db.prepare('UPDATE intel_items SET read_at = ? WHERE id = ?').run(Date.now(), id);
}

export function markAllIntelRead(): void {
  db.prepare('UPDATE intel_items SET read_at = ? WHERE read_at IS NULL AND archived_at IS NULL').run(Date.now());
}

export function getIntelStats(): { total: number; unread: number; archived: number; byCategory: Record<string, number> } {
  const total = (db.prepare('SELECT COUNT(*) as n FROM intel_items WHERE archived_at IS NULL').get() as { n: number }).n;
  const unread = (db.prepare('SELECT COUNT(*) as n FROM intel_items WHERE read_at IS NULL AND archived_at IS NULL').get() as { n: number }).n;
  const archived = (db.prepare('SELECT COUNT(*) as n FROM intel_items WHERE archived_at IS NOT NULL').get() as { n: number }).n;
  const rows = db.prepare('SELECT category, COUNT(*) as n FROM intel_items WHERE archived_at IS NULL GROUP BY category').all() as { category: string; n: number }[];
  const byCategory: Record<string, number> = {};
  for (const row of rows) byCategory[row.category] = row.n;
  return { total, unread, archived, byCategory };
}

export function archiveIntelItem(id: string): void {
  db.prepare('UPDATE intel_items SET archived_at = ? WHERE id = ?').run(Date.now(), id);
}

export function archiveAllIntelItems(): number {
  const result = db.prepare('UPDATE intel_items SET archived_at = ? WHERE archived_at IS NULL').run(Date.now());
  return result.changes;
}

export function markIntelCommented(id: string): void {
  const now = Date.now();
  // Mark as commented and also archive so it leaves the active feed
  db.prepare('UPDATE intel_items SET commented_at = ?, archived_at = COALESCE(archived_at, ?), read_at = COALESCE(read_at, ?) WHERE id = ?')
    .run(now, now, now, id);
}

// ─── Suggestion types & functions ─────────────────────────────────────────────

export interface Suggestion {
  id: string;
  title: string;
  why: string;
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  impact_score: number;
  category: 'content' | 'seo' | 'code' | 'marketing' | 'research' | 'product' | string;
  source_intel_ids: string;
  status: 'pending' | 'approved' | 'dismissed' | 'queued' | 'in_progress' | 'completed';
  priority: number;
  created_at: number;
  actioned_at: number | null;
  notes: string | null;
  intel_id: string | null;
  source: string;
  report_id: string | null;
  linear_issue_id?: string | null;
  linear_identifier?: string | null;
  linear_url?: string | null;
}

export function getAllSuggestions(filters?: { status?: string; limit?: number; category?: string }): Suggestion[] {
  let query = 'SELECT * FROM suggestions';
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters?.status) {
    conditions.push('status = ?');
    values.push(filters.status);
  }

  if (filters?.category) {
    conditions.push('category = ?');
    values.push(filters.category);
  }

  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY priority ASC, impact_score DESC, created_at DESC';
  if (filters?.limit) {
    query += ' LIMIT ?';
    values.push(filters.limit);
  }

  return db.prepare(query).all(...values) as Suggestion[];
}

export function getSuggestionById(id: string): Suggestion | undefined {
  return db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id) as Suggestion | undefined;
}

export function createSuggestion(s: Omit<Suggestion, 'created_at' | 'actioned_at' | 'report_id'>): void {
  db.prepare(`
    INSERT INTO suggestions (id, title, why, effort, impact, impact_score, category, source_intel_ids, status, priority, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(s.id, s.title, s.why, s.effort, s.impact, s.impact_score, s.category, s.source_intel_ids, s.status, s.priority, s.notes);
}

export function updateSuggestion(id: string, updates: Partial<Omit<Suggestion, 'id' | 'created_at'>>): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'id' || key === 'created_at') continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }
  if (fields.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE suggestions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteSuggestion(id: string): void {
  db.prepare('DELETE FROM suggestions WHERE id = ?').run(id);
}

export function getIntelItemById(id: string): IntelItem | undefined {
  return db.prepare('SELECT * FROM intel_items WHERE id = ?').get(id) as IntelItem | undefined;
}

export function deleteIntelItem(id: string): void {
  db.prepare('DELETE FROM intel_items WHERE id = ?').run(id);
}

export function getSuggestionsWithoutLinear(): Suggestion[] {
  return db.prepare("SELECT * FROM suggestions WHERE linear_issue_id IS NULL AND status NOT IN ('dismissed', 'completed') ORDER BY priority ASC, impact_score DESC").all() as Suggestion[];
}

export function updateSuggestionLinear(id: string, linearIssueId: string, linearIdentifier: string, linearUrl: string): void {
  db.prepare('UPDATE suggestions SET linear_issue_id = ?, linear_identifier = ?, linear_url = ? WHERE id = ?')
    .run(linearIssueId, linearIdentifier, linearUrl, id);
}

export function getSuggestionStats(): { pending: number; approved: number; queued: number; completed: number; dismissed: number } {
  const rows = db.prepare('SELECT status, COUNT(*) as n FROM suggestions GROUP BY status').all() as { status: string; n: number }[];
  const stats: Record<string, number> = { pending: 0, approved: 0, queued: 0, completed: 0, dismissed: 0 };
  for (const row of rows) if (row.status in stats) stats[row.status] = row.n;
  return stats as { pending: number; approved: number; queued: number; completed: number; dismissed: number };
}

// ─── CC Tasks (Command Centre) types & functions ─────────────────────────────

export interface CCTask {
  id: number;
  title: string;
  description: string | null;
  status: string; // backlog, in_progress, review, completed
  priority: string; // critical, high, medium, low
  product: string | null; // skunkcrm, skunkforms, skunkpages, skunk-global, superclaw, etc.
  area: string | null; // dev, marketing, seo, infrastructure, gtm, social, content
  assigned_to: string | null;
  created_by: string | null;
  parent_task_id: number | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  completed_at: string | null;
  deliverables: string | null;
  linear_issue_id: string | null;
  linear_identifier: string | null;
  linear_url: string | null;
}

export function getCCTasksWithoutLinear(): CCTask[] {
  if (!marketingDb) return [];
  return marketingDb.prepare("SELECT * FROM cc_tasks WHERE linear_issue_id IS NULL AND status != 'completed' ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END").all() as CCTask[];
}

export function updateCCTaskLinear(id: number, linearIssueId: string, linearIdentifier: string, linearUrl: string): void {
  if (!marketingDb) return;
  marketingDb.prepare('UPDATE cc_tasks SET linear_issue_id = ?, linear_identifier = ?, linear_url = ? WHERE id = ?')
    .run(linearIssueId, linearIdentifier, linearUrl, id);
}

export function getCCTaskByLinearId(linearIssueId: string): CCTask | undefined {
  if (!marketingDb) return undefined;
  return marketingDb.prepare('SELECT * FROM cc_tasks WHERE linear_issue_id = ?').get(linearIssueId) as CCTask | undefined;
}

export function createCCTask(task: Omit<CCTask, 'id' | 'created_at' | 'updated_at'>): number | undefined {
  if (!marketingDb) return undefined;
  const result = marketingDb.prepare(`
    INSERT INTO cc_tasks (title, description, status, priority, product, area, assigned_to, created_by, notes, linear_issue_id, linear_identifier, linear_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.title,
    task.description,
    task.status,
    task.priority,
    task.product,
    task.area,
    task.assigned_to,
    task.created_by,
    task.notes,
    task.linear_issue_id,
    task.linear_identifier,
    task.linear_url
  );
  return result.lastInsertRowid as number;
}

export function getAllCCTasks(): CCTask[] {
  if (!marketingDb) return [];
  return marketingDb.prepare('SELECT * FROM cc_tasks ORDER BY created_at DESC').all() as CCTask[];
}

// ─── Overnight run types & functions ─────────────────────────────────────────

export interface OvernightRun {
  id: string;
  started_at: number;
  completed_at: number | null;
  status: 'running' | 'completed' | 'stopped';
  tasks_started: number;
  tasks_completed: number;
  summary: string | null;
}

export function createOvernightRun(id: string): void {
  db.prepare(`INSERT INTO overnight_runs (id, started_at) VALUES (?, ?)`).run(id, Date.now());
}

export function updateOvernightRun(id: string, updates: Partial<OvernightRun>): void {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'id' || key === 'started_at') continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }
  if (fields.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE overnight_runs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function getLatestOvernightRun(): OvernightRun | undefined {
  return db.prepare('SELECT * FROM overnight_runs ORDER BY started_at DESC LIMIT 1').get() as OvernightRun | undefined;
}

export function getActiveOvernightRun(): OvernightRun | undefined {
  return db.prepare("SELECT * FROM overnight_runs WHERE status = 'running' ORDER BY started_at DESC LIMIT 1").get() as OvernightRun | undefined;
}

// ─── Report types & functions ────────────────────────────────────────────────

export interface Report {
  id: string;
  title: string;
  type: 'sprint' | 'research' | 'seo' | 'competitor' | 'content' | 'intelligence' | 'general';
  content: string;
  suggestion_id: string | null;
  overnight_run_id: string | null;
  created_at: number;
}

export function getAllReports(filters?: { type?: string; limit?: number }): Report[] {
  let query = 'SELECT id, title, type, suggestion_id, overnight_run_id, created_at FROM reports';
  const conditions: string[] = [];
  const values: unknown[] = [];
  if (filters?.type) {
    conditions.push('type = ?');
    values.push(filters.type);
  }
  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY created_at DESC';
  if (filters?.limit) { query += ' LIMIT ?'; values.push(filters.limit); }
  return db.prepare(query).all(...values) as Report[];
}

export function getReportById(id: string): Report | undefined {
  return db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as Report | undefined;
}

export function createReport(r: Omit<Report, 'created_at'>): void {
  db.prepare(`
    INSERT INTO reports (id, title, type, content, suggestion_id, overnight_run_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(r.id, r.title, r.type, r.content, r.suggestion_id, r.overnight_run_id);
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    agent_label TEXT NOT NULL DEFAULT 'main',
    action_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    details TEXT,
    links TEXT DEFAULT '[]',
    task_id TEXT,
    session_key TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_log(timestamp);
  CREATE INDEX IF NOT EXISTS idx_activity_agent ON activity_log(agent_label);
  CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_log(action_type);
`);

// ─── Work Proposals ───────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS work_proposals (
    id TEXT PRIMARY KEY,
    linear_issue_id TEXT,
    linear_identifier TEXT,
    linear_url TEXT,
    title TEXT NOT NULL,
    why TEXT,
    effort TEXT DEFAULT 'medium',
    repo TEXT,
    status TEXT NOT NULL DEFAULT 'proposed',
    branch_name TEXT,
    pr_url TEXT,
    pr_number INTEGER,
    proposed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    approved_at INTEGER,
    completed_at INTEGER,
    rejected_at INTEGER,
    notes TEXT
    intel_id TEXT,
    source TEXT DEFAULT 'manual'
  );
  CREATE INDEX IF NOT EXISTS idx_proposals_status ON work_proposals(status);
  CREATE INDEX IF NOT EXISTS idx_proposals_proposed_at ON work_proposals(proposed_at);
  CREATE INDEX IF NOT EXISTS idx_proposals_intel_id ON work_proposals(intel_id);
`);

export interface WorkProposal {
  id: string;
  linear_issue_id: string | null;
  linear_identifier: string | null;
  linear_url: string | null;
  title: string;
  why: string | null;
  effort: 'low' | 'medium' | 'high';
  repo: string | null;
  status: 'proposed' | 'idea' | 'backlog' | 'queued' | 'approved' | 'in_progress' | 'in_review' | 'completed' | 'rejected' | 'dismissed';
  branch_name: string | null;
  pr_url: string | null;
  pr_number: number | null;
  proposed_at: number;
  approved_at: number | null;
  completed_at: number | null;
  rejected_at: number | null;
  notes: string | null;
  intel_id: string | null;
  source: string;
  category: string;
}

export function getAllWorkProposals(filters?: { status?: string; category?: string }): WorkProposal[] {
  let query = 'SELECT * FROM work_proposals';
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters?.status) {
    conditions.push('status = ?');
    values.push(filters.status);
  }

  if (filters?.category) {
    conditions.push('category = ?');
    values.push(filters.category);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY proposed_at DESC';
  return db.prepare(query).all(...values) as WorkProposal[];
}

export function getWorkProposalById(id: string): WorkProposal | undefined {
  return db.prepare('SELECT * FROM work_proposals WHERE id = ?').get(id) as WorkProposal | undefined;
}

export function getWorkProposalByLinearId(linearIssueId: string): WorkProposal | undefined {
  return db.prepare('SELECT * FROM work_proposals WHERE linear_issue_id = ?').get(linearIssueId) as WorkProposal | undefined;
}

export function createWorkProposal(proposal: Omit<WorkProposal, 'proposed_at' | 'approved_at' | 'completed_at' | 'rejected_at'>): void {
  db.prepare(`
    INSERT INTO work_proposals (id, linear_issue_id, linear_identifier, linear_url, title, why, effort, repo, status, branch_name, pr_url, pr_number, notes, intel_id, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    proposal.id,
    proposal.linear_issue_id,
    proposal.linear_identifier,
    proposal.linear_url,
    proposal.title,
    proposal.why,
    proposal.effort,
    proposal.repo,
    proposal.status,
    proposal.branch_name,
    proposal.pr_url,
    proposal.pr_number,
    proposal.notes,
    proposal.intel_id,
    proposal.source
  );
}

export function updateWorkProposal(id: string, updates: Partial<Omit<WorkProposal, 'id' | 'proposed_at'>>): void {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'id' || key === 'proposed_at') continue;
    fields.push(`${key} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return;

  values.push(id);
  db.prepare(`UPDATE work_proposals SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteWorkProposal(id: string): void {
  db.prepare('DELETE FROM work_proposals WHERE id = ?').run(id);
}

// ─── Bridge Data Cache ────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS bridge_cache (
    key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    fetched_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
  );
  CREATE INDEX IF NOT EXISTS idx_bridge_cache_fetched ON bridge_cache(fetched_at);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS bridge_briefs (
    id TEXT PRIMARY KEY,
    brief TEXT NOT NULL,
    generated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
  );
  CREATE INDEX IF NOT EXISTS idx_bridge_briefs_generated ON bridge_briefs(generated_at);
`);

export interface ActivityEntry {
  id: string;
  timestamp: number;
  agent_label: string;
  action_type: string;
  summary: string;
  details: string | null;
  links: string;
  task_id: string | null;
  session_key: string | null;
}

export function createActivityEntry(entry: Omit<ActivityEntry, 'timestamp'>): void {
  db.prepare(`
    INSERT INTO activity_log (id, timestamp, agent_label, action_type, summary, details, links, task_id, session_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.id,
    Date.now(),
    entry.agent_label,
    entry.action_type,
    entry.summary,
    entry.details || null,
    entry.links || '[]',
    entry.task_id || null,
    entry.session_key || null,
  );
}

export function getActivityLog(filters?: {
  agent_label?: string;
  action_type?: string;
  since?: number;
  limit?: number;
}): ActivityEntry[] {
  let query = 'SELECT * FROM activity_log';
  const conditions: string[] = [];
  const values: (string | number)[] = [];
  if (filters?.agent_label) { conditions.push('agent_label = ?'); values.push(filters.agent_label); }
  if (filters?.action_type) { conditions.push('action_type = ?'); values.push(filters.action_type); }
  if (filters?.since) { conditions.push('timestamp >= ?'); values.push(filters.since); }
  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY timestamp DESC';
  if (filters?.limit) { query += ' LIMIT ?'; values.push(filters.limit); }
  return db.prepare(query).all(...values) as ActivityEntry[];
}

// ─── Proactivity settings ─────────────────────────────────────────────────────

export function getProactivitySetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM proactivity_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setProactivitySetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO proactivity_settings (key, value, updated_at) VALUES (?, ?, ?)').run(key, value, Date.now());
}

export function getAllProactivitySettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM proactivity_settings').all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

// ─── Settings Table ───────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))').run(key, value);
}

export function deleteSetting(key: string): void {
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

// ─── Version Summary Cache ────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS version_summaries (
    product TEXT NOT NULL,
    version TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    PRIMARY KEY (product, version)
  );
`);

export function getVersionSummary(product: string, version: string): string | null {
  const row = db.prepare('SELECT summary FROM version_summaries WHERE product = ? AND version = ?').get(product, version) as { summary: string } | undefined;
  return row ? row.summary : null;
}

export function saveVersionSummary(product: string, version: string, summary: string): void {
  db.prepare('INSERT OR REPLACE INTO version_summaries (product, version, summary) VALUES (?, ?, ?)').run(product, version, summary);
}

// ─── Bridge Cache Functions ───────────────────────────────────────────────────

export function getBridgeCache(key: string, maxAgeMs: number = 6 * 60 * 60 * 1000): any | null {
  const row = db.prepare('SELECT data, fetched_at FROM bridge_cache WHERE key = ?').get(key) as { data: string; fetched_at: number } | undefined;
  if (!row) return null;
  
  const age = Date.now() - row.fetched_at;
  if (age > maxAgeMs) return null;
  
  return JSON.parse(row.data);
}

export function setBridgeCache(key: string, data: any): void {
  db.prepare('INSERT OR REPLACE INTO bridge_cache (key, data, fetched_at) VALUES (?, ?, ?)').run(key, JSON.stringify(data), Date.now());
}

export function getLatestBrief(): { id: string; brief: any; generated_at: number } | null {
  const row = db.prepare('SELECT * FROM bridge_briefs ORDER BY generated_at DESC LIMIT 1').get() as { id: string; brief: string; generated_at: number } | undefined;
  if (!row) return null;
  return { ...row, brief: JSON.parse(row.brief) };
}

export function saveBrief(id: string, brief: any): void {
  db.prepare('INSERT INTO bridge_briefs (id, brief, generated_at) VALUES (?, ?, ?)').run(id, JSON.stringify(brief), Date.now());
}

export default db;

export function getWorkProposalByIntelId(intelId: string): WorkProposal | undefined {
  return db.prepare('SELECT * FROM work_proposals WHERE intel_id = ?').get(intelId) as WorkProposal | undefined;
}
