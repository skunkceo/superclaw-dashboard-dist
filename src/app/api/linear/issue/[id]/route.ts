import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateLinearIssueState, getStateIdByType } from '@/lib/linear';

/**
 * PATCH /api/linear/issue/[id]
 * Update the issue state in Linear.
 * Body: { stateType: 'started' | 'completed' | 'unstarted' | 'backlog' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role === 'view') {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { stateType } = body;

    if (!stateType || typeof stateType !== 'string') {
      return NextResponse.json({ error: 'stateType is required' }, { status: 400 });
    }

    // Map friendly names to Linear state types
    const stateTypeMap: Record<string, string> = {
      'started': 'started',
      'inProgress': 'started',
      'completed': 'completed',
      'done': 'completed',
      'todo': 'unstarted',
      'unstarted': 'unstarted',
      'backlog': 'backlog',
    };

    const linearStateType = stateTypeMap[stateType];
    if (!linearStateType) {
      return NextResponse.json(
        { error: `Invalid stateType: ${stateType}` },
        { status: 400 }
      );
    }

    // Get the state ID for this type from the team's workflow
    const stateId = await getStateIdByType(linearStateType);
    if (!stateId) {
      return NextResponse.json(
        { error: `No state found for type: ${linearStateType}` },
        { status: 400 }
      );
    }

    // Update the issue state
    const success = await updateLinearIssueState(id, stateId);
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update issue state' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, stateType: linearStateType });
  } catch (err) {
    console.error('Failed to update Linear issue:', err);
    return NextResponse.json({ error: 'Failed to update issue' }, { status: 500 });
  }
}
