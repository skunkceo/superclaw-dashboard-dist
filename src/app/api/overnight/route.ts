import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getProactivitySetting,
  setProactivitySetting,
  getActiveOvernightRun,
  getLatestOvernightRun,
  createOvernightRun,
  updateOvernightRun,
  getAllSuggestions,
} from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const enabled = getProactivitySetting('overnight_mode') === 'true';
  const startTime = getProactivitySetting('overnight_start_time') || '00:00';
  const endTime = getProactivitySetting('overnight_end_time') || '06:00';
  const activeRun = getActiveOvernightRun();
  const lastRun = getLatestOvernightRun();
  const queuedCount = getAllSuggestions({ status: 'queued' }).length;

  return NextResponse.json({
    enabled,
    startTime,
    endTime,
    activeRun: activeRun || null,
    lastRun: lastRun && lastRun.status !== 'running' ? lastRun : null,
    queuedCount,
  });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { action, startTime, endTime } = body as {
      action: 'start' | 'stop' | 'update_schedule';
      startTime?: string;
      endTime?: string;
    };

    if (action === 'start') {
      // Check if already running
      const active = getActiveOvernightRun();
      if (active) {
        return NextResponse.json({ error: 'Overnight run already active', run: active }, { status: 409 });
      }

      const queuedTasks = getAllSuggestions({ status: 'queued' });
      if (queuedTasks.length === 0) {
        return NextResponse.json({ error: 'No queued tasks. Move suggestions to the overnight queue first.' }, { status: 400 });
      }

      const runId = uuidv4();
      createOvernightRun(runId);
      setProactivitySetting('overnight_mode', 'true');
      setProactivitySetting('active_run_id', runId);

      return NextResponse.json({
        success: true,
        message: `Overnight run started — ${queuedTasks.length} task(s) queued`,
        runId,
        tasksQueued: queuedTasks.length,
      });
    }

    if (action === 'stop') {
      const active = getActiveOvernightRun();
      if (active) {
        updateOvernightRun(active.id, {
          status: 'stopped',
          completed_at: Date.now(),
          summary: 'Run manually stopped.',
        });
      }
      setProactivitySetting('overnight_mode', 'false');
      setProactivitySetting('active_run_id', '');
      return NextResponse.json({ success: true, message: 'Overnight mode stopped' });
    }

    if (action === 'update_schedule') {
      if (startTime) setProactivitySetting('overnight_start_time', startTime);
      if (endTime) setProactivitySetting('overnight_end_time', endTime);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
