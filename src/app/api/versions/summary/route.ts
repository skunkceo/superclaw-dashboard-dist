import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getCurrentUser } from '@/lib/auth';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getVersionSummary, saveVersionSummary } from '@/lib/db';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { notes, product, version } = body as {
    notes: string;
    product: string;
    version: string;
  };

  if (!notes || !product) {
    return NextResponse.json({ error: 'Missing notes or product' }, { status: 400 });
  }

  // Return cached summary if we already generated one for this product+version
  const cached = getVersionSummary(product, version);
  if (cached) {
    return NextResponse.json({ summary: cached, cached: true });
  }

  // Truncate to avoid excessively long prompts
  const truncated = notes.slice(0, 4000);

  const prompt = `You are summarising a software release for a developer dashboard.

Product: ${product}
Version: ${version}

Release notes:
---
${truncated}
---

Write a short, plain-English summary of what's new or changed in this release. 2-4 sentences max. No bullet points. No markdown. No hype. Just what changed and why it matters.`;

  const promptId = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const promptFile = join(tmpdir(), `sc-summary-${promptId}.txt`);
  writeFileSync(promptFile, prompt);

  let summary = '';
  try {
    const { stdout } = await execAsync(`claude --print < "${promptFile}"`, {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      shell: '/bin/bash',
    });
    summary = stdout.trim();
  } catch (err) {
    console.error('Claude summary error:', err);
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  } finally {
    try { unlinkSync(promptFile); } catch { /* ignore */ }
  }

  // Cache it so we never generate it again for this version
  saveVersionSummary(product, version, summary);

  return NextResponse.json({ summary, cached: false });
}
