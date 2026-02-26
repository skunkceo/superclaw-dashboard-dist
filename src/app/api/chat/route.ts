import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getCurrentUser } from '@/lib/auth';
import Database from 'better-sqlite3';
import { getConfigPaths, getOpenClawDir } from '@/lib/workspace';

const execAsync = promisify(exec);

// Read OpenClaw configuration
function getGatewayConfig() {
  const configPaths = [
    ...getConfigPaths(),
  ];

  for (const path of configPaths) {
    if (existsSync(path)) {
      try {
        const config = JSON.parse(readFileSync(path, 'utf8'));
        return {
          port: config?.gateway?.port || 18789,
          token: config?.gateway?.auth?.token || '',
        };
      } catch {
        continue;
      }
    }
  }
  return null;
}

// Get or create chat database
function getChatDb() {
  const dbDir = process.env.SUPERCLAW_DATA_DIR || join(process.env.HOME || '/root', '.superclaw');
  const dbPath = join(dbDir, 'chat.db');
  
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }
  
  const db = new Database(dbPath);
  
  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id, timestamp);
  `);
  
  return db;
}

// Build system prompt with page context and live data
function buildSystemPrompt(pageContext: { page?: string; data?: unknown } | null, cronJobs: unknown[]): string {
  return `You are the SuperClaw AI assistant — an intelligent control layer for the SuperClaw dashboard built on top of OpenClaw.

Current page: ${pageContext?.page || 'dashboard'}
Page data: ${JSON.stringify(pageContext?.data || null)}

Live state:
Cron jobs: ${JSON.stringify(cronJobs, null, 2)}

You can take actions by including a single action block in your response (use backtick action blocks):

Available actions:
- cron_enable: { "type": "cron_enable", "jobId": "string" }
- cron_disable: { "type": "cron_disable", "jobId": "string" }
- cron_update: { "type": "cron_update", "jobId": "string", "patch": { "name"?: "string", "enabled"?: boolean } }
- linear_create_project: { "type": "linear_create_project", "name": "string", "description"?: "string", "initiativeId"?: "string" }

Rules:
- Include at most ONE action block per response
- Always confirm what you did after taking an action
- Be concise and direct
- Answer questions about the current state using the live data provided`;
}

// Parse action blocks from response text
function parseActionBlock(text: string): any | null {
  const actionMatch = text.match(/```action\s*\n([\s\S]*?)\n```/);
  if (!actionMatch) return null;
  try {
    return JSON.parse(actionMatch[1]);
  } catch {
    return null;
  }
}

// Execute an action
async function executeAction(action: any, gatewayConfig: { port: number; token: string } | null): Promise<string> {
  try {
    switch (action.type) {
      case 'cron_enable':
      case 'cron_disable': {
        if (!gatewayConfig) throw new Error('Gateway config not found');
        const enabled = action.type === 'cron_enable';
        const response = await fetch(`http://localhost:${gatewayConfig.port}/api/cron`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${gatewayConfig.token}`,
          },
          body: JSON.stringify({ jobId: action.jobId, enabled }),
        });
        if (!response.ok) throw new Error(`Failed to ${enabled ? 'enable' : 'disable'} job`);
        return `${enabled ? 'Enabled' : 'Disabled'} job ${action.jobId}`;
      }

      case 'cron_update': {
        if (!gatewayConfig) throw new Error('Gateway config not found');
        const response = await fetch(`http://localhost:${gatewayConfig.port}/api/cron`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${gatewayConfig.token}`,
          },
          body: JSON.stringify({ jobId: action.jobId, ...action.patch }),
        });
        if (!response.ok) throw new Error('Failed to update job');
        return `Updated job ${action.jobId}`;
      }

      case 'linear_create_project': {
        const linearApiKey = process.env.LINEAR_API_KEY;
        if (!linearApiKey) throw new Error('LINEAR_API_KEY not configured');

        const mutation = `
          mutation ProjectCreate($name: String!, $description: String, $initiativeId: String) {
            projectCreate(input: {
              name: $name
              description: $description
              initiativeId: $initiativeId
            }) {
              success
              project {
                id
                name
                url
              }
            }
          }
        `;

        const response = await fetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': linearApiKey,
          },
          body: JSON.stringify({
            query: mutation,
            variables: {
              name: action.name,
              description: action.description || null,
              initiativeId: action.initiativeId || null,
            },
          }),
        });

        const result = await response.json();
        if (result.errors) throw new Error(result.errors[0].message);
        if (!result.data?.projectCreate?.success) throw new Error('Failed to create project');

        return `Created Linear project: ${result.data.projectCreate.project.name}`;
      }

      default:
        return `Unknown action type: ${action.type}`;
    }
  } catch (error) {
    return `Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// POST - Send a message
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { message, sessionId, pageContext } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Get or create session
    const db = getChatDb();
    const now = Date.now();
    const actualSessionId = sessionId || `chat-${now}`;
    
    // Ensure session exists
    const existingSession = db.prepare('SELECT id FROM chat_sessions WHERE id = ?').get(actualSessionId);
    if (!existingSession) {
      db.prepare(`
        INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(actualSessionId, user.email, message.substring(0, 50), now, now);
    } else {
      db.prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?').run(now, actualSessionId);
    }
    
    // Save user message
    db.prepare(`
      INSERT INTO chat_messages (session_id, role, content, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(actualSessionId, 'user', message, now);
    
    db.close();

    // Get gateway config and fetch live cron jobs
    const gatewayConfig = getGatewayConfig();
    let cronJobs: any[] = [];
    
    if (gatewayConfig) {
      try {
        const cronResponse = await fetch(`http://localhost:${gatewayConfig.port}/api/cron`, {
          headers: {
            'Authorization': `Bearer ${gatewayConfig.token}`,
          },
        });
        if (cronResponse.ok) {
          const cronData = await cronResponse.json();
          cronJobs = cronData.jobs || [];
        }
      } catch (error) {
        console.error('Failed to fetch cron jobs:', error);
      }
    }

    // Build prompt and run claude
    const promptId = `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const promptFile = join(tmpdir(), `sc-chat-${promptId}.txt`);
    const fullPrompt = buildSystemPrompt(pageContext, cronJobs) + '\n\nUser message: ' + message;

    writeFileSync(promptFile, fullPrompt);

    let responseText = '';
    try {
      const { stdout } = await execAsync(
        `claude --print < "${promptFile}"`,
        { 
          timeout: 90000, 
          maxBuffer: 10 * 1024 * 1024, 
          shell: '/bin/bash' 
        }
      );
      responseText = stdout.trim();
    } catch (error) {
      console.error('Claude execution error:', error);
      responseText = 'I encountered an error processing your request. Please try again.';
    } finally {
      try {
        unlinkSync(promptFile);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Parse and execute actions
    const actionsTaken: string[] = [];
    const action = parseActionBlock(responseText);
    
    if (action) {
      const actionResult = await executeAction(action, gatewayConfig);
      actionsTaken.push(actionResult);
    }

    // Save assistant response
    const db2 = getChatDb();
    db2.prepare(`
      INSERT INTO chat_messages (session_id, role, content, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(actualSessionId, 'assistant', responseText, Date.now());
    db2.close();

    return NextResponse.json({
      reply: responseText,
      sessionId: actualSessionId,
      actions_taken: actionsTaken,
    });

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// GET - Retrieve chat history
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    
    const db = getChatDb();
    
    if (sessionId) {
      // Get messages for specific session
      const messages = db.prepare(`
        SELECT id, role, content, timestamp
        FROM chat_messages
        WHERE session_id = ?
        ORDER BY timestamp ASC
      `).all(sessionId);
      
      db.close();
      return NextResponse.json({ messages });
    } else {
      // Get all sessions for user
      const sessions = db.prepare(`
        SELECT id, title, created_at, updated_at,
               (SELECT COUNT(*) FROM chat_messages WHERE session_id = chat_sessions.id) as message_count
        FROM chat_sessions
        WHERE user_id = ?
        ORDER BY updated_at DESC
        LIMIT 50
      `).all(user.email);
      
      db.close();
      return NextResponse.json({ sessions });
    }
  } catch (error) {
    console.error('Chat history error:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve chat history',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// DELETE - Delete a chat session
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const db = getChatDb();
    
    // Verify session belongs to user
    const session = db.prepare('SELECT user_id FROM chat_sessions WHERE id = ?').get(sessionId) as any;
    if (!session) {
      db.close();
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    
    if (session.user_id !== user.email) {
      db.close();
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete messages first (foreign key constraint)
    db.prepare('DELETE FROM chat_messages WHERE session_id = ?').run(sessionId);
    
    // Delete session
    db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(sessionId);
    
    db.close();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete chat error:', error);
    return NextResponse.json({ 
      error: 'Failed to delete chat session',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
