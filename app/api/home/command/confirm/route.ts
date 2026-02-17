import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { supabaseServer } from '@/lib/supabase/server';
import {
  getPendingApprovalForRun,
  getRunById,
  setAgentApprovalDecision,
  updateAgentRun,
  updateAgentRunStep,
  upsertPersistentMemory,
} from '@/lib/agents/store';

async function createItTicketFromDraft(
  req: NextRequest,
  draft: Record<string, any>,
  userId: string,
  userEmail: string
) {
  const { data: profile } = await supabaseServer
    .from('UserProfile')
    .select('empName, employeeId, gradeCode, location, projectCode, projectName, supervisorEmail')
    .eq('userId', userId)
    .maybeSingle();

  if (!profile?.employeeId) {
    throw new Error('Employee profile is missing. Please contact IT support.');
  }

  const origin = new URL(req.url).origin;
  const cookie = req.headers.get('cookie') || '';
  const payload = {
    name: profile.empName || 'Employee',
    employeeId: profile.employeeId,
    email: draft.email || userEmail,
    grade: profile.gradeCode || '',
    location: profile.location || '',
    requestType: draft.requestType || 'other',
    system: draft.system || 'General',
    impact: draft.impact || 'medium',
    reason: draft.reason || draft.details || 'Not specified',
    durationType: draft.durationType || '',
    durationUntil: draft.durationUntil || '',
    details: draft.details || 'No additional details provided.',
    projectCode: profile.projectCode || '',
    projectName: profile.projectName || '',
    managerEmail: profile.supervisorEmail || '',
  };

  const res = await fetch(`${origin}/api/service-desk/it`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify(payload),
  });
  const data = await res.json();

  if (!res.ok || data?.error) {
    throw new Error(data?.error || 'Failed to create IT ticket');
  }

  return data;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const body = await req.json();
    const runId = (body?.runId || '').toString().trim();
    const approve = !!body?.approve;
    const reason = body?.reason ? String(body.reason) : null;

    if (!runId) {
      return NextResponse.json({ error: 'runId is required' }, { status: 400 });
    }

    const run = await getRunById(runId);
    if (!run || run.userId !== auth.userId) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const pendingApproval = await getPendingApprovalForRun(runId);
    if (!pendingApproval) {
      return NextResponse.json({ error: 'No pending approval found for this run' }, { status: 400 });
    }

    if (!approve) {
      await setAgentApprovalDecision({
        approvalId: pendingApproval.id,
        decision: 'REJECTED',
        reason,
        approverUserId: auth.userId,
      });

      await updateAgentRunStep({
        stepId: pendingApproval.stepId,
        status: 'SKIPPED',
        errorText: reason || 'Rejected by user',
      });

      await updateAgentRun({
        runId,
        status: 'CANCELLED',
        ended: true,
        errorText: reason || 'Rejected by user',
        output: {
          decision: 'REJECTED',
        },
      });

      return NextResponse.json({
        runId,
        status: 'CANCELLED',
        approved: false,
        actionCard: {
          type: 'info',
          title: 'Action Cancelled',
          description: reason || 'The action was not approved.',
        },
      });
    }

    await setAgentApprovalDecision({
      approvalId: pendingApproval.id,
      decision: 'APPROVED',
      reason,
      approverUserId: auth.userId,
    });

    await updateAgentRunStep({
      stepId: pendingApproval.stepId,
      status: 'RUNNING',
    });

    const actionType = pendingApproval?.metadata?.actionType as string | undefined;
    const draft = pendingApproval?.metadata?.draft as Record<string, any> | undefined;

    if (actionType !== 'create_it_ticket' || !draft) {
      await updateAgentRunStep({
        stepId: pendingApproval.stepId,
        status: 'FAILED',
        errorText: 'Unsupported approval action',
      });
      await updateAgentRun({
        runId,
        status: 'FAILED',
        ended: true,
        errorText: 'Unsupported approval action',
      });
      return NextResponse.json({ error: 'Unsupported approval action' }, { status: 400 });
    }

    const startedAt = Date.now();
    const result = await createItTicketFromDraft(req, draft, auth.userId, auth.email);
    const latencyMs = Date.now() - startedAt;

    await updateAgentRunStep({
      stepId: pendingApproval.stepId,
      status: 'COMPLETED',
      toolOutput: result,
      latencyMs,
    });

    await updateAgentRun({
      runId,
      status: 'COMPLETED',
      ended: true,
      output: {
        decision: 'APPROVED',
        result,
      },
    });

    await upsertPersistentMemory({
      userId: auth.userId,
      agent: 'home-orchestrator',
      memoryKey: 'last_it_ticket_result',
      memoryValue: {
        runId,
        ticketNumber: result?.ticketNumber || null,
        status: result?.status || null,
      },
      source: 'home-command-confirm',
      sensitivity: 'internal',
      confidence: 1,
    });

    return NextResponse.json({
      runId,
      status: 'COMPLETED',
      approved: true,
      result,
      actionCard: {
        type: 'result',
        title: 'IT Ticket Submitted',
        description:
          result?.message ||
          (result?.ticketNumber
            ? `Created ticket ${result.ticketNumber}.`
            : 'Ticket request submitted successfully.'),
        data: { ticketNumber: result?.ticketNumber || null },
      },
    });
  } catch (error: any) {
    console.error('Home command confirm error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process approval decision' },
      { status: 500 }
    );
  }
}
