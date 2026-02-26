import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  checkGSCStatus,
  checkGA4Status,
  checkGitHubStatus,
  checkLinearStatus,
  saveGSCCredentials,
  saveGA4Credentials,
  saveGitHubCredentials,
  saveLinearCredentials,
} from '@/lib/integrations';

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [gsc, ga4, github, linear] = await Promise.all([
      checkGSCStatus(),
      checkGA4Status(),
      checkGitHubStatus(),
      checkLinearStatus(),
    ]);

    return NextResponse.json({
      integrations: {
        gsc,
        ga4,
        github,
        linear,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to check integration status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role === 'view') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { integration, credentials } = body;

    switch (integration) {
      case 'gsc':
        saveGSCCredentials(credentials);
        break;
      case 'ga4':
        saveGA4Credentials(credentials);
        break;
      case 'github':
        saveGitHubCredentials(credentials);
        break;
      case 'linear':
        saveLinearCredentials(credentials);
        break;
      default:
        return NextResponse.json({ error: 'Unknown integration' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to save credentials' },
      { status: 500 }
    );
  }
}
