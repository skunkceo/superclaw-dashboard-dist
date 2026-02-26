/**
 * Workspace path resolution for SuperClaw API routes.
 *
 * All path helpers live here. Import from this file — never hardcode /root/ anywhere.
 *
 * Works on any platform: Mac (/Users/xxx), Linux (/home/xxx), root (/root).
 * OPENCLAW_WORKSPACE env var overrides everything.
 */

import { readFileSync, existsSync } from 'fs';
import os from 'os';
import path from 'path';

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Home directory of the current user. */
const HOME = os.homedir();

/** All candidate config file paths, preferred first. */
function configCandidates(): string[] {
  return [
    path.join(HOME, '.openclaw', 'openclaw.json'),
    path.join(HOME, '.clawdbot', 'clawdbot.json'),
    '/root/.openclaw/openclaw.json',
    '/root/.clawdbot/clawdbot.json',
  ];
}

/** Read + parse the first config file that exists. Returns null if none found. */
function readConfig(): Record<string, any> | null {
  for (const p of configCandidates()) {
    try {
      return JSON.parse(readFileSync(p, 'utf-8'));
    } catch {
      // try next
    }
  }
  return null;
}

// ─── Caches ──────────────────────────────────────────────────────────────────
let _cachedMain: string | null = null;
let _cachedOpenClaw: string | null = null;
let _cachedOpenClawDir: string | null = null;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Main agent workspace — where MEMORY.md, SOUL.md, TOOLS.md etc. live.
 * e.g. /root/.openclaw/workspace  (or ~/.openclaw/workspace on a regular user)
 */
export function getMainWorkspace(): string {
  if (_cachedMain) return _cachedMain;
  if (process.env.OPENCLAW_WORKSPACE) return (_cachedMain = process.env.OPENCLAW_WORKSPACE);

  const config = readConfig();
  const workspace: string | undefined =
    config?.agents?.defaults?.workspace ||
    config?.agents?.main?.workspace ||
    config?.workspace;

  _cachedMain = workspace || path.join(HOME, '.openclaw', 'workspace');
  return _cachedMain;
}

/**
 * OpenClaw internal workspace — routing-rules.json, agent sub-dirs, sessions.
 * Same as getMainWorkspace() in most installs.
 */
export function getOpenClawWorkspace(): string {
  if (_cachedOpenClaw) return _cachedOpenClaw;
  if (process.env.OPENCLAW_WORKSPACE) return (_cachedOpenClaw = process.env.OPENCLAW_WORKSPACE);

  const config = readConfig();
  const workspace: string | undefined =
    config?.agents?.defaults?.workspace ||
    config?.agents?.main?.workspace ||
    config?.workspace;

  _cachedOpenClaw = workspace || path.join(HOME, '.openclaw', 'workspace');
  return _cachedOpenClaw;
}

/**
 * OpenClaw data directory — where openclaw.json, cron/, agents/ live.
 * e.g. /root/.openclaw  (or ~/.openclaw on a regular user)
 */
export function getOpenClawDir(): string {
  if (_cachedOpenClawDir) return _cachedOpenClawDir;
  // Check if the standard location exists relative to home
  const standard = path.join(HOME, '.openclaw');
  if (existsSync(standard)) return (_cachedOpenClawDir = standard);
  // Fall back to /root/.openclaw for backwards compat on our server
  if (existsSync('/root/.openclaw')) return (_cachedOpenClawDir = '/root/.openclaw');
  return (_cachedOpenClawDir = standard);
}

/** Path to openclaw.json (or clawdbot.json). Returns first one that exists. */
export function getConfigPath(): string {
  for (const p of configCandidates()) {
    if (existsSync(p)) return p;
  }
  // Return the preferred path even if it doesn't exist yet
  return path.join(HOME, '.openclaw', 'openclaw.json');
}

/** All config path candidates — for routes that loop through them. */
export function getConfigPaths(): string[] {
  return configCandidates();
}

/** Path to cron/jobs.json */
export function getCronJobsPath(): string {
  return path.join(getOpenClawDir(), 'cron', 'jobs.json');
}

/** All cron jobs.json candidates */
export function getCronJobsPaths(): string[] {
  return [
    path.join(getOpenClawDir(), 'cron', 'jobs.json'),
    path.join(HOME, '.clawdbot', 'cron', 'jobs.json'),
    '/root/.openclaw/cron/jobs.json',
    '/root/.clawdbot/cron/jobs.json',
  ].filter((v, i, arr) => arr.indexOf(v) === i); // dedupe
}

/** Path to agents/main/sessions directory */
export function getSessionsDir(): string {
  return path.join(getOpenClawDir(), 'agents', 'main', 'sessions');
}

/** All sessions dir candidates */
export function getSessionsDirs(): string[] {
  return [
    path.join(getOpenClawDir(), 'agents', 'main', 'sessions'),
    '/root/.openclaw/agents/main/sessions',
    '/root/.clawdbot/agents/main/sessions',
  ].filter((v, i, arr) => arr.indexOf(v) === i);
}

/** Path to workspace/credentials/<filename> */
export function getCredentialPath(filename: string): string {
  return path.join(getOpenClawWorkspace(), 'credentials', filename);
}

/** Path to workspace/agents/<label> */
export function getAgentWorkspacePath(label: string): string {
  return path.join(getOpenClawWorkspace(), 'agents', label);
}

/** Path to main workspace skills dir */
export function getSkillsDir(): string {
  return path.join(getMainWorkspace(), 'skills');
}

/** Path to main workspace memory/agents dir */
export function getAgentMemoryDir(slug?: string): string {
  const base = path.join(getMainWorkspace(), 'memory', 'agents');
  return slug ? path.join(base, slug) : base;
}

// Backwards compat alias
export const getWorkspacePath = getMainWorkspace;
