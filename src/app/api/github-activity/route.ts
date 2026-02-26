import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const TRACKED_REPOS = [
  'skunkceo/superclaw-dashboard',
  'skunkceo/skunkcrm-pro-plugin',
  'skunkceo/skunkforms-plugin',
  'skunkceo/skunkpages-free-plugin',
  'skunkceo/skunkglobal.com',
  'skunkceo/skunkcrm.com',
  'skunkceo/skunkforms.com',
];

interface PRItem {
  repo: string;
  number: number;
  title: string;
  state: string;
  url: string;
  createdAt: string;
  author: string;
}

async function getRecentPRs(repo: string): Promise<PRItem[]> {
  try {
    const { stdout } = await execAsync(
      `gh pr list --repo ${repo} --limit 3 --state all --json number,title,state,url,createdAt,author`,
      { timeout: 8000 }
    );
    const prs = JSON.parse(stdout || '[]');
    return prs.map((pr: any) => ({
      repo: repo.split('/')[1],
      number: pr.number,
      title: pr.title,
      state: pr.state,
      url: pr.url,
      createdAt: pr.createdAt,
      author: pr.author?.login || 'unknown',
    }));
  } catch {
    return [];
  }
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const allPRs = await Promise.all(TRACKED_REPOS.map(getRecentPRs));
    const prs = allPRs
      .flat()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);

    return NextResponse.json({ prs, fetchedAt: Date.now() });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch GitHub activity' }, { status: 500 });
  }
}
