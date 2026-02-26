import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { markIntelRead, archiveIntelItem, getIntelItemById, createSuggestion, updateSuggestionLinear } from '@/lib/db';
import { createLinearIssue, getCategoryLabelId, mapPriorityToLinear } from '@/lib/linear';
import { v4 as uuidv4 } from 'uuid';
import db from '@/lib/db';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { action } = body as { action?: string };

  if (action === 'read') {
    markIntelRead(id);
    return NextResponse.json({ success: true });
  }

  if (action === 'archive') {
    archiveIntelItem(id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  db.prepare('DELETE FROM intel_items WHERE id = ?').run(id);
  return NextResponse.json({ success: true });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { action, title } = body as { action?: string; title?: string };

  if (action === 'create_task') {
    const intel = getIntelItemById(id);
    if (!intel) return NextResponse.json({ error: 'Intel item not found' }, { status: 404 });

    const taskTitle = title || `Task: ${intel.title.slice(0, 80)}`;

    // Create suggestion from intel
    const suggestionId = uuidv4();
    const category = intel.category === 'competitor' ? 'research' :
                     intel.category === 'seo' ? 'content' :
                     intel.category === 'opportunity' ? 'marketing' :
                     intel.category === 'market' ? 'research' : 'research';

    createSuggestion({
      id: suggestionId,
      title: taskTitle,
      why: `Created from intel: "${intel.summary.slice(0, 200)}"`,
      effort: 'medium',
      impact: 'medium',
      impact_score: intel.relevance_score,
      category: category as 'content' | 'seo' | 'code' | 'marketing' | 'research' | 'product',
      source_intel_ids: JSON.stringify([intel.id]),
      status: 'pending',
      priority: 2,
      notes: null,
      linear_issue_id: null,
      linear_identifier: null,
      linear_url: null,
    });

    // Create Linear issue
    const labelIds: string[] = [];
    const categoryLabelId = await getCategoryLabelId(category);
    if (categoryLabelId) labelIds.push(categoryLabelId);
    const proactivityLabelId = await getCategoryLabelId('proactivity');
    if (proactivityLabelId) labelIds.push(proactivityLabelId);

    const linearIssue = await createLinearIssue({
      title: taskTitle,
      description: `**Source:** Intel item\n\n**Summary:** ${intel.summary}\n\n**URL:** ${intel.url || 'N/A'}\n\n---\n*Auto-created from Superclaw Proactivity*`,
      priority: mapPriorityToLinear(2),
      labelIds,
    });

    if (linearIssue) {
      updateSuggestionLinear(suggestionId, linearIssue.id, linearIssue.identifier, linearIssue.url);
    }

    // Mark intel as read
    markIntelRead(id);

    return NextResponse.json({
      success: true,
      suggestion_id: suggestionId,
      linear_issue: linearIssue,
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
