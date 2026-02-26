import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAllWorkProposals, createWorkProposal, WorkProposal } from '@/lib/db';
import { randomUUID } from 'crypto';

/**
 * GET /api/bridge/proposals?status=proposed|approved|in_progress|done|rejected
 * Returns proposals grouped by status or filtered by status
 */
export async function GET(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const status = request.nextUrl.searchParams.get('status');
    
    let proposals: WorkProposal[];
    if (status) {
      proposals = getAllWorkProposals({ status });
    } else {
      // Return all active proposals (proposed + approved + in_progress)
      const proposed = getAllWorkProposals({ status: 'proposed' });
      const approved = getAllWorkProposals({ status: 'approved' });
      const inProgress = getAllWorkProposals({ status: 'in_progress' });
      
      return NextResponse.json({
        proposed,
        approved,
        in_progress: inProgress,
      });
    }

    return NextResponse.json({ proposals });
  } catch (error) {
    console.error('Failed to fetch work proposals:', error);
    return NextResponse.json({ error: 'Failed to fetch proposals' }, { status: 500 });
  }
}

/**
 * POST /api/bridge/proposals
 * Create a new work proposal
 * Body: { linear_issue_id?, linear_identifier?, linear_url?, title, why?, effort?, repo? }
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
      notes,
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
      status: 'proposed',
      branch_name: null,
      pr_url: null,
      pr_number: null,
      notes: notes || null,
    };

    createWorkProposal(proposal);

    return NextResponse.json({ success: true, proposal: { ...proposal, proposed_at: Date.now() } });
  } catch (error) {
    console.error('Failed to create work proposal:', error);
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 });
  }
}
