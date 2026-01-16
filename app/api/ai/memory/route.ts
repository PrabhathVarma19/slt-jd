import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { clearAgentMemory, AgentName } from '@/lib/ai/agent-memory';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const body = await req.json();
    const agent = body?.agent as AgentName | undefined;
    const action = body?.action as string | undefined;

    if (!agent || !action) {
      return NextResponse.json(
        { error: 'agent and action are required' },
        { status: 400 }
      );
    }

    if (action === 'clear') {
      await clearAgentMemory(auth.userId, agent);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update agent memory' },
      { status: 500 }
    );
  }
}
