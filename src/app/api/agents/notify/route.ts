import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createActivityEntry } from '@/lib/db';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

interface NotifyPayload {
  label: string;
  action: string;
  summary: string;
  task?: string;
  branch?: string;
  repo?: string;
  linearId?: string;
}

// In-memory broadcast channel (simple implementation)
// In production, you might use Redis or a proper message queue
const agentNotifications: NotifyPayload[] = [];
const MAX_NOTIFICATIONS = 50;

export async function POST(request: NextRequest) {
  try {
    const body: NotifyPayload = await request.json();

    // Validate required fields
    if (!body.label || !body.action || !body.summary) {
      return NextResponse.json(
        { error: 'Missing required fields: label, action, summary' },
        { status: 400 }
      );
    }

    // Store notification in memory
    agentNotifications.unshift(body);
    if (agentNotifications.length > MAX_NOTIFICATIONS) {
      agentNotifications.length = MAX_NOTIFICATIONS;
    }

    // Also write to activity log in DB
    createActivityEntry({
      id: randomUUID(),
      agent_label: body.label,
      action_type: body.action,
      summary: body.summary,
      details: JSON.stringify({
        task: body.task,
        branch: body.branch,
        repo: body.repo,
        linearId: body.linearId,
      }),
      links: '[]',
      task_id: null,
      session_key: null,
    });

    // Also update work-loop-state.json if task/branch provided
    if (body.task || body.branch) {
      const workLoopPath = '/root/.openclaw/workspace/memory/work-loop-state.json';
      try {
        let state: any = { updated: new Date().toISOString(), active_agents: [] };
        
        if (fs.existsSync(workLoopPath)) {
          const raw = fs.readFileSync(workLoopPath, 'utf-8');
          state = JSON.parse(raw);
        }

        // Update or add agent in active_agents
        const existingIndex = state.active_agents.findIndex(
          (a: any) => a.sessionLabel === body.label
        );

        if (existingIndex >= 0) {
          // Update existing
          state.active_agents[existingIndex] = {
            ...state.active_agents[existingIndex],
            task: body.task || state.active_agents[existingIndex].task,
            branch: body.branch || state.active_agents[existingIndex].branch,
            repo: body.repo || state.active_agents[existingIndex].repo,
            linearId: body.linearId || state.active_agents[existingIndex].linearId,
          };
        } else if (body.action === 'started' || body.task) {
          // Add new agent
          state.active_agents.push({
            sessionLabel: body.label,
            task: body.task,
            branch: body.branch,
            repo: body.repo,
            linearId: body.linearId,
            spawned: Date.now(),
          });
        }

        // If action is 'completed', remove from active agents
        if (body.action === 'completed') {
          state.active_agents = state.active_agents.filter(
            (a: any) => a.sessionLabel !== body.label
          );
        }

        state.updated = new Date().toISOString();

        fs.writeFileSync(workLoopPath, JSON.stringify(state, null, 2));
      } catch (error) {
        console.error('Failed to update work-loop-state.json:', error);
      }
    }

    return NextResponse.json({ success: true, notification: body });
  } catch (error) {
    console.error('Error in notify endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to fetch recent notifications
export async function GET() {
  return NextResponse.json({
    notifications: agentNotifications.slice(0, 10),
  });
}
