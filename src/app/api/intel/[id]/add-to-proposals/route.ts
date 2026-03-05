import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getIntelItemById, createWorkProposal, getAllWorkProposals, markIntelRead } from '@/lib/db';
import { randomUUID } from 'crypto';

/**
 * POST /api/intel/[id]/add-to-proposals
 * Create a new work proposal from an intel item
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    
    // Get the intel item
    const intel = getIntelItemById(id);
    if (!intel) {
      return NextResponse.json({ error: 'Intel item not found' }, { status: 404 });
    }

    // Check if this intel item already has a proposal
    const existingProposals = getAllWorkProposals();
    const existingProposal = existingProposals.find(p => p.intel_id === id);
    if (existingProposal) {
      return NextResponse.json({ 
        error: 'Proposal already exists for this intel item',
        existing_proposal_id: existingProposal.id 
      }, { status: 409 });
    }

    // Create title based on intel category and summary
    const categoryPrefix = {
      competitor: 'Research',
      opportunity: 'Investigate',
      market: 'Research',
      seo: 'SEO',
      wordpress: 'Explore',
      keyword: 'Target'
    }[intel.category] || 'Investigate';

    // Create brief summary for title (max 80 chars)
    const briefSummary = intel.title.length > 50 
      ? intel.title.substring(0, 47) + '...' 
      : intel.title;
    
    const proposalTitle = `${categoryPrefix}: ${briefSummary}`;

    // Create the work proposal
    const proposalId = randomUUID();
    const proposal = {
      id: proposalId,
      linear_issue_id: null,
      linear_identifier: null,
      linear_url: null,
      title: proposalTitle,
      why: intel.summary,
      effort: 'medium' as const,
      repo: null,
      status: 'idea' as const,
      branch_name: null,
      pr_url: null,
      pr_number: null,
      notes: intel.url ? `Source: ${intel.url}` : null,
      intel_id: intel.id,
      source: 'intel',
      category: 'uncategorised' as const,
    };

    createWorkProposal(proposal);

    // Mark the intel item as read
    markIntelRead(id);

    return NextResponse.json({ 
      success: true, 
      proposal: { 
        ...proposal, 
        proposed_at: Date.now() 
      }
    });

  } catch (error) {
    console.error('Failed to create proposal from intel:', error);
    return NextResponse.json({ 
      error: 'Failed to create proposal' 
    }, { status: 500 });
  }
}
