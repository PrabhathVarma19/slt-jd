import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { getRunWithDetails } from '@/lib/agents/store';

export async function GET(
  _req: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    const runId = context.params.id;
    if (!runId) {
      return NextResponse.json({ error: 'Run id is required' }, { status: 400 });
    }

    const details = await getRunWithDetails(runId);
    if (!details.run || details.run.userId !== auth.userId) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json(details);
  } catch (error: any) {
    console.error('Get run details error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch run details' },
      { status: 500 }
    );
  }
}
