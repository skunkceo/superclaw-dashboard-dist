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
    const openclawWorkspace = getOpenClawWorkspace();
    const agentPath = path.join(openclawWorkspace, 'agents', label);

    if (!fs.existsSync(agentPath)) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Read MEMORY.md
    const memoryPath = path.join(agentPath, 'MEMORY.md');
    let longTerm: string | null = null;
    if (fs.existsSync(memoryPath)) {
      longTerm = fs.readFileSync(memoryPath, 'utf-8');
    }

    // Read today's daily memory
    const today = new Date().toISOString().split('T')[0];
    const memoryDir = path.join(agentPath, 'memory');
    const todayPath = path.join(memoryDir, `${today}.md`);
    let todayMemory: string | null = null;
    if (fs.existsSync(todayPath)) {
      todayMemory = fs.readFileSync(todayPath, 'utf-8');
    }

    // Get list of recent daily memory files
    const recentDays: string[] = [];
    if (fs.existsSync(memoryDir)) {
      const files = fs.readdirSync(memoryDir)
        .filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
        .sort()
        .reverse();
      
      recentDays.push(...files.slice(0, 7).map(f => f.replace('.md', '')));
    }

    return NextResponse.json({
      longTerm,
      today: todayMemory,
      recentDays
    });

  } catch (error) {
    console.error('Error fetching agent memory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch memory' },
      { status: 500 }
    );
  }
}
