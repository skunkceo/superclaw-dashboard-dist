import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getOpenClawWorkspace } from '@/lib/workspace';


export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const openclawWorkspace = getOpenClawWorkspace();
    const rulesPath = path.join(openclawWorkspace, 'routing-rules.json');

    if (!fs.existsSync(rulesPath)) {
      return NextResponse.json({
        version: '1.0',
        rules: [],
        fallback: {
          agent: 'main',
          notify: true
        }
      });
    }

    const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));
    return NextResponse.json(rules);

  } catch (error) {
    console.error('Error reading routing rules:', error);
    return NextResponse.json(
      { error: 'Failed to read routing rules' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const openclawWorkspace = getOpenClawWorkspace();
    const rulesPath = path.join(openclawWorkspace, 'routing-rules.json');

    const rules = await request.json();
    
    fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 2));

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error saving routing rules:', error);
    return NextResponse.json(
      { error: 'Failed to save routing rules' },
      { status: 500 }
    );
  }
}
