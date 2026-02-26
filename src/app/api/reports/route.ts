import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllReports, createReport } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;

  const reports = getAllReports({ type, limit });
  return NextResponse.json({ reports });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { title, type, content, suggestion_id, overnight_run_id } = body;

    if (!title || !type || !content) {
      return NextResponse.json({ error: 'title, type, and content are required' }, { status: 400 });
    }

    const report = {
      id: uuidv4(),
      title,
      type,
      content,
      suggestion_id: suggestion_id || null,
      overnight_run_id: overnight_run_id || null,
    };

    createReport(report);
    return NextResponse.json({ success: true, report: { ...report, created_at: Date.now() } });
  } catch {
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 });
  }
}
