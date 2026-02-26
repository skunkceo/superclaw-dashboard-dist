import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { getCurrentUser } from '@/lib/auth';
import { getCronJobsPaths } from '@/lib/workspace';

// This updates the cron jobs file directly
// OpenClaw will pick up changes on next heartbeat/restart

function getCronFilePath(): string | null {
  for (const p of getCronJobsPaths()) {
    if (existsSync(p)) return p;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { jobId, updates } = body;

  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  const cronPath = getCronFilePath();
  if (!cronPath) {
    return NextResponse.json({ error: 'Cron jobs file not found' }, { status: 404 });
  }

  try {
    // Read existing jobs
    const data = JSON.parse(readFileSync(cronPath, 'utf8'));
    const jobs = data.jobs || [];

    // Find the job to update
    const jobIndex = jobs.findIndex((j: any) => j.id === jobId || j.jobId === jobId);
    if (jobIndex === -1) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const job = jobs[jobIndex];

    // Apply updates
    if (updates.name !== undefined) {
      job.name = updates.name;
    }

    if (updates.description !== undefined) {
      // Update the payload message/text
      if (!job.payload) job.payload = {};
      if (job.payload.kind === 'systemEvent') {
        job.payload.text = updates.description;
      } else if (job.payload.kind === 'agentTurn') {
        job.payload.message = updates.description;
      }
    }

    if (updates.schedule !== undefined) {
      // Parse schedule string back to schedule object
      const scheduleStr = updates.schedule.trim();
      
      if (scheduleStr.toLowerCase().startsWith('every ')) {
        // Parse "Every 30m" or "Every 2h"
        const match = scheduleStr.match(/every\s+(\d+)(m|h)/i);
        if (match) {
          const value = parseInt(match[1]);
          const unit = match[2].toLowerCase();
          const everyMs = unit === 'h' ? value * 60 * 60 * 1000 : value * 60 * 1000;
          job.schedule = {
            kind: 'every',
            everyMs,
          };
        }
      } else if (scheduleStr.includes(' ') || scheduleStr.includes('*')) {
        // Looks like a cron expression
        job.schedule = {
          kind: 'cron',
          expr: scheduleStr,
          tz: job.schedule?.tz || 'Europe/London',
        };
      }
    }

    if (updates.enabled !== undefined) {
      job.enabled = updates.enabled;
    }

    if (updates.model !== undefined) {
      if (!job.payload) job.payload = {};
      job.payload.model = updates.model || undefined;
    }

    // Write back to file
    jobs[jobIndex] = job;
    data.jobs = jobs;
    writeFileSync(cronPath, JSON.stringify(data, null, 2));

    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error('Failed to update cron job:', error);
    return NextResponse.json({ error: 'Failed to update job' }, { status: 500 });
  }
}
