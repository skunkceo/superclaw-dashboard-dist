import { NextResponse } from 'next/server';
import { getCurrentUser, hasRole } from '@/lib/auth';
import { getAllTasks, createTask, Task } from '@/lib/db';
import { assignAgentByPorter } from '@/lib/porter';
import { v4 as uuidv4 } from 'uuid';

// GET /api/tasks - List tasks with optional filters
export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const agent = searchParams.get('agent') || undefined;

  const filters = { status, agent };
  const tasks = getAllTasks(filters);

  return NextResponse.json({ tasks });
}

// POST /api/tasks - Create new task (Porter assigns agent)
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasRole(currentUser.role, 'edit')) {
    return NextResponse.json({ error: 'Edit access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Porter routing logic - dynamic based on agent handoff rules
    const assigned_agent = assignAgentByPorter(title);
    
    const newTask: Omit<Task, 'created_at'> = {
      id: uuidv4(),
      title: title.trim(),
      status: 'pending',
      assigned_agent,
      what_doing: null,
      completed_at: null,
      session_id: null,
    };

    createTask(newTask);

    return NextResponse.json({
      success: true,
      task: { ...newTask, created_at: Date.now() },
      message: `Task assigned to ${assigned_agent || 'Developer'} Agent`,
    });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}