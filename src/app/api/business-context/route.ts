import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getBusinessContext,
  saveBusinessContext,
  initializeBusinessContext,
  readOpenClawWorkspace,
  isOnboardingComplete,
  completeOnboarding,
  BusinessContext,
} from '@/lib/business-context';

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const context = getBusinessContext();
  const onboardingComplete = isOnboardingComplete();
  
  // Also read workspace to show what's available
  const workspaceContext = await readOpenClawWorkspace();
  
  return NextResponse.json({
    context,
    onboardingComplete,
    workspaceContext,
  });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json() as { context?: Partial<BusinessContext>; completeOnboarding?: boolean };
    
    if (body.completeOnboarding) {
      completeOnboarding();
      return NextResponse.json({ success: true, onboardingComplete: true });
    }
    
    if (body.context) {
      const initialized = await initializeBusinessContext(body.context);
      return NextResponse.json({ success: true, context: initialized });
    }
    
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save context', detail: String(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const context = await request.json() as BusinessContext;
    saveBusinessContext(context);
    return NextResponse.json({ success: true, context });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update context', detail: String(error) }, { status: 500 });
  }
}
