import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { getCurrentUser } from '@/lib/auth';
import { getSessionsDirs, getMainWorkspace } from '@/lib/workspace';

function getSessionsDir(): string {
  const paths = [
    ...getSessionsDirs(),
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return paths[0];
}

interface ErrorEntry {
  sessionId: string;
  sessionKey: string;
  timestamp: string;
  tool: string;
  error: string;
  errorType: string;
  severity: 'error' | 'warning';
  canSelfHeal: boolean;
  selfHealAction?: string;
}

function classifyError(tool: string, error: string): { errorType: string; severity: 'error' | 'warning'; canSelfHeal: boolean; selfHealAction?: string } {
  // Missing file errors
  if (error.includes('ENOENT')) {
    if (error.includes('memory/')) {
      const match = error.match(/memory\/(\d{4}-\d{2}-\d{2})\.md/);
      return {
        errorType: 'missing_memory_file',
        severity: 'warning',
        canSelfHeal: true,
        selfHealAction: match ? `create memory/${match[1]}.md` : undefined,
      };
    }
    return {
      errorType: 'file_not_found',
      severity: 'error',
      canSelfHeal: false,
    };
  }
  
  // Missing table errors (SQLite)
  if (error.includes('no such table:')) {
    const match = error.match(/no such table: (\w+)/);
    return {
      errorType: 'missing_database_table',
      severity: 'error',
      canSelfHeal: false,
      selfHealAction: match ? `needs manual schema fix for table: ${match[1]}` : undefined,
    };
  }
  
  // Directory operations on files
  if (error.includes('EISDIR') || error.includes('ENOTDIR')) {
    return {
      errorType: 'path_type_mismatch',
      severity: 'error',
      canSelfHeal: false,
    };
  }
  
  // Permission errors
  if (error.includes('EACCES') || error.includes('Permission denied')) {
    return {
      errorType: 'permission_error',
      severity: 'error',
      canSelfHeal: false,
    };
  }
  
  // Network/timeout errors
  if (error.includes('ETIMEDOUT') || error.includes('ECONNREFUSED') || error.includes('ENOTFOUND')) {
    return {
      errorType: 'network_error',
      severity: 'warning',
      canSelfHeal: false,
    };
  }
  
  // Rate limiting
  if (error.includes('rate limit') || error.includes('429')) {
    return {
      errorType: 'rate_limit',
      severity: 'warning',
      canSelfHeal: false,
    };
  }
  
  // Command execution failures
  if (error.includes('Command exited with code') || error.includes('Command failed')) {
    return {
      errorType: 'command_failed',
      severity: 'warning',
      canSelfHeal: false,
    };
  }
  
  // API errors
  if (error.includes('401') || error.includes('Unauthorized')) {
    return {
      errorType: 'auth_error',
      severity: 'error',
      canSelfHeal: false,
    };
  }
  
  if (error.includes('403') || error.includes('Forbidden')) {
    return {
      errorType: 'forbidden',
      severity: 'error',
      canSelfHeal: false,
    };
  }
  
  if (error.includes('404') || error.includes('Not Found')) {
    return {
      errorType: 'not_found',
      severity: 'warning',
      canSelfHeal: false,
    };
  }
  
  if (error.includes('500') || error.includes('Internal Server Error')) {
    return {
      errorType: 'server_error',
      severity: 'error',
      canSelfHeal: false,
    };
  }
  
  // Parse errors
  if (error.includes('JSON.parse') || error.includes('Unexpected token') || error.includes('SyntaxError')) {
    return {
      errorType: 'parse_error',
      severity: 'error',
      canSelfHeal: false,
    };
  }
  
  // Warnings that shouldn't block
  if (error.includes('deprecated') || error.includes('warning')) {
    return {
      errorType: 'deprecation_warning',
      severity: 'warning',
      canSelfHeal: false,
    };
  }
  
  return { errorType: 'unclassified', severity: 'error', canSelfHeal: false };
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const hoursBack = parseInt(url.searchParams.get('hours') || '24', 10);

  const sessionsDir = getSessionsDir();
  if (!existsSync(sessionsDir)) {
    return NextResponse.json({ errors: [] });
  }

  const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
  const errors: ErrorEntry[] = [];
  const files = readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));

  // Load sessions.json for session keys
  const sessionsJson: Record<string, any> = {};
  try {
    const sJson = JSON.parse(readFileSync(join(sessionsDir, 'sessions.json'), 'utf8'));
    Object.assign(sessionsJson, sJson);
  } catch {}

  for (const file of files) {
    const filePath = join(sessionsDir, file);
    let content: string;
    try {
      content = readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split('\n').filter(l => l.trim());
    let sessionId = '';
    let sessionKey = '';

    // Try to find session key from filename first (e.g., "slack:U123:D456.jsonl" -> "slack:U123:D456")
    const filenameKey = file.replace('.jsonl', '');
    
    // Check if this filename is a valid session key in sessions.json
    if (sessionsJson[filenameKey]) {
      sessionKey = filenameKey;
      sessionId = sessionsJson[filenameKey].sessionId;
    }

    for (const line of lines) {
      let entry: any;
      try { entry = JSON.parse(line); } catch { continue; }

      // Track session ID from metadata if available
      if (!sessionId && entry.message?.metadata?.sessionId) {
        sessionId = entry.message.metadata.sessionId;
      }

      // Look for tool result errors
      if (entry.type === 'message' && entry.message?.role === 'toolResult' && entry.message?.details?.status === 'error') {
        const timestamp = new Date(entry.timestamp || entry.message.timestamp).getTime();
        if (timestamp < cutoffTime) continue;

        // Find session key from sessions.json if we don't have it yet
        if (!sessionKey && sessionId) {
          for (const [key, val] of Object.entries(sessionsJson)) {
            if ((val as any).sessionId === sessionId) {
              sessionKey = key;
              break;
            }
          }
        }

        const tool = entry.message.details.tool || entry.message.toolName || 'unknown';
        const error = entry.message.details.error || '';
        const { errorType, severity, canSelfHeal, selfHealAction } = classifyError(tool, error);

        // Determine display key: prefer sessionKey, fall back to shortened sessionId or filename
        let displayKey = sessionKey;
        if (!displayKey) {
          if (sessionId) {
            // Show last 8 chars of sessionId
            displayKey = sessionId.length > 8 ? '...' + sessionId.slice(-8) : sessionId;
          } else {
            // Use filename without extension
            displayKey = filenameKey;
          }
        }

        errors.push({
          sessionId: sessionId || file.replace('.jsonl', ''),
          sessionKey: displayKey,
          timestamp: entry.timestamp || entry.message.timestamp || new Date().toISOString(),
          tool,
          error,
          errorType,
          severity,
          canSelfHeal,
          selfHealAction,
        });

        if (errors.length >= limit) break;
      }
    }

    if (errors.length >= limit) break;
  }

  // Sort by timestamp descending
  errors.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Group by error type for summary
  const summary: Record<string, number> = {};
  const healable: number = errors.filter(e => e.canSelfHeal).length;
  
  for (const err of errors) {
    summary[err.errorType] = (summary[err.errorType] || 0) + 1;
  }

  return NextResponse.json({
    total: errors.length,
    healable,
    summary,
    errors: errors.slice(0, limit),
  });
}

// POST endpoint for self-healing
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action, data } = body;

  const results: Array<{ action: string; success: boolean; error?: string }> = [];

  if (action === 'heal_all') {
    // Get all healable errors
    const errorsResp = await GET(request);
    const errorsData = await errorsResp.json();
    
    const healableErrors = errorsData.errors.filter((e: ErrorEntry) => e.canSelfHeal);
    
    for (const err of healableErrors) {
      if (err.errorType === 'missing_memory_file' && err.selfHealAction) {
        const match = err.selfHealAction.match(/create (memory\/\d{4}-\d{2}-\d{2}\.md)/);
        if (match) {
          const filePath = match[1];
          const fullPath = join(getMainWorkspace(), filePath);
          
          try {
            // Ensure directory exists
            mkdirSync(dirname(fullPath), { recursive: true });
            
            // Create file with header
            const date = filePath.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '';
            writeFileSync(fullPath, `# ${date}\n\n`);
            
            results.push({ action: `create ${filePath}`, success: true });
          } catch (e: any) {
            results.push({ action: `create ${filePath}`, success: false, error: e.message });
          }
        }
      }
    }
  } else if (action === 'heal_one') {
    // Heal a specific error
    const { errorType, selfHealAction } = data;
    
    if (errorType === 'missing_memory_file' && selfHealAction) {
      const match = selfHealAction.match(/create (memory\/\d{4}-\d{2}-\d{2}\.md)/);
      if (match) {
        const filePath = match[1];
        const fullPath = join(getMainWorkspace(), filePath);
        
        try {
          mkdirSync(dirname(fullPath), { recursive: true });
          const date = filePath.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '';
          writeFileSync(fullPath, `# ${date}\n\n`);
          results.push({ action: `create ${filePath}`, success: true });
        } catch (e: any) {
          results.push({ action: `create ${filePath}`, success: false, error: e.message });
        }
      }
    }
  }

  return NextResponse.json({ results });
}
