import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { getCurrentUser } from '@/lib/auth';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Kick off the restart in the background so the response goes out first
  setTimeout(() => {
    exec('openclaw gateway restart', (err) => {
      if (err) {
        // Fallback: SIGUSR1 to the parent process (Next.js dev) or pm2
        try {
          process.kill(process.ppid, 'SIGUSR1');
        } catch {
          exec('pm2 restart superclaw', () => {});
        }
      }
    });
  }, 500);

  return NextResponse.json({ success: true });
}
