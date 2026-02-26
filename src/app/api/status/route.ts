import { NextResponse } from 'next/server';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { parseSessionUsage, getSubscriptionInfo } from '@/lib/usage-parser';
import { getCurrentUser, needsSetup } from '@/lib/auth';
import { getConfigPaths, getMainWorkspace } from '@/lib/workspace';

// Read Clawdbot/OpenClaw configuration
function getConfig() {
  const configPaths = [
    ...getConfigPaths(),
    join(process.env.HOME || '', '.openclaw/openclaw.json'),
    join(process.env.HOME || '', '.clawdbot/clawdbot.json'),
  ];

  for (const path of configPaths) {
    if (existsSync(path)) {
      try {
        return { config: JSON.parse(readFileSync(path, 'utf8')), path };
      } catch {
        continue;
      }
    }
  }
  return null;
}

// Get workspace info
function getWorkspaceInfo(workspacePath: string) {
  const result = {
    memory: false,
    channels: [] as string[],
    skills: [] as string[],
    apiKeys: [] as string[],
  };

  // Check for memory system
  const memoryPath = join(workspacePath, 'memory');
  const memoryMdPath = join(workspacePath, 'MEMORY.md');
  result.memory = existsSync(memoryPath) || existsSync(memoryMdPath);

  // Check for skills
  const skillsPath = join(workspacePath, 'skills');
  if (existsSync(skillsPath)) {
    try {
      const skills = readdirSync(skillsPath, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      result.skills = skills;
    } catch {
      // ignore
    }
  }

  return result;
}

// Get connected channels from config
function getChannels(config: Record<string, unknown>) {
  const channels: string[] = [];
  const channelsConfig = config?.channels as Record<string, { enabled?: boolean }> | undefined;
  
  if (channelsConfig) {
    for (const [name, cfg] of Object.entries(channelsConfig)) {
      if (cfg && (cfg.enabled !== false)) {
        channels.push(name.charAt(0).toUpperCase() + name.slice(1));
      }
    }
  }
  return channels;
}

// Get API keys
function getApiKeys(config: Record<string, unknown>) {
  const keys: string[] = [];
  const auth = config?.auth as { profiles?: Record<string, { provider?: string }> } | undefined;
  
  if (auth?.profiles) {
    for (const [, profile] of Object.entries(auth.profiles)) {
      if (profile?.provider) {
        keys.push(profile.provider.charAt(0).toUpperCase() + profile.provider.slice(1));
      }
    }
  }
  return keys;
}

// Check gateway health
async function checkGatewayHealth(port: number, token: string) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const res = await fetch(`http://127.0.0.1:${port}/`, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (res.ok) {
      return { healthy: true, data: null };
    }
    return { healthy: false, data: null };
  } catch {
    return { healthy: false, data: null };
  }
}

// Fetch active sessions from local session files
async function fetchActiveSessions(sessionsDir: string) {
  try {
    // ONLY use synced copy (dashboard may run as different user, can't access OpenClaw's files directly)
    const sessionsJsonPath = '/tmp/openclaw-sessions.json';
    
    if (!existsSync(sessionsJsonPath)) {
      console.error('Synced sessions file not found at:', sessionsJsonPath);
      return [];
    }

    const sessionsData = JSON.parse(readFileSync(sessionsJsonPath, 'utf8'));
    const now = Date.now();

    const sessions = [];
    
    for (const [sessionKey, sessionInfo] of Object.entries(sessionsData)) {
      const session = sessionInfo as any;
      if (session.updatedAt) {
        // Don't try to read JSONL files (permission issues)
        // Just use the data from sessions.json
        const recentMessages: Array<{role: string; content: string; timestamp: string; usage?: any}> = [];
        const model = session.model || session.lastModel || 'claude-sonnet-4-20250514'; // Use model from sessions.json
        const totalTokens = session.totalTokens || 0;

        // Slack channel ID → name mapping
        const slackChannels: Record<string, string> = {
          'C0ACV8Y8AHW': '#dev',
          'C0ABZ068W22': '#dailies',
          'C0AC4JZ0M44': '#marketing',
          'C0ABKHH98VD': '#product',
          'C0AC11G4N4A': '#support',
          'C0AC06RAWG2': '#social',
          'C0ADVJB9ETA': '#projects',
          'C0ACBTVCWAY': '#progress',
          'D0AC0T1M4KU': 'DM',
          'C0AFE1STJSV': '#superclaw',
        };

        // Parse session type and display name
        let kind = 'session';
        let displayName = session.displayName || session.label || sessionKey;
        
        if (sessionKey.includes(':isolated:')) {
          kind = 'sub-agent';
          displayName = session.displayName || 'Sub-agent';
        } else if (sessionKey.includes(':thread:')) {
          kind = 'thread';
          // Use displayName from session data if available
          displayName = session.displayName || 'Slack Thread';
        } else if (sessionKey.includes(':channel:')) {
          kind = 'channel';
          const parts = sessionKey.split(':');
          const channelIdx = parts.indexOf('channel');
          const channelId = channelIdx >= 0 ? parts[channelIdx + 1] : '';
          const channelName = slackChannels[channelId.toUpperCase()] || channelId;
          displayName = session.displayName || channelName;
        } else if (sessionKey === 'agent:main:main') {
          kind = 'main';
          displayName = 'Main Session';
        }
        
        // Check if session is actually active (updated in last 30 min)
        const isActive = (now - session.updatedAt) < 30 * 60 * 1000;

        sessions.push({
          key: sessionKey,
          sessionId: session.sessionId,
          kind,
          displayName,
          updatedAt: session.updatedAt,
          model: model.replace('anthropic/', ''),
          totalTokens,
          messages: recentMessages,
          status: isActive ? 'active' : 'idle'
        });
      }
    }

    // Sort by most recent activity
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);
  } catch (error) {
    console.error('Error fetching active sessions:', error);
    return [];
  }
}

// Get recent activity from main session
function getRecentActivity(sessionsDir: string): { lastActive: string; recentMessages: number; status: 'active' | 'idle'; currentTask: string | null } {
  if (!existsSync(sessionsDir)) {
    return { lastActive: 'Unknown', recentMessages: 0, status: 'idle', currentTask: null };
  }
  
  try {
    // Find the most recently modified .jsonl file (excluding deleted and sub-agent sessions)
    const files = readdirSync(sessionsDir)
      .filter(f => f.endsWith('.jsonl') && !f.includes('.deleted.') && !f.includes('-topic-'))
      .map(f => ({
        name: f,
        path: join(sessionsDir, f),
        mtime: require('fs').statSync(join(sessionsDir, f)).mtimeMs
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    if (files.length === 0) {
      return { lastActive: 'Unknown', recentMessages: 0, status: 'idle', currentTask: null };
    }
    
    const mainSessionPath = files[0].path;
    const content = readFileSync(mainSessionPath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    // Count messages in last hour and find last user message for context
    const hourAgo = Date.now() - (60 * 60 * 1000);
    let recentMessages = 0;
    let lastTimestamp = 0;
    let currentTask: string | null = null;
    
    // Read last 100 lines for efficiency
    const recentLines = lines.slice(-100);
    for (const line of recentLines) {
      try {
        const msg = JSON.parse(line);
        if (msg.timestamp) {
          const ts = new Date(msg.timestamp).getTime();
          if (ts > lastTimestamp) lastTimestamp = ts;
          if (ts > hourAgo) recentMessages++;
        }
        // Extract context from user messages (look for the last substantive one)
        if (msg.role === 'user' && msg.content && typeof msg.content === 'string') {
          const text = msg.content.trim();
          // Skip heartbeats and very short messages
          if (!text.includes('HEARTBEAT') && text.length > 10 && text.length < 500) {
            // Truncate to ~60 chars for display
            currentTask = text.length > 60 ? text.substring(0, 57) + '...' : text;
          }
        }
      } catch {
        continue;
      }
    }
    
    // Format last active time
    let lastActive = 'Unknown';
    if (lastTimestamp > 0) {
      const diff = Date.now() - lastTimestamp;
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(mins / 60);
      
      if (mins < 1) lastActive = 'Just now';
      else if (mins < 60) lastActive = `${mins}m ago`;
      else if (hours < 24) lastActive = `${hours}h ago`;
      else lastActive = `${Math.floor(hours / 24)}d ago`;
    }
    
    // Consider active if message in last 5 minutes
    const status = (Date.now() - lastTimestamp < 5 * 60 * 1000) ? 'active' : 'idle';
    
    return { lastActive, recentMessages, status, currentTask };
  } catch {
    return { lastActive: 'Unknown', recentMessages: 0, status: 'idle', currentTask: null };
  }
}

// Get sessions directory
function getSessionsDir(configPath: string): string {
  // Default sessions directory based on config location
  const configDir = configPath.replace(/\/[^/]+$/, '');
  return join(configDir, 'agents', 'main', 'sessions');
}

// Count active sessions/tasks
function countSessions(sessionsDir: string): { active: number; completed: number } {
  if (!existsSync(sessionsDir)) {
    return { active: 0, completed: 0 };
  }

  try {
    const files = readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl'));
    const deleted = files.filter(f => f.includes('.deleted.')).length;
    return {
      active: 0, // Would need to check for running sessions
      completed: files.length - deleted,
    };
  } catch {
    return { active: 0, completed: 0 };
  }
}

// Helper function to format last active time
function formatLastActive(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  
  if (mins < 1) return 'Just now';
  else if (mins < 60) return `${mins}m ago`;
  else if (hours < 24) return `${hours}h ago`;
  else return `${Math.floor(hours / 24)}d ago`;
}

// Helper function to truncate content
function truncateContent(content: string, maxLength: number): string {
  if (typeof content !== 'string') {
    content = JSON.stringify(content);
  }
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength - 3) + '...';
}

// Get available skills (from built-in + workspace)
function getAvailableSkills() {
  return [
    { name: 'Web Search', enabled: true, description: 'Search the web using Brave API' },
    { name: 'Email', enabled: false, description: 'Send and read emails via IMAP/SMTP' },
    { name: 'Calendar', enabled: false, description: 'Google Calendar integration' },
    { name: 'GitHub', enabled: true, description: 'Manage repos, issues, and PRs' },
    { name: 'Slack', enabled: true, description: 'Connected to Slack workspace' },
    { name: 'Browser', enabled: true, description: 'Control web browser for automation' },
    { name: 'WordPress', enabled: true, description: 'WP-CLI for site management' },
    { name: 'Linear', enabled: true, description: 'Project management integration' },
    { name: 'Weather', enabled: true, description: 'Get weather forecasts' },
  ];
}

export async function GET() {
  // Skip auth check if setup is needed (no users yet)
  if (!needsSetup()) {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const configResult = getConfig();
  
  if (!configResult) {
    return NextResponse.json({
      error: 'No OpenClaw/Clawdbot installation found',
    }, { status: 404 });
  }

  const { config, path: configPath } = configResult;
  const workspacePath = config?.agents?.defaults?.workspace || getMainWorkspace();
  const workspaceInfo = getWorkspaceInfo(workspacePath);
  const channels = getChannels(config);
  const apiKeys = getApiKeys(config);

  // Check gateway
  const gatewayPort = config?.gateway?.port || 18789;
  const gatewayToken = config?.gateway?.auth?.token || '';
  const gatewayHealth = await checkGatewayHealth(gatewayPort, gatewayToken);

  // Calculate uptime
  const lastTouched = config?.meta?.lastTouchedAt;
  let uptime = 'Unknown';
  if (lastTouched) {
    const diff = Date.now() - new Date(lastTouched).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) {
      uptime = `${days}d ${hours % 24}h`;
    } else {
      uptime = `${hours}h`;
    }
  }

  // Get sessions directory
  const sessionsDir = getSessionsDir(configPath);
  
  // Get REAL usage data from synced file (updated by root cron job)
  let usage = {
    today: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0, byModel: {} },
    thisWeek: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0, byModel: {} },
    thisMonth: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0, byModel: {} },
    allTime: { inputTokens: 0, outputTokens: 0, totalTokens: 0, cost: 0, byModel: {} },
  };
  try {
    const usageData = readFileSync('/tmp/openclaw-usage.json', 'utf8');
    usage = JSON.parse(usageData);
  } catch (err) {
    console.error('Failed to read usage data:', err);
    // Fall back to parsing session files (may be empty due to permissions)
    usage = parseSessionUsage(sessionsDir);
  }
  const subscription = getSubscriptionInfo(configPath);

  // Get session counts
  const sessionCounts = countSessions(sessionsDir);

  // Fetch active sessions from local files
  const activeSessions = await fetchActiveSessions(sessionsDir);
  // Separate main session and sub-agents
  const mainSession = activeSessions.find((s: any) => s.key.includes('agent:main') || s.displayName.includes('🦞'));
  const subAgents = activeSessions
    .filter((s: any) => !s.key.includes('agent:main') || s.key.includes('subagent:'))
    .map((s: any) => ({
      id: s.sessionId || s.key || 'unknown',
      task: s.displayName || s.key || 'Unknown task',
      model: s.model || 'unknown',
      status: s.status || 'idle',
      lastActive: s.updatedAt ? formatLastActive(s.updatedAt) : 'Unknown',
      messages: s.messages || []
    }));

  // Create activity feed from all sessions
  const activityFeed = [];
  for (const session of activeSessions) {
    if (session.messages && session.messages.length > 0) {
      for (const msg of session.messages) {
        activityFeed.push({
          type: 'message',
          sessionKey: session.key,
          sessionName: session.displayName,
          role: msg.role,
          content: truncateContent(msg.content, 100),
          timestamp: msg.timestamp,
          model: session.model
        });
      }
    }
  }
  activityFeed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  activityFeed.splice(10); // Keep only last 10 activities
  
  // Get main session activity
  const mainActivity = getRecentActivity(sessionsDir);

  // Format token numbers
  const formatTokens = (n: number) => Math.round(n);
  const formatCost = (n: number) => Math.round(n * 100) / 100;

  // Build better main session context
  let mainSessionData = null;
  if (mainSession) {
    // Extract last user/assistant exchange for context
    const recentMsgs = mainSession.messages || [];
    let snippet: string | null = null;
    let channel = 'DM';
    
    // Parse channel from session key
    if (mainSession.key.includes(':channel:')) {
      const slackChannels: Record<string, string> = {
        'C0ACV8Y8AHW': '#dev',
        'C0ABZ068W22': '#dailies',
        'C0AC4JZ0M44': '#marketing',
        'C0ABKHH98VD': '#product',
        'C0AC11G4N4A': '#support',
        'C0AC06RAWG2': '#social',
        'C0ADVJB9ETA': '#projects',
        'C0ACBTVCWAY': '#progress',
        'D0AC0T1M4KU': 'DM',
        'C0AFE1STJSV': '#superclaw',
      };
      const parts = mainSession.key.split(':');
      const channelIdx = parts.indexOf('channel');
      const channelId = channelIdx >= 0 ? parts[channelIdx + 1] : '';
      channel = slackChannels[channelId.toUpperCase()] || 'DM';
    } else if (mainSession.displayName.includes('#')) {
      channel = mainSession.displayName.split(' ')[0];
    }
    
    // Find last substantive user message for context
    for (let i = recentMsgs.length - 1; i >= 0; i--) {
      const msg = recentMsgs[i];
      if (msg.role === 'user' && msg.content && typeof msg.content === 'string') {
        const text = msg.content.trim();
        // Skip heartbeats and very short messages
        if (!text.includes('HEARTBEAT') && text.length > 10) {
          snippet = text.length > 60 ? text.substring(0, 57) + '...' : text;
          break;
        }
      }
    }
    
    // Try to get queued messages count from gateway
    let queuedMessages = 0;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      const gwRes = await fetch(`http://127.0.0.1:${gatewayPort}/api/sessions/list`, {
        headers: { 'Authorization': `Bearer ${gatewayToken}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (gwRes.ok) {
        const gwData = await gwRes.json();
        const mainSess = gwData.sessions?.find((s: any) => s.key === 'agent:main:main');
        queuedMessages = mainSess?.queuedMessages || 0;
      }
    } catch {
      // Ignore - gateway might be busy
    }
    
    mainSessionData = {
      status: mainSession.status,
      lastActive: formatLastActive(mainSession.updatedAt),
      recentMessages: recentMsgs.length,
      currentTask: snippet,
      channel: channel,
      model: mainSession.model,
      totalTokens: mainSession.totalTokens,
      queuedMessages: queuedMessages
    };
  } else if (mainActivity) {
    mainSessionData = {
      status: mainActivity.status,
      lastActive: mainActivity.lastActive,
      recentMessages: mainActivity.recentMessages,
      currentTask: mainActivity.currentTask,
      channel: 'DM',
      model: 'unknown',
      totalTokens: 0,
      queuedMessages: 0
    };
  }

  // Count sub-agents that are actually running work (not just idle sessions)
  const runningSubAgents = activeSessions.filter((s: any) => 
    s.kind === 'sub-agent' && s.status !== 'done'
  ).length;
  
  // Count ALL open sessions (for context, not as "active work")
  const openSessions = activeSessions.filter((s: any) => 
    s.status === 'active' || s.status === 'idle'
  ).length;

  return NextResponse.json({
    health: {
      status: gatewayHealth.healthy ? 'healthy' : 'offline',
      uptime,
      lastHeartbeat: gatewayHealth.healthy ? 'Just now' : 'Unknown',
      gatewayVersion: config?.meta?.lastTouchedVersion || 'Unknown',
      defaultModel: (() => {
        // Prefer config value (source of truth)
        const modelCfg = config?.agents?.defaults?.model;
        if (modelCfg) {
          if (typeof modelCfg === 'string') return modelCfg;
          if (modelCfg.primary) return modelCfg.primary;
        }
        // Fallback: scan most recent session for model_change events
        try {
          const sessJson = join(sessionsDir, 'sessions.json');
          if (existsSync(sessJson)) {
            const sessions = JSON.parse(readFileSync(sessJson, 'utf8'));
            let latest = { updatedAt: 0, sessionId: '' };
            for (const [, v] of Object.entries(sessions)) {
              const s = v as any;
              if (s.updatedAt > latest.updatedAt) latest = s;
            }
            if (latest.sessionId) {
              const files = readdirSync(sessionsDir).filter(f => f.includes(latest.sessionId) && f.endsWith('.jsonl'));
              if (files.length > 0) {
                const content = readFileSync(join(sessionsDir, files[0]), 'utf8');
                const lines = content.split('\n').filter(Boolean);
                for (const line of lines) {
                  try {
                    const e = JSON.parse(line);
                    if (e.type === 'model_change' && e.modelId) return e.modelId;
                  } catch {}
                }
              }
            }
          }
        } catch {}
        // Final fallback: env var set at deploy time
        return process.env.OPENCLAW_DEFAULT_MODEL || 'Unknown';
      })(),
    },
    tokens: {
      today: formatTokens(usage.today.totalTokens),
      thisWeek: formatTokens(usage.thisWeek.totalTokens),
      thisMonth: formatTokens(usage.thisMonth.totalTokens),
      allTime: formatTokens(usage.allTime.totalTokens),
      estimatedCost: formatCost(usage.thisMonth.cost),
      todayCost: formatCost(usage.today.cost),
      weekCost: formatCost(usage.thisWeek.cost),
      byModel: {
        today: usage.today.byModel,
        thisWeek: usage.thisWeek.byModel,
        thisMonth: usage.thisMonth.byModel,
      },
    },
    subscription: subscription ? {
      provider: subscription.provider,
      plan: subscription.plan,
      isSubscription: subscription.isSubscription,
    } : null,
    setup: {
      memory: workspaceInfo.memory,
      channels,
      skills: workspaceInfo.skills,
      apiKeys,
    },
    tasks: {
      active: openSessions, // Keep for backwards compat
      runningSubAgents, // NEW: actual work in progress
      openSessions, // NEW: all open sessions (idle + active)
      completed: activeSessions.filter((s: any) => s.status === 'done').length,
      subAgents,
      allSessions: activeSessions.map((s: any) => ({
        key: s.key,
        sessionId: s.sessionId,
        displayName: s.displayName,
        status: s.status,
        lastActive: formatLastActive(s.updatedAt),
        model: s.model,
        totalTokens: s.totalTokens,
        messages: s.messages?.slice(-2) || [] // Last 2 messages for preview
      })),
      mainSession: mainSessionData,
      activityFeed,
    },
    skills: getAvailableSkills(),
  });
}
