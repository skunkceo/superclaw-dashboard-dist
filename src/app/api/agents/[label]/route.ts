import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getOpenClawWorkspace } from '@/lib/workspace';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ label: string }> }
) {
  try {
    const { label } = await params;
    const agentPath = path.join(getOpenClawWorkspace(), 'agents', label);

    if (!fs.existsSync(agentPath)) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Read agent identity
    let name = label;
    const identityPath = path.join(agentPath, 'IDENTITY.md');
    if (fs.existsSync(identityPath)) {
      const identity = fs.readFileSync(identityPath, 'utf-8');
      const nameMatch = identity.match(/\*\*Name:\*\*\s*(.+)/);
      if (nameMatch) name = nameMatch[1].trim();
    }

    // Read agent description and default model from AGENTS.md
    let description = '';
    let defaultModel: string | null = null;
    const agentsPath = path.join(agentPath, 'AGENTS.md');
    if (fs.existsSync(agentsPath)) {
      const agentsContent = fs.readFileSync(agentsPath, 'utf-8');
      
      // Try to find default model
      const defaultModelMatch = agentsContent.match(/\*\*Default model:\*\*\s*`([^`]+)`/);
      if (defaultModelMatch) {
        let model = defaultModelMatch[1].trim();
        model = model.replace(/-\d{8}$/, '');
        if (model !== 'claude-sonnet-4-6') {
          model = model.replace(/-6$/, '');
        }
        defaultModel = model;
      } else {
        const modelPrefsMatch = agentsContent.match(/## Model Preferences[\s\S]*?(?=\n##|$)/);
        if (modelPrefsMatch) {
          const prefsSection = modelPrefsMatch[0];
          const firstModelMatch = prefsSection.match(/\*\*[^:]+:\*\*\s*(claude-[^\s-]+(?:-\d+)?)/);
          if (firstModelMatch) {
            let model = firstModelMatch[1].trim();
            model = model.replace(/-\d{8}$/, '');
            if (model !== 'claude-sonnet-4-6') {
              model = model.replace(/-6$/, '');
            }
            defaultModel = model;
          }
        }
      }
      
      const focusMatch = agentsContent.match(/\*\*Primary Focus:\*\*\s*(.+)/);
      if (focusMatch) {
        description = focusMatch[1].trim().replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
      } else {
        const lines = agentsContent.split('\n');
        let inIdentitySection = false;
        
        for (const line of lines) {
          const trimmed = line.trim();
          
          if (!trimmed || trimmed.startsWith('#')) {
            if (trimmed.toLowerCase().includes('## identity')) {
              inIdentitySection = true;
            } else if (trimmed.startsWith('##')) {
              inIdentitySection = false;
            }
            continue;
          }
          
          if (inIdentitySection) continue;
          if (trimmed.startsWith('-') || trimmed.startsWith('*')) continue;
          
          description = trimmed.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
          break;
        }
      }
    }

    // Read memory
    let memorySize = 0;
    const memoryFiles: string[] = [];
    const memoryPath = path.join(agentPath, 'MEMORY.md');
    if (fs.existsSync(memoryPath)) {
      const stats = fs.statSync(memoryPath);
      memorySize += stats.size;
      memoryFiles.push(`agents/${label}/MEMORY.md`);
    }

    const memoryDir = path.join(agentPath, 'memory');
    if (fs.existsSync(memoryDir)) {
      const dailyFiles = fs.readdirSync(memoryDir)
        .filter(f => f.endsWith('.md'))
        .sort()
        .reverse()
        .slice(0, 7);
      
      for (const file of dailyFiles) {
        const filePath = path.join(memoryDir, file);
        const stats = fs.statSync(filePath);
        memorySize += stats.size;
        memoryFiles.push(`agents/${label}/memory/${file}`);
      }
    }

    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes}B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    };

    // Check config.json for a user-saved preferred model
    const configPath = path.join(agentPath, 'config.json');
    let preferredModel: string | null = null;
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.preferredModel) preferredModel = config.preferredModel;
      } catch { /* ignore parse errors */ }
    }

    // Pull real last-active + status from activity_log
    let lastActive = 'never';
    let status = 'idle';
    let messageCount = 0;
    try {
      const lastEntry = (db as any).prepare(
        `SELECT timestamp, action_type FROM activity_log WHERE agent_label = ? ORDER BY timestamp DESC LIMIT 1`
      ).get(label) as { timestamp: number; action_type: string } | undefined;

      if (lastEntry) {
        const ageMs = Date.now() - lastEntry.timestamp;
        const ageMins = Math.floor(ageMs / 60000);
        const ageHours = Math.floor(ageMins / 60);
        const ageDays = Math.floor(ageHours / 24);

        if (ageMins < 60) {
          lastActive = `${ageMins}m ago`;
        } else if (ageHours < 24) {
          lastActive = `${ageHours}h ago`;
        } else {
          lastActive = `${ageDays}d ago`;
        }

        // "active" if last entry was within 2 hours and was an in-progress action type
        if (ageMs < 2 * 60 * 60 * 1000 && ['started', 'commit', 'pr_opened', 'research', 'analysis', 'writing', 'content'].includes(lastEntry.action_type)) {
          status = 'active';
        } else if (ageMs < 7 * 24 * 60 * 60 * 1000) {
          status = 'idle';
        } else {
          status = 'inactive';
        }
      }

      const countRow = (db as any).prepare(
        `SELECT COUNT(*) as cnt FROM activity_log WHERE agent_label = ?`
      ).get(label) as { cnt: number } | undefined;
      if (countRow) messageCount = countRow.cnt;
    } catch (e) {
      // activity_log query failed — fall back to defaults
    }

    const agent = {
      label,
      name,
      description,
      memory: {
        size: formatSize(memorySize),
        bytes: memorySize,
        files: memoryFiles
      },
      workspacePath: agentPath,
      status,
      messageCount,
      lastActive,
      model: preferredModel ?? defaultModel
    };

    return NextResponse.json({ agent });

  } catch (error) {
    console.error('Error fetching agent:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent details' },
      { status: 500 }
    );
  }
}
