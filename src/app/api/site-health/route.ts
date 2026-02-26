import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

const SITES = [
  { name: 'skunkcrm.com',           url: 'https://skunkcrm.com' },
  { name: 'skunkforms.com',         url: 'https://skunkforms.com' },
  { name: 'skunkpages.com',         url: 'https://skunkpages.com' },
  { name: 'skunkglobal.com',        url: 'https://skunkglobal.com' },
  { name: 'marketing.skunkglobal.com', url: 'https://marketing.skunkglobal.com' },
  { name: 'status.skunkglobal.com', url: 'https://status.skunkglobal.com' },
];

async function checkSite(site: { name: string; url: string }) {
  const start = Date.now();
  try {
    const res = await fetch(site.url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    const ms = Date.now() - start;
    const ok = res.status < 400;
    return { name: site.name, status: res.status, ok, ms };
  } catch {
    const ms = Date.now() - start;
    return { name: site.name, status: 0, ok: false, ms };
  }
}

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const results = await Promise.all(SITES.map(checkSite));
  const allOk = results.every(r => r.ok);
  return NextResponse.json({ sites: results, allOk, checkedAt: Date.now() });
}
