import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { supabaseServer } from '@/lib/supabase/server';
import {
  getPersistentMemory,
  getPendingApprovalForRun,
  getRunById,
  setAgentApprovalDecision,
  updateAgentRun,
  updateAgentRunStep,
  upsertPersistentMemory,
} from '@/lib/agents/store';
import { evaluateItTicketDraft } from '@/lib/home/it-ticket-rules';

function normalizeAliasKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractSoftwareCandidate(details: string) {
  const installPrefix =
    details.match(/\b(?:install|setup|set up)\s+([a-zA-Z0-9][a-zA-Z0-9 .+\-_/]{1,80}?)(?:\s+(?:for|on|in)\b|$)/i)?.[1] ||
    '';
  const installationSuffix =
    details.match(/\b([a-zA-Z0-9][a-zA-Z0-9 .+\-_/]{1,80}?)\s+installation\b/i)?.[1] || '';
  const raw = (installPrefix || installationSuffix || '').trim();
  return raw
    .replace(/^(?:i\s+need|need|please|kindly|want|require)\s+/i, '')
    .replace(/[.,;:]+$/, '')
    .trim();
}

async function saveSystemAliasFromCorrection(params: {
  userId: string;
  originalSystem?: string;
  correctedSystem?: string;
  details?: string;
}) {
  const corrected = (params.correctedSystem || '').trim();
  if (!corrected) return;

  const original = (params.originalSystem || '').trim();
  const detailCandidate = extractSoftwareCandidate((params.details || '').trim());
  const aliasSources = [detailCandidate, original]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const existing = await getPersistentMemory({
    userId: params.userId,
    agent: 'home-orchestrator',
    memoryKey: 'it_system_aliases',
  });
  const aliases =
    existing?.memoryValue && typeof existing.memoryValue === 'object'
      ? { ...(existing.memoryValue.aliases || {}) }
      : {};

  let changed = false;
  for (const source of aliasSources) {
    if (!source) continue;
    if (source.toLowerCase() === corrected.toLowerCase()) continue;
    if (source.toLowerCase() === 'software') continue;
    const key = normalizeAliasKey(source);
    if (!key) continue;
    if (aliases[key] !== corrected) {
      aliases[key] = corrected;
      changed = true;
    }
  }

  if (!changed) return;
  await upsertPersistentMemory({
    userId: params.userId,
    agent: 'home-orchestrator',
    memoryKey: 'it_system_aliases',
    memoryValue: { aliases },
    source: 'home-command-confirm',
    sensitivity: 'internal',
    confidence: 0.95,
  });
}

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
    const draftPatchInput =
      body?.draftPatch && typeof body.draftPatch === 'object' ? body.draftPatch : {};

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

    const draftPatch = {
      requestType: draftPatchInput?.requestType ? String(draftPatchInput.requestType) : undefined,
      system: draftPatchInput?.system ? String(draftPatchInput.system) : undefined,
      impact: draftPatchInput?.impact ? String(draftPatchInput.impact) : undefined,
      reason: draftPatchInput?.reason ? String(draftPatchInput.reason) : undefined,
      details: draftPatchInput?.details ? String(draftPatchInput.details) : undefined,
      durationType: draftPatchInput?.durationType ? String(draftPatchInput.durationType) : undefined,
      durationUntil: draftPatchInput?.durationUntil ? String(draftPatchInput.durationUntil) : undefined,
    };

    const mergedDraft = {
      ...draft,
      ...Object.fromEntries(
        Object.entries(draftPatch).filter(
          ([, value]) => typeof value === 'string' && value.trim().length > 0
        )
      ),
    };

    const missingFields = evaluateItTicketDraft(mergedDraft).missingFields;
    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: 'Please fill required fields before approval.',
          missingFields,
          actionCard: {
            type: 'confirm',
            title: 'More Details Needed',
            description: 'Please fill required fields and click Approve & Run again.',
            data: {
              ...mergedDraft,
              missingFields,
            },
          },
        },
        { status: 400 }
      );
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

    const startedAt = Date.now();
    const result = await createItTicketFromDraft(req, mergedDraft, auth.userId, auth.email);
    const latencyMs = Date.now() - startedAt;

    await saveSystemAliasFromCorrection({
      userId: auth.userId,
      originalSystem: draft.system,
      correctedSystem: mergedDraft.system,
      details: mergedDraft.details,
    });

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
