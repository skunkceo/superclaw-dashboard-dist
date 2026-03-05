import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getWorkProposalById, updateWorkProposal } from '@/lib/db';
import { getStateIdByType, updateLinearIssueState } from '@/lib/linear';

/**
 * PATCH /api/bridge/proposals/:id
 * Update a work proposal
 * Body: {
 *   action: 'add_to_backlog' | 'queue' | 'unqueue' | 'start' | 'mark_review' | 'mark_complete' | 'reject' | 'move_to_ideas',
 *   branch_name?, pr_url?, pr_number?, notes?
 * }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, branch_name, pr_url, pr_number, notes } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    const proposal = getWorkProposalById(id);
    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    const updates: Record<string, any> = {};

    switch (action) {
      case 'add_to_backlog':
        updates.status = 'backlog';
        break;

      case 'queue':
        updates.status = 'queued';
        updates.approved_at = Date.now();
        break;

      case 'unqueue':
        updates.status = 'backlog';
        updates.approved_at = null;
        break;

      case 'move_to_ideas':
        updates.status = 'idea';
        break;

      case 'start':
        updates.status = 'in_progress';
        if (branch_name) updates.branch_name = branch_name;
        break;

      case 'mark_review':
        updates.status = 'in_review';
        if (pr_url) updates.pr_url = pr_url;
        if (pr_number) updates.pr_number = pr_number;
        break;

      case 'mark_complete':
        updates.status = 'completed';
        updates.completed_at = Date.now();
        if (pr_url) updates.pr_url = pr_url;
        if (pr_number) updates.pr_number = pr_number;
        break;

      case 'reject':
        updates.status = 'rejected';
        updates.rejected_at = Date.now();
        // Close the Linear issue if connected
        if (proposal.linear_issue_id) {
          try {
            const cancelledStateId = await getStateIdByType('cancelled');
            if (cancelledStateId) {
              await updateLinearIssueState(proposal.linear_issue_id, cancelledStateId);
            }
          } catch (err) {
            console.error('Failed to close Linear issue on reject:', err);
            // Non-fatal — still mark rejected in DB
          }
        }
        break;

      case 'dismiss':
        updates.status = 'dismissed';
        updates.rejected_at = Date.now();
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Apply optional fields
    if (notes !== undefined) updates.notes = notes;
    if (branch_name !== undefined && !updates.branch_name) updates.branch_name = branch_name;
    if (pr_url !== undefined && !updates.pr_url) updates.pr_url = pr_url;
    if (pr_number !== undefined && !updates.pr_number) updates.pr_number = pr_number;

    updateWorkProposal(id, updates);

    const updatedProposal = getWorkProposalById(id);
    return NextResponse.json({ success: true, proposal: updatedProposal });
  } catch (error) {
    console.error('Failed to update work proposal:', error);
    return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 });
  }
}
