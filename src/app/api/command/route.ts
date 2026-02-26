import { NextResponse } from 'next/server';
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { getCurrentUser, needsSetup } from '@/lib/auth';
import { getCronJobsPaths } from '@/lib/workspace';

export async function GET() {
  // Skip auth check if setup is needed
  if (!needsSetup()) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Connect to marketing DB (command centre)
    const dbPath = join(os.homedir(), 'apps/websites/growth-marketing/marketing.db');
    const db = existsSync(dbPath) ? new Database(dbPath) : null;

    // Get tasks from cc_tasks
    const tasks = db ? db.prepare(`
      SELECT id, title, description, priority, status, product, area, assigned_to as assigned_agent, created_at
      FROM cc_tasks
      WHERE status IN ('backlog', 'in_progress')
      ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 0 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'low' THEN 3 
        END,
        created_at ASC
      LIMIT 50
    `).all() : [];

    // Get recurring tasks from cron jobs file
    let recurring = [];
    try {
      const cronPaths = getCronJobsPaths();
      
      for (const cronPath of cronPaths) {
        if (existsSync(cronPath)) {
          const data = JSON.parse(readFileSync(cronPath, 'utf8'));
          recurring = (data.jobs || []).map((job: any) => {
            const schedule = job.schedule || {};
            const payload = job.payload || {};
            let scheduleStr = 'unknown';
            
            if (schedule.kind === 'cron') {
              scheduleStr = schedule.expr || 'unknown';
            } else if (schedule.kind === 'every') {
              const mins = Math.round((schedule.everyMs || 0) / 60000);
              scheduleStr = mins < 60 ? `Every ${mins}m` : `Every ${Math.round(mins / 60)}h`;
            } else if (schedule.kind === 'at') {
              scheduleStr = `Once at ${schedule.at}`;
            }
            
            return {
              id: job.id || job.jobId,
              name: job.name || payload.message?.substring(0, 50) || job.id || 'Unnamed',
              schedule: scheduleStr,
              enabled: job.enabled !== false,
              nextRun: job.state?.nextRunAtMs ? new Date(job.state.nextRunAtMs).toLocaleString() : null,
              description: payload.message || payload.text || '',
              model: payload.model || null,
            };
          });
          break;
        }
      }
    } catch (err) {
      console.error('Failed to read cron config:', err);
    }

    // Get reports from overlord directory
    const reports = [];
    const reportsDir = join(os.homedir(), 'apps/websites/growth-marketing/reports/overlord');
    if (existsSync(reportsDir)) {
      const files = readdirSync(reportsDir)
        .filter(f => f.endsWith('.mdx'))
        .map(f => {
          const path = join(reportsDir, f);
          const stats = statSync(path);
          return {
            name: f.replace('.mdx', '').replace(/-/g, ' '),
            date: stats.mtime.toLocaleDateString(),
            path: `/overlord/reports/${f.replace('.mdx', '')}`,
            size: stats.size,
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 20);
      reports.push(...files);
    }

    // Get agent definitions from database
    let agents: Array<{ id: string; name: string; role: string; skills: string[]; description?: string; enabled?: boolean }> = [];
    try {
      const superclawDataDir = process.env.SUPERCLAW_DATA_DIR || join(os.homedir(), '.superclaw');
      const superclawDb = new Database(join(superclawDataDir, 'superclaw.db'));
      const agentDefs = superclawDb.prepare('SELECT * FROM agent_definitions ORDER BY name').all();
      agents = agentDefs.map((a: any) => ({
        id: a.id,
        name: a.name,
        role: a.description || 'Specialist Agent',
        skills: JSON.parse(a.skills || '[]'),
        active: a.enabled === 1,
        color: a.color,
        icon: a.icon,
        soul: a.soul,
        handoff_rules: JSON.parse(a.handoff_rules || '[]'),
        spawn_count: a.spawn_count || 0,
      }));
      superclawDb.close();
    } catch (err) {
      console.error('Failed to load agent definitions:', err);
      // Fallback to empty array if DB fails
      agents = [];
    }

    // Close DB
    if (db) db.close();

    return NextResponse.json({
      tasks,
      recurring,
      reports,
      agents,
    });
  } catch (error) {
    console.error('Command API error:', error);
    return NextResponse.json({ error: 'Failed to load command data' }, { status: 500 });
  }
}
