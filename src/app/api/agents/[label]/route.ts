import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getOpenClawWorkspace } from '@/lib/workspace';

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
        // Extract and shorten the model name
        let model = defaultModelMatch[1].trim();
        // Strip version date suffix (e.g. claude-sonnet-4-20250514 → claude-sonnet-4)
        model = model.replace(/-\d{8}$/, '');
        if (model !== 'claude-sonnet-4-6') {
          model = model.replace(/-6$/, '');
        }
        defaultModel = model;
      } else {
        // Look for first entry under Model Preferences section
        const modelPrefsMatch = agentsContent.match(/## Model Preferences[\s\S]*?(?=\n##|$)/);
        if (modelPrefsMatch) {
          const prefsSection = modelPrefsMatch[0];
          const firstModelMatch = prefsSection.match(/\*\*[^:]+:\*\*\s*(claude-[^\s-]+(?:-\d+)?)/);
          if (firstModelMatch) {
            let model = firstModelMatch[1].trim();
            // Strip version date suffix
            model = model.replace(/-\d{8}$/, '');
            if (model !== 'claude-sonnet-4-6') {
              model = model.replace(/-6$/, '');
            }
            defaultModel = model;
          }
        }
      }
      
      // Try to find "Primary Focus" line (better description)
      const focusMatch = agentsContent.match(/\*\*Primary Focus:\*\*\s*(.+)/);
      if (focusMatch) {
        // Remove emoji from description
        description = focusMatch[1].trim().replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
      } else {
        // Fall back to first paragraph after headers, but skip Identity section
        const lines = agentsContent.split('\n');
        let inIdentitySection = false;
        
        for (const line of lines) {
          const trimmed = line.trim();
          
          // Skip empty lines and headers
          if (!trimmed || trimmed.startsWith('#')) {
            // Check if this is the Identity section header
            if (trimmed.toLowerCase().includes('## identity')) {
              inIdentitySection = true;
            } else if (trimmed.startsWith('##')) {
              inIdentitySection = false; // Moved to a different section
            }
            continue;
          }
          
          // Skip lines in Identity section (bullet points with Name, Label, etc.)
          if (inIdentitySection) continue;
          
          // Skip markdown bullets/lists
          if (trimmed.startsWith('-') || trimmed.startsWith('*')) continue;
          
          // Found a good description line - remove emoji
          description = trimmed.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim();
          break;
        }
      }
    }

    // Read memory — store paths relative to workspace root so workspace links resolve correctly
    let memorySize = 0;
    const memoryFiles: string[] = [];
    const memoryPath = path.join(agentPath, 'MEMORY.md');
    if (fs.existsSync(memoryPath)) {
      const stats = fs.statSync(memoryPath);
      memorySize += stats.size;
      memoryFiles.push(`agents/${label}/MEMORY.md`);
    }

    // Read daily memory files
    const memoryDir = path.join(agentPath, 'memory');
    if (fs.existsSync(memoryDir)) {
      const dailyFiles = fs.readdirSync(memoryDir)
        .filter(f => f.endsWith('.md'))
        .sort()
        .reverse()
        .slice(0, 7); // Last 7 days
      
      for (const file of dailyFiles) {
        const filePath = path.join(memoryDir, file);
        const stats = fs.statSync(filePath);
        memorySize += stats.size;
        memoryFiles.push(`agents/${label}/memory/${file}`);
      }
    }

    // Format memory size
    const formatSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes}B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    };

    // Check config.json for a user-saved preferred model (overrides AGENTS.md default)
    const configPath = path.join(agentPath, 'config.json');
    let preferredModel: string | null = null;
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.preferredModel) preferredModel = config.preferredModel;
      } catch { /* ignore parse errors */ }
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
      // TODO: Get session data from OpenClaw sessions API
      status: 'idle',
      messageCount: 0,
      lastActive: 'never',
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
