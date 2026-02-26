import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOpenLinearIssues } from '@/lib/linear';
import { getAllWorkProposals, createWorkProposal, WorkProposal } from '@/lib/db';
import { randomUUID } from 'crypto';

/**
 * POST /api/bridge/proposals/generate
 * Auto-generate work proposals from Linear AI team backlog
 * Reads Linear AI team issues (status: Todo/Backlog, priority 1-3)
 * Creates proposals for issues not already tracked
 */
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch Linear issues (Todo/Backlog)
    const issues = await getOpenLinearIssues();
    
    // Filter for backlog/unstarted issues with priority 1-3
    const candidateIssues = issues.filter((issue: any) => {
      const stateType = issue.stateType || issue.state?.type || '';
      const priority = issue.priority || 0;
      
      return (
        (stateType === 'backlog' || stateType === 'unstarted') &&
        priority >= 1 &&
        priority <= 3
      );
    });

    // Get existing proposals to avoid duplicates
    const existingProposals = getAllWorkProposals();
    const existingLinearIds = new Set(
      existingProposals
        .map(p => p.linear_issue_id)
        .filter((id): id is string => id !== null)
    );

    let created = 0;

    for (const issue of candidateIssues) {
      // Skip if already tracked
      if (existingLinearIds.has(issue.id)) {
        continue;
      }

      // Determine effort based on priority (rough heuristic)
      let effort: 'low' | 'medium' | 'high' = 'medium';
      if (issue.priority === 1) effort = 'high';
      if (issue.priority >= 3) effort = 'low';

      // Extract repo from description or labels (if available)
      let repo: string | null = null;
      const description = issue.description || '';
      if (description.includes('skunkcrm.com')) repo = 'skunkcrm.com';
      if (description.includes('skunkforms.com')) repo = 'skunkforms.com';
      if (description.includes('skunkpages.com')) repo = 'skunkpages.com';
      if (description.includes('superclaw')) repo = 'superclaw-dashboard';

      const proposal: Omit<WorkProposal, 'proposed_at' | 'approved_at' | 'completed_at' | 'rejected_at'> = {
        id: randomUUID(),
        linear_issue_id: issue.id,
        linear_identifier: issue.identifier,
        linear_url: issue.url,
        title: issue.title,
        why: description.substring(0, 200) || null, // First 200 chars of description as "why"
        effort,
        repo,
        status: 'proposed',
        branch_name: null,
        pr_url: null,
        pr_number: null,
        notes: null,
      };

      createWorkProposal(proposal);
      created++;
    }

    return NextResponse.json({
      success: true,
      created,
      total: candidateIssues.length,
      message: `Created ${created} new proposal(s) from Linear backlog`,
    });
  } catch (error) {
    console.error('Failed to generate proposals:', error);
    return NextResponse.json({ error: 'Failed to generate proposals' }, { status: 500 });
  }
}
