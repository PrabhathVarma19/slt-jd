import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { supabaseServer } from '@/lib/supabase/server';

function clampLimit(value: string | null) {
  const parsed = Number(value || '25');
  if (!Number.isFinite(parsed)) return 25;
  return Math.max(5, Math.min(100, Math.floor(parsed)));
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const limit = clampLimit(req.nextUrl.searchParams.get('limit'));

    const { data: runs, error } = await supabaseServer
      .from('AgentRun')
      .select('id,createdAt,status,input,output')
      .eq('userId', auth.userId)
      .eq('agent', 'home-orchestrator')
      .order('createdAt', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    const normalizedRuns = (runs || []).map((run: any) => {
      const input = run?.input && typeof run.input === 'object' ? run.input : {};
      const output = run?.output && typeof run.output === 'object' ? run.output : {};
      const actionCard = output?.actionCard && typeof output.actionCard === 'object' ? output.actionCard : {};
      const cardData = actionCard?.data && typeof actionCard.data === 'object' ? actionCard.data : {};

      const ticketId =
        typeof cardData?.ticket?.id === 'string'
          ? cardData.ticket.id
          : typeof cardData?.ticketId === 'string'
            ? cardData.ticketId
            : null;
      const ticketNumber =
        typeof cardData?.ticket?.ticketNumber === 'string'
          ? cardData.ticket.ticketNumber
          : typeof cardData?.ticketNumber === 'string'
            ? cardData.ticketNumber
            : null;
      const routeTo =
        typeof cardData?.routeTo === 'string'
          ? cardData.routeTo
          : ticketId
            ? `/tickets/${ticketId}`
            : null;

      return {
        id: run.id,
        createdAt: run.createdAt,
        status: run.status,
        intent:
          typeof output?.intent === 'string'
            ? output.intent
            : typeof input?.finalIntent === 'string'
              ? input.finalIntent
              : 'unknown',
        message: typeof input?.message === 'string' ? input.message : '',
        description: typeof actionCard?.description === 'string' ? actionCard.description : '',
        routeTo,
        ticketId,
        ticketNumber,
      };
    });

    return NextResponse.json({ runs: normalizedRuns });
  } catch (error: any) {
    console.error('Home history API error:', error);
    const message = (error?.message || '').toString();
    if (message.includes('Not authenticated')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch home history' },
      { status: 500 }
    );
  }
}
