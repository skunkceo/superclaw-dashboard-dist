import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllWorkProposals, createWorkProposal, WorkProposal } from '@/lib/db';
import { randomUUID } from 'crypto';

/**
 * GET /api/bridge/proposals?status=idea|backlog|queued|in_progress|in_review|completed|rejected
 * Returns proposals grouped by status or filtered by status
 */
export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const status = request.nextUrl.searchParams.get('status');
    const category = request.nextUrl.searchParams.get('category');
    
    if (status || category) {
      const filters: { status?: string; category?: string } = {};
      if (status) filters.status = status;
      if (category) filters.category = category;
      const proposals = getAllWorkProposals(filters);
      return NextResponse.json({ proposals });
    }
    
    // Return all proposals grouped by status
    const idea = getAllWorkProposals({ status: 'idea' });
    const backlog = getAllWorkProposals({ status: 'backlog' });
    const queued = getAllWorkProposals({ status: 'queued' });
    const inProgress = getAllWorkProposals({ status: 'in_progress' });
    const inReview = getAllWorkProposals({ status: 'in_review' });
    const completed = getAllWorkProposals({ status: 'completed' });
    const rejected = getAllWorkProposals({ status: 'rejected' });
    
    return NextResponse.json({
      idea,
      backlog,
      queued,
      in_progress: inProgress,
      in_review: inReview,
      completed,
      rejected,
    });
  } catch (error) {
    console.error('Failed to fetch work proposals:', error);
    return NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 });
  }
}

/**
 * POST /api/bridge/proposals
 * Create a new work proposal
 * Body: { linear_issue_id?, linear_identifier?, linear_url?, title, why?, effort?, repo?, status? }
 */
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      linear_issue_id,
      linear_identifier,
      linear_url,
      title,
      why,
      effort = 'medium',
      repo,
      status = 'idea',
      notes,
      intel_id,
      source = 'manual',
    } = body;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const id = randomUUID();
    const proposal: Omit<WorkProposal, 'proposed_at' | 'approved_at' | 'completed_at' | 'rejected_at'> = {
      id,
      linear_issue_id: linear_issue_id || null,
      linear_identifier: linear_identifier || null,
      linear_url: linear_url || null,
      title,
      why: why || null,
      effort: effort as 'low' | 'medium' | 'high',
      repo: repo || null,
      status: status as WorkProposal['status'],
      branch_name: null,
      pr_url: null,
      pr_number: null,
      notes: notes || null,
      intel_id: intel_id || null,
      source: source,
      category: (body.category || 'uncategorised') as WorkProposal['category'],
    };

    createWorkProposal(proposal);

    return NextResponse.json({ success: true, proposal: { ...proposal, proposed_at: Date.now() } });
  } catch (error) {
    console.error('Failed to create work proposal:', error);
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 });
  }
}
