import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Repos to track — configurable via env, falls back to sensible defaults
// GIT_REPOS: comma-separated list of "owner/repo" slugs
// GIT_ORG: GitHub org/user to use when building default list
const GIT_ORG = process.env.GIT_ORG || 'skunkceo';
const DEFAULT_REPOS = [
  `${GIT_ORG}/superclaw-dashboard`,
  `${GIT_ORG}/superclaw-cli`,
  `${GIT_ORG}/skunkglobal.com`,
  `${GIT_ORG}/skunkcrm.com`,
  `${GIT_ORG}/skunkforms.com`,
  `${GIT_ORG}/skunkpages.com`,
  `${GIT_ORG}/skunkcrm-pro`,
  `${GIT_ORG}/skunkforms-plugin`,
  `${GIT_ORG}/skunkpages-plugin`,
  `${GIT_ORG}/skunkcrm`,
];
const REPOS = process.env.GIT_REPOS
  ? process.env.GIT_REPOS.split(',').map(r => r.trim()).filter(Boolean)
  : DEFAULT_REPOS;

// Optional: local git base path for fast, complete backfill
// Set GIT_REPOS_BASE=/home/mike/apps/websites in .env to enable local mode.
// Local mode reads all branches including unmerged PRs, no API rate limits.
// If not set, falls back to GitHub API.
const GIT_REPOS_BASE = process.env.GIT_REPOS_BASE || null;

// Map "owner/repo" slug -> local path (relative to GIT_REPOS_BASE)
const REPO_LOCAL_PATHS: Record<string, string> = {
  [`${GIT_ORG}/skunkcrm-pro`]:       'plugins/skunkcrm-pro',
  [`${GIT_ORG}/skunkforms-plugin`]:   'plugins/skunkforms',
  [`${GIT_ORG}/skunkpages-plugin`]:   'plugins/skunkpages',
  [`${GIT_ORG}/skunkcrm`]:            'plugins/skunkcrm',
};

function localPathForRepo(repo: string): string | null {
  if (!GIT_REPOS_BASE) return null;
  const slug = repo.split('/')[1];
  const override = REPO_LOCAL_PATHS[repo];
  const localPath = path.join(GIT_REPOS_BASE, override || slug);
  if (fs.existsSync(path.join(localPath, '.git'))) return localPath;
  return null;
}

export async function GET() {
  const commitsByDay: Record<string, number> = {};

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const since = oneYearAgo.toISOString().split('T')[0];

  for (const repo of REPOS) {
    const localPath = localPathForRepo(repo);

    if (localPath) {
      // Fast path: local git log — complete history, all branches, no rate limits
      try {
        const output = execSync(
          `git -C "${localPath}" log --all --format="%ad" --date=short --after="${since}" 2>/dev/null`,
          { encoding: 'utf-8', timeout: 10000 }
        );
        for (const line of output.split('\n')) {
          const date = line.trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            commitsByDay[date] = (commitsByDay[date] || 0) + 1;
          }
        }
      } catch (e) {
        console.error(`Local git log failed for ${localPath}:`, e);
      }
    } else {
      // GitHub API fallback — works anywhere with gh CLI authenticated
      try {
        const output = execSync(
          `gh api "repos/${repo}/commits?since=${since}T00:00:00Z&per_page=100" --paginate 2>/dev/null`,
          { encoding: 'utf-8', timeout: 20000 }
        );
        let commits: Array<{ commit?: { author?: { date?: string } } }> = [];
        try {
          const parsed = JSON.parse(output.trim());
          commits = Array.isArray(parsed) ? parsed : [];
        } catch {
          for (const line of output.trim().split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const chunk = JSON.parse(trimmed);
              if (Array.isArray(chunk)) commits = commits.concat(chunk);
            } catch { /* skip */ }
          }
        }
        for (const commit of commits) {
          const date = commit.commit?.author?.date?.split('T')[0];
          if (date) commitsByDay[date] = (commitsByDay[date] || 0) + 1;
        }
      } catch (e) {
        console.error(`GitHub API failed for ${repo}:`, e);
      }
    }
  }

  return NextResponse.json({ commitsByDay });
}
