import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

const LINEAR_API = 'https://api.linear.app/graphql';

const QUERY = `{
  initiatives(first: 20) {
    nodes {
      id
      name
      status
      description
      url
      projects {
        nodes {
          id
          name
          url
          state
          issues(first: 3) {
            nodes {
              identifier
              title
              url
              state { name }
              priority
            }
          }
        }
      }
    }
  }
}`;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'LINEAR_API_KEY not configured' }, { status: 500 });

  try {
    const res = await fetch(LINEAR_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify({ query: QUERY }),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Linear API error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const initiatives = data?.data?.initiatives?.nodes || [];

    // Sort: Active first, then Planned, then Completed
    const order: Record<string, number> = { Active: 0, Planned: 1, Completed: 2 };
    initiatives.sort((a: any, b: any) => (order[a.status] ?? 9) - (order[b.status] ?? 9));

    return NextResponse.json({ initiatives });
  } catch (err) {
    console.error('Initiatives API error:', err);
    return NextResponse.json({ error: 'Failed to fetch initiatives' }, { status: 500 });
  }
}
