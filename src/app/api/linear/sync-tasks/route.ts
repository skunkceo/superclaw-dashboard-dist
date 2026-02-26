import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { 
  getCCTasksWithoutLinear, 
  updateCCTaskLinear, 
  getCCTaskByLinearId,
  createCCTask,
  type CCTask 
} from '@/lib/db';
import { 
  createLinearIssue, 
  getCategoryLabelId, 
  getTeamWorkflowStates,
  getOpenLinearIssues,
  type LinearIssue
} from '@/lib/linear';

/**
 * Map cc_tasks priority to Linear priority.
 * critical → 1 (urgent), high → 2, medium → 3, low → 4
 */
function mapCCTaskPriorityToLinear(priority: string): number {
  switch (priority?.toLowerCase()) {
    case 'critical': return 1;
    case 'high': return 2;
    case 'medium': return 3;
    case 'low': return 4;
    default: return 3; // default to medium
  }
}

/**
 * Map Linear priority to cc_tasks priority.
 * 0/1 → critical, 2 → high, 3 → medium, 4 → low
 */
function mapLinearPriorityToCCTask(priority: number): string {
  if (priority <= 1) return 'critical';
  if (priority === 2) return 'high';
  if (priority === 3) return 'medium';
  return 'low';
}

/**
 * Map cc_tasks status to Linear state type.
 */
function mapCCTaskStatusToStateType(status: string): string {
  switch (status?.toLowerCase()) {
    case 'backlog': return 'backlog';
    case 'in_progress': return 'started';
    case 'review': return 'started'; // In Review is still "started" state
    case 'completed': return 'completed';
    default: return 'unstarted';
  }
}

/**
 * Map Linear state type to cc_tasks status.
 */
function mapLinearStateToCCTaskStatus(stateType: string): string {
  switch (stateType?.toLowerCase()) {
    case 'backlog': return 'backlog';
    case 'started': return 'in_progress';
    case 'completed': return 'completed';
    case 'canceled': return 'completed'; // treat canceled as completed
    default: return 'backlog';
  }
}

export async function POST() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let syncedToLinear = 0;
    let syncedFromLinear = 0;
    let failed = 0;

    // ─── Phase A: Push cc_tasks → Linear ───────────────────────────────────
    
    const tasksToSync = getCCTasksWithoutLinear();
    const workflowStates = await getTeamWorkflowStates();

    for (const task of tasksToSync) {
      try {
        // Get label IDs for product, area, and "command-centre"
        const labelIds: string[] = [];
        
        if (task.product) {
          const productLabelId = await getCategoryLabelId(task.product);
          if (productLabelId) labelIds.push(productLabelId);
        }
        
        if (task.area) {
          const areaLabelId = await getCategoryLabelId(task.area);
          if (areaLabelId) labelIds.push(areaLabelId);
        }
        
        const ccLabelId = await getCategoryLabelId('command-centre');
        if (ccLabelId) labelIds.push(ccLabelId);

        // Find the appropriate state ID
        const stateType = mapCCTaskStatusToStateType(task.status);
        const state = workflowStates.find(s => s.type === stateType);
        
        // Build description
        const descriptionParts = [];
        if (task.description) descriptionParts.push(task.description);
        
        const metadata = [];
        if (task.product) metadata.push(`**Product:** ${task.product}`);
        if (task.area) metadata.push(`**Area:** ${task.area}`);
        if (task.status) metadata.push(`**Status:** ${task.status}`);
        if (task.priority) metadata.push(`**Priority:** ${task.priority}`);
        if (metadata.length > 0) descriptionParts.push('\n\n' + metadata.join(' | '));
        
        descriptionParts.push('\n\n---\n*Synced from Superclaw Command Centre*');

        const issue = await createLinearIssue({
          title: task.title,
          description: descriptionParts.join(''),
          priority: mapCCTaskPriorityToLinear(task.priority),
          labelIds: labelIds.length > 0 ? labelIds : undefined,
          stateId: state?.id,
        });

        if (issue) {
          updateCCTaskLinear(task.id, issue.id, issue.identifier, issue.url);
          syncedToLinear++;
        } else {
          failed++;
          console.error(`Failed to create Linear issue for cc_task ${task.id}: ${task.title}`);
        }

        // Rate limit: 300ms between creates
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        failed++;
        console.error(`Error syncing cc_task ${task.id}:`, err);
      }
    }

    // ─── Phase B: Pull Linear → cc_tasks ───────────────────────────────────
    
    const linearIssues = await getOpenLinearIssues();

    for (const issue of linearIssues) {
      try {
        // Check if this Linear issue is already linked to a cc_task
        const existingTask = getCCTaskByLinearId(issue.id);
        if (existingTask) continue; // already synced

        // Skip if this was created from Superclaw Proactivity (those go to suggestions, not cc_tasks)
        if (issue.description?.includes('Superclaw Proactivity')) continue;

        // Skip if it was synced FROM Command Centre (avoid circular sync)
        if (issue.description?.includes('Superclaw Command Centre')) continue;

        // Extract product and area from labels
        let product: string | null = null;
        let area: string | null = null;
        const knownProducts = ['skunkcrm', 'skunkforms', 'skunkpages', 'skunk-global', 'superclaw', 'skunksocial', 'skunkcourses', 'skunkmemberships'];
        const knownAreas = ['dev', 'marketing', 'seo', 'infrastructure', 'gtm', 'social', 'content'];

        for (const label of issue.labels?.nodes || []) {
          const labelName = label.name.toLowerCase();
          if (knownProducts.includes(labelName)) product = labelName;
          if (knownAreas.includes(labelName)) area = labelName;
        }

        // Create the cc_task
        const newTaskId = createCCTask({
          title: issue.title,
          description: issue.description || null,
          status: mapLinearStateToCCTaskStatus(issue.state?.type || 'unstarted'),
          priority: mapLinearPriorityToCCTask(issue.priority),
          product,
          area,
          assigned_to: 'clawd',
          created_by: 'linear-sync',
          parent_task_id: null,
          notes: null,
          completed_at: null,
          deliverables: null,
          linear_issue_id: issue.id,
          linear_identifier: issue.identifier,
          linear_url: issue.url,
        });

        if (newTaskId) {
          syncedFromLinear++;
        } else {
          failed++;
          console.error(`Failed to create cc_task from Linear issue ${issue.identifier}`);
        }
      } catch (err) {
        failed++;
        console.error(`Error importing Linear issue ${issue.identifier}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      synced_to_linear: syncedToLinear,
      synced_from_linear: syncedFromLinear,
      failed,
      total_tasks: tasksToSync.length,
      total_issues: linearIssues.length,
    });
  } catch (err) {
    console.error('Failed to sync cc_tasks with Linear:', err);
    return NextResponse.json({ 
      error: 'Failed to sync', 
      details: err instanceof Error ? err.message : 'Unknown error' 
    }, { status: 500 });
  }
}
