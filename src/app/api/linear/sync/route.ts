import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSuggestionsWithoutLinear, updateSuggestionLinear } from '@/lib/db';
import { createLinearIssue, getCategoryLabelId, mapPriorityToLinear } from '@/lib/linear';

export async function POST() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const suggestions = getSuggestionsWithoutLinear();
    let synced = 0;
    let failed = 0;

    for (const sug of suggestions) {
      const labelIds: string[] = [];
      const categoryLabelId = await getCategoryLabelId(sug.category);
      if (categoryLabelId) labelIds.push(categoryLabelId);

      const proactivityLabelId = await getCategoryLabelId('proactivity');
      if (proactivityLabelId) labelIds.push(proactivityLabelId);

      const issue = await createLinearIssue({
        title: sug.title,
        description: `**Why:** ${sug.why}\n\n**Effort:** ${sug.effort} | **Impact:** ${sug.impact}\n\n---\n*Auto-created from Superclaw Proactivity*`,
        priority: mapPriorityToLinear(sug.priority),
        labelIds,
      });

      if (issue) {
        updateSuggestionLinear(sug.id, issue.id, issue.identifier, issue.url);
        synced++;
      } else {
        failed++;
      }

      // Rate limit: wait 200ms between creations
      await new Promise(r => setTimeout(r, 200));
    }

    return NextResponse.json({
      success: true,
      synced,
      failed,
      total: suggestions.length,
    });
  } catch (err) {
    console.error('Failed to sync to Linear:', err);
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 });
  }
}
