import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getCurrentUser } from '@/lib/auth';
import { getCronJobsPaths } from '@/lib/workspace';

const slackChannels: Record<string, string> = {
  'c0abz068w22': '#dailies',
  'c0ac4jz0m44': '#marketing',
  'c0acv8y8ahw': '#dev',
  'c0abkhh98vd': '#product',
  'c0ac11g4n4a': '#support',
  'c0ac06rawg2': '#social',
  'c0advjb9eta': '#projects',
  'c0acbtvcway': '#progress',
  'c0afe1stjsv': '#superclaw',
};

function formatSchedule(schedule: any): string {
  if (typeof schedule === 'string') return schedule;
  if (!schedule) return 'unknown';
  if (schedule.kind === 'cron') return schedule.expr || 'unknown';
  if (schedule.kind === 'every') {
    const mins = Math.round((schedule.everyMs || 0) / 60000);
    return mins < 60 ? `Every ${mins}m` : `Every ${Math.round(mins / 60)}h`;
  }
  if (schedule.kind === 'at') return `Once at ${schedule.at}`;
  return JSON.stringify(schedule);
}

function mapJob(job: any) {
  const schedule = job.schedule || {};
  const payload = job.payload || {};
  const delivery = job.delivery || {};
  const state = job.state || {};
  const channelName = slackChannels[(delivery.channel || '').toLowerCase()] || delivery.channel || null;

  return {
    id: job.id || job.jobId,
    name: job.name || payload.message?.substring(0, 50) || job.id || 'Unnamed',
    schedule: formatSchedule(schedule),
    timezone: schedule.tz || null,
    description: payload.message || '',
    model: (payload.model || 'unknown').replace('claude-', '').replace('-20241022', '').replace('-20250514', ''),
    channel: channelName,
    enabled: job.enabled !== false,
    nextRun: state.nextRunAtMs ? new Date(state.nextRunAtMs).toISOString() : null,
    sessionTarget: job.sessionTarget || 'isolated',
  };
}

function getCronFilePath(): string | null {
  for (const p of getCronJobsPaths()) {
    if (existsSync(p)) return p;
  }
  return null;
}

function readJobsFromFile(): any[] {
  const cronPath = getCronFilePath();
  if (!cronPath) return [];
  try {
    const data = JSON.parse(readFileSync(cronPath, 'utf8'));
    return (data.jobs || []).map(mapJob);
  } catch { return []; }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Read directly from file — gateway doesn't expose a /cron REST endpoint
  const jobs = readJobsFromFile();
  return NextResponse.json({ jobs });
}

// PATCH — update a job's name, description/prompt, schedule, model, enabled
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { jobId?: string; name?: string; description?: string; schedule?: string; model?: string; enabled?: boolean } = {};
  try { body = await request.json(); } catch { /* ignore */ }

  const { jobId } = body;
  if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 });

  const cronPath = getCronFilePath();
  if (!cronPath) return NextResponse.json({ error: 'Cron file not found' }, { status: 404 });

  try {
    const raw = JSON.parse(readFileSync(cronPath, 'utf8'));
    const jobs: any[] = raw.jobs || [];
    const idx = jobs.findIndex((j: any) => (j.id || j.jobId) === jobId);
    if (idx === -1) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    const job = { ...jobs[idx] };

    if (body.name !== undefined) job.name = body.name;
    if (body.enabled !== undefined) job.enabled = body.enabled;

    if (body.description !== undefined) {
      if (!job.payload) job.payload = {};
      if (job.payload.kind === 'systemEvent') {
        job.payload.text = body.description;
      } else {
        job.payload.message = body.description;
      }
    }

    if (body.model !== undefined) {
      if (!job.payload) job.payload = {};
      job.payload.model = body.model || undefined;
    }

    if (body.schedule !== undefined) {
      const schedStr = body.schedule.trim();
      const everyMatch = schedStr.match(/^every\s+(\d+)(m|h)$/i);
      if (everyMatch) {
        const val = parseInt(everyMatch[1]);
        const unit = everyMatch[2].toLowerCase();
        job.schedule = { kind: 'every', everyMs: unit === 'h' ? val * 3600000 : val * 60000 };
      } else {
        job.schedule = { kind: 'cron', expr: schedStr, tz: job.schedule?.tz || 'Europe/London' };
      }
    }

    job.updatedAtMs = Date.now();
    jobs[idx] = job;
    writeFileSync(cronPath, JSON.stringify({ ...raw, jobs }, null, 2));

    return NextResponse.json({ success: true, job: mapJob(job) });
  } catch (err) {
    console.error('Cron PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }
}

// POST — toggle a job's enabled state
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { jobId?: string; enabled?: boolean } = {};
  try { body = await request.json(); } catch { /* ignore */ }

  const { jobId, enabled } = body;
  if (!jobId || enabled === undefined) {
    return NextResponse.json({ error: 'jobId and enabled are required' }, { status: 400 });
  }

  const cronPath = getCronFilePath();
  if (!cronPath) return NextResponse.json({ error: 'Cron file not found' }, { status: 404 });

  try {
    const raw = JSON.parse(readFileSync(cronPath, 'utf8'));
    const jobs: any[] = raw.jobs || [];
    const idx = jobs.findIndex((j: any) => (j.id || j.jobId) === jobId);
    if (idx === -1) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    jobs[idx] = { ...jobs[idx], enabled, updatedAtMs: Date.now() };
    writeFileSync(cronPath, JSON.stringify({ ...raw, jobs }, null, 2));

    return NextResponse.json({ success: true, jobId, enabled });
  } catch (err) {
    console.error('Cron toggle error:', err);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }
}

