import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';
import { getOpenClawWorkspace } from '@/lib/workspace';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role === 'view') return NextResponse.json({ error: 'Permission denied' }, { status: 403 });

  const { name, label, description, emoji = '🤖' } = await request.json();

  if (!name || !label) {
    return NextResponse.json({ error: 'Name and label are required' }, { status: 400 });
  }

  // Sanitise label — lowercase, hyphens only
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!safeLabel) return NextResponse.json({ error: 'Invalid label' }, { status: 400 });

  const agentsDir = path.join(getOpenClawWorkspace(), 'agents');
  const agentPath = path.join(agentsDir, safeLabel);

  if (fs.existsSync(agentPath)) {
    return NextResponse.json({ error: `Agent "${safeLabel}" already exists` }, { status: 409 });
  }

  fs.mkdirSync(path.join(agentPath, 'memory'), { recursive: true });

  fs.writeFileSync(path.join(agentPath, 'IDENTITY.md'), `# IDENTITY.md\n\n- **Name:** ${name}\n- **Label:** ${safeLabel}\n- **Emoji:** ${emoji}\n`);

  fs.writeFileSync(path.join(agentPath, 'MEMORY.md'), `# MEMORY.md - ${name}\n\nAgent-specific context and knowledge will be recorded here.\n`);

  fs.writeFileSync(path.join(agentPath, 'AGENTS.md'), `# ${name} Agent ${emoji}\n\n## Identity\n\n- **Name:** ${name}\n- **Label:** \`${safeLabel}\`\n- **Emoji:** ${emoji}\n- **Primary Focus:** ${description || 'Specialist agent'}\n\n## Responsibilities\n\nDefine responsibilities here.\n\n## Working Memory\n\nThis agent maintains memory specific to:\n- (add focus areas)\n\n## Communication Style\n\n- Direct and focused\n- Ask clarifying questions when requirements are unclear\n- Report blockers immediately\n`);

  return NextResponse.json({ success: true, label: safeLabel, name, path: agentPath });
}
