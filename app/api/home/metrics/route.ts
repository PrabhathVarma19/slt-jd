import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';

type IntentKey =
  | 'create_it_ticket'
  | 'check_ticket_status'
  | 'password_reset'
  | 'policy_question'
  | 'comms_generate'
  | 'engineering_generate'
  | 'jd_generate'
  | 'unknown';

const KNOWN_INTENTS: IntentKey[] = [
  'create_it_ticket',
  'check_ticket_status',
  'password_reset',
  'policy_question',
  'comms_generate',
  'engineering_generate',
  'jd_generate',
  'unknown',
];

function clampDays(input: string | null) {
  const parsed = Number(input || '30');
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(1, Math.min(90, Math.floor(parsed)));
}

function incrementCount(map: Record<string, number>, key: string) {
  map[key] = (map[key] || 0) + 1;
}

function getMissingFieldsFromRunOutput(output: any): string[] {
  if (!output || typeof output !== 'object') return [];
  const direct = Array.isArray(output.missingFields) ? output.missingFields : [];
  const draftNested = Array.isArray(output?.draft?.missingFields) ? output.draft.missingFields : [];
  return [...direct, ...draftNested]
    .filter((field) => typeof field === 'string' && field.trim().length > 0)
    .map((field) => field.trim());
}

export async function GET(req: NextRequest) {
  try {
    await requireSessionRole(['SUPER_ADMIN']);

    const periodDays = clampDays(req.nextUrl.searchParams.get('days'));
    const sinceIso = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

    const { data: runs, error: runsError } = await supabaseServer
      .from('AgentRun')
      .select('id,status,error,startedAt,endedAt,input,output')
      .eq('agent', 'home-orchestrator')
      .gte('createdAt', sinceIso)
      .order('createdAt', { ascending: false });

    if (runsError) {
      throw new Error(runsError.message);
    }

    const runRows = runs || [];
    const runIds = runRows.map((row: any) => row.id).filter(Boolean);

    const approvalCounts: Record<string, number> = {
      APPROVED: 0,
      REJECTED: 0,
      PENDING: 0,
      CANCELLED: 0,
    };
    if (runIds.length > 0) {
      const { data: approvals, error: approvalsError } = await supabaseServer
        .from('AgentApproval')
        .select('decision')
        .in('runId', runIds);

      if (approvalsError) {
        throw new Error(approvalsError.message);
      }

      (approvals || []).forEach((approval: any) => {
        const decision = (approval?.decision || '').toString().toUpperCase();
        if (approvalCounts[decision] !== undefined) {
          approvalCounts[decision] += 1;
        }
      });
    }

    const byIntent: Record<string, number> = {};
    KNOWN_INTENTS.forEach((intent) => {
      byIntent[intent] = 0;
    });

    const statusCounts: Record<string, number> = {
      PENDING: 0,
      WAITING_APPROVAL: 0,
      RUNNING: 0,
      COMPLETED: 0,
      FAILED: 0,
      CANCELLED: 0,
    };

    const missingFieldCounts: Record<string, number> = {};
    const errorCounts: Record<string, number> = {};

    let completedCount = 0;
    let totalCompletionMs = 0;

    runRows.forEach((run: any) => {
      const status = (run?.status || '').toString().toUpperCase();
      if (statusCounts[status] !== undefined) {
        statusCounts[status] += 1;
      }

      const finalIntent = run?.input?.finalIntent;
      if (typeof finalIntent === 'string' && byIntent[finalIntent] !== undefined) {
        byIntent[finalIntent] += 1;
      } else {
        byIntent.unknown += 1;
      }

      const runError = (run?.error || '').toString().trim();
      if (runError) {
        incrementCount(errorCounts, runError);
      }

      getMissingFieldsFromRunOutput(run?.output).forEach((field) => {
        incrementCount(missingFieldCounts, field);
      });

      if (status === 'COMPLETED' && run?.startedAt && run?.endedAt) {
        const started = new Date(run.startedAt).getTime();
        const ended = new Date(run.endedAt).getTime();
        if (Number.isFinite(started) && Number.isFinite(ended) && ended >= started) {
          totalCompletionMs += ended - started;
          completedCount += 1;
        }
      }
    });

    const topMissingFields = Object.entries(missingFieldCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([field, count]) => ({ field, count }));

    const topErrors = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }));

    return NextResponse.json({
      periodDays,
      generatedAt: new Date().toISOString(),
      summary: {
        totalRuns: runRows.length,
        avgCompletionMs: completedCount > 0 ? Math.round(totalCompletionMs / completedCount) : null,
      },
      byIntent,
      approval: approvalCounts,
      status: statusCounts,
      topMissingFields,
      topErrors,
    });
  } catch (error: any) {
    console.error('Home metrics API error:', error);
    const message = (error?.message || '').toString();
    if (message.includes('Not authenticated')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (message.includes('Access denied')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: error?.message || 'Failed to fetch home metrics' }, { status: 500 });
  }
}
