import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Find npm dynamically — works on Mac, Linux, NVM installs, etc.
async function findNpm(): Promise<string> {
  // Try the npm that launched this process first (most reliable with NVM)
  if (process.env.npm_execpath) {
    // npm_execpath points to npm-cli.js, get the bin dir
    const npmBin = process.env.npm_execpath.replace(/npm-cli\.js$/, 'npm');
    try {
      await execAsync(`"${npmBin}" --version`);
      return `"${npmBin}"`;
    } catch {}
  }

  // Walk up from node executable
  const nodeBin = process.execPath;
  const npmCandidate = nodeBin.replace(/[/\\]node$/, '/npm');
  try {
    await execAsync(`"${npmCandidate}" --version`);
    return `"${npmCandidate}"`;
  } catch {}

  // Fall back to PATH
  const { stdout } = await execAsync('which npm || command -v npm');
  return stdout.trim();
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get current version before update
    const { stdout: versionBefore } = await execAsync('openclaw --version').catch(() => ({ stdout: 'unknown' }));
    const currentVersion = versionBefore.trim();

    // Find npm dynamically — works on any OS / NVM setup
    const npm = await findNpm();

    // Run the update
    const { stderr: updateStderr } = await execAsync(
      `${npm} update -g openclaw`,
      { timeout: 120000 }
    );

    if (updateStderr && updateStderr.includes('npm ERR!')) {
      throw new Error(updateStderr);
    }

    // Get new version
    const { stdout: versionAfter } = await execAsync('openclaw --version').catch(() => ({ stdout: currentVersion }));
    const newVersion = versionAfter.trim();

    const updated = newVersion !== currentVersion;

    // Respond before restarting
    const response = NextResponse.json({
      success: true,
      message: updated
        ? `Updated from ${currentVersion} to ${newVersion}. Gateway restarting...`
        : `Already on latest version (${currentVersion}).`,
      oldVersion: currentVersion,
      newVersion: newVersion,
      restarting: updated
    });

    // Fire-and-forget restart only if version changed
    if (updated) {
      setImmediate(() => {
        // Try openclaw gateway restart first (works everywhere)
        exec('openclaw gateway restart', (err) => {
          if (err) {
            // Fall back to pm2 on server
            const pm2Path = process.env.PM2_PATH || `${require('os').homedir()}/.nvm/versions/node/v24.13.0/bin/pm2`;
            const user = process.env.OPENCLAW_USER || process.env.USER;
            exec(`sudo -u ${user} ${pm2Path} restart clawdbot 2>/dev/null || pm2 restart clawdbot 2>/dev/null || true`, () => {});
          }
        });
      });
    }

    return response;
  } catch (error: any) {
    console.error('Gateway update failed:', error);

    // Surface the real error so it can be debugged
    const rawError = error.stderr || error.message || 'Unknown error';

    let userMessage = 'Update failed. Please try again or update manually.';
    if (rawError.includes('EACCES') || rawError.includes('permission')) {
      userMessage = 'Permission error. Try running: sudo npm update -g openclaw';
    } else if (rawError.includes('timeout') || error.message?.includes('timeout')) {
      userMessage = 'Update timed out. Check your connection and try again.';
    } else if (rawError.includes('npm ERR!')) {
      userMessage = `npm error: ${rawError.split('\n')[0]}`;
    } else if (rawError.includes('npm: command not found') || rawError.includes('which npm')) {
      userMessage = 'npm not found. Update manually: npm update -g openclaw';
    }

    return NextResponse.json({
      success: false,
      message: userMessage,
      debug: rawError.slice(0, 500) // Include first 500 chars of error for debugging
    }, { status: 500 });
  }
}
