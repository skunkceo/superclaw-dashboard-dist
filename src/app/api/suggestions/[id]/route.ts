import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSuggestionById, updateSuggestion, deleteSuggestion } from '@/lib/db';
import { getStateIdByType, updateLinearIssueState } from '@/lib/linear';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const suggestion = getSuggestionById(id);
  if (!suggestion) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ suggestion });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const suggestion = getSuggestionById(id);
  if (!suggestion) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const body = await request.json();
    const allowedFields = ['status', 'priority', 'notes', 'report_id'];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field];
    }

    // Track when status changes
    if (updates.status && updates.status !== suggestion.status) {
      updates.actioned_at = Date.now();
    }

    // If dismissing and connected to Linear, cancel the issue
    if (updates.status === 'dismissed' && suggestion.linear_issue_id) {
      try {
        const cancelledStateId = await getStateIdByType('cancelled');
        if (cancelledStateId) {
          await updateLinearIssueState(suggestion.linear_issue_id, cancelledStateId);
        }
      } catch (err) {
        console.error('Failed to close Linear issue on dismiss:', err);
        // Non-fatal — still update local status
      }
    }

    updateSuggestion(id, updates);
    const updated = getSuggestionById(id);
    return NextResponse.json({ success: true, suggestion: updated });
  } catch {
    return NextResponse.json({ error: 'Failed to update suggestion' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  deleteSuggestion(id);
  return NextResponse.json({ success: true });
}
