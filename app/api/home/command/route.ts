import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import {
  createAgentApproval,
  createAgentRun,
  createAgentRunStep,
  updateAgentRun,
  upsertPersistentMemory,
} from '@/lib/agents/store';
import { HomeCommandIntent, HomeCommandResponse } from '@/lib/agents/types';

type CreateTicketDraft = {
  requestType?: string;
  system?: string;
  impact?: string;
  reason?: string;
  details: string;
};

function detectIntent(message: string): HomeCommandIntent {
  const text = message.toLowerCase();
  const createTicketSignals = [
    'raise ticket',
    'create ticket',
    'it request',
    'access request',
    'laptop',
    'vpn',
    'password reset',
    'software install',
    'subscription',
    'not working',
  ];
  const statusSignals = ['ticket status', 'status of ticket', 'check ticket', 'track ticket'];
  const policySignals = ['policy', 'leave', 'travel policy', 'rto', 'how many days', 'guideline'];

  if (statusSignals.some((s) => text.includes(s))) return 'check_ticket_status';
  if (createTicketSignals.some((s) => text.includes(s))) return 'create_it_ticket';
  if (policySignals.some((s) => text.includes(s))) return 'policy_question';
  return 'unknown';
}

function normalizeTicketNumber(input?: string | null) {
  if (!input) return null;
  const trimmed = input.trim().toUpperCase();
  const fullMatch = trimmed.match(/^[A-Z]{2}-\d{6}$/);
  if (fullMatch) return trimmed;

  const prefixMatch = trimmed.match(/^(IT|TR)[-_ ]?(\d{1,6})$/);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    const digits = prefixMatch[2].padStart(6, '0');
    return `${prefix}-${digits}`;
  }

  const digitMatch = trimmed.match(/(\d{1,6})/);
  if (digitMatch) return `IT-${digitMatch[1].padStart(6, '0')}`;
  return null;
}

async function classifyItDraft(origin: string, cookie: string, details: string) {
  try {
    const res = await fetch(`${origin}/api/service-desk/it/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ details }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const body = await req.json();
    const message = (body?.message || '').toString().trim();
    const sessionId = body?.sessionId ? String(body.sessionId) : null;
    const model = body?.model ? String(body.model) : null;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const intent = detectIntent(message);
    const origin = new URL(req.url).origin;
    const cookie = req.headers.get('cookie') || '';

    const run = await createAgentRun({
      userId: auth.userId,
      agent: 'home-orchestrator',
      sessionId,
      model,
      status: 'RUNNING',
      riskLevel: intent === 'create_it_ticket' ? 'MEDIUM' : 'LOW',
      input: { message, intent },
    });

    let stepNo = 1;
    await createAgentRunStep({
      runId: run.id,
      stepNo: stepNo++,
      phase: 'PLAN',
      status: 'COMPLETED',
      tool: 'intent_router',
      toolInput: { message },
      toolOutput: { intent },
      riskLevel: 'LOW',
    });

    if (intent === 'create_it_ticket') {
      const classification = await classifyItDraft(origin, cookie, message);
      const draft: CreateTicketDraft = {
        requestType: classification?.requestType || 'other',
        system: classification?.system || 'General',
        impact: classification?.impact || 'medium',
        reason: classification?.reason || message,
        details: message,
      };

      const step = await createAgentRunStep({
        runId: run.id,
        stepNo: stepNo++,
        phase: 'TOOL_CALL',
        status: 'WAITING_APPROVAL',
        tool: 'create_ticket',
        toolInput: draft,
        riskLevel: 'MEDIUM',
        requiresApproval: true,
      });

      const approval = await createAgentApproval({
        runId: run.id,
        stepId: step.id,
        requestedBy: auth.userId,
        metadata: {
          actionType: 'create_it_ticket',
          draft,
        },
      });

      await upsertPersistentMemory({
        userId: auth.userId,
        agent: 'home-orchestrator',
        memoryKey: 'last_it_ticket_draft',
        memoryValue: { runId: run.id, draft },
        source: 'home-command',
        sensitivity: 'internal',
        confidence: 0.9,
      });

      await updateAgentRun({
        runId: run.id,
        status: 'WAITING_APPROVAL',
        output: {
          intent,
          requiresConfirmation: true,
          approvalId: approval.id,
          draft,
        },
      });

      const response: HomeCommandResponse = {
        runId: run.id,
        status: 'WAITING_APPROVAL',
        intent,
        requiresConfirmation: true,
        actionCard: {
          type: 'confirm',
          title: 'Confirm IT Ticket Creation',
          description: 'I prepared an IT ticket draft. Review and confirm to submit.',
          data: {
            requestType: draft.requestType,
            system: draft.system,
            impact: draft.impact,
            reason: draft.reason,
            details: draft.details,
          },
        },
      };

      return NextResponse.json(response);
    }

    if (intent === 'check_ticket_status') {
      const ticketCandidate =
        message.match(/[A-Z]{2}[-_ ]?\d{1,6}/i)?.[0] || message.match(/\d{1,6}/)?.[0] || null;
      const ticketNumber = normalizeTicketNumber(ticketCandidate);

      if (!ticketNumber) {
        await updateAgentRun({
          runId: run.id,
          status: 'COMPLETED',
          ended: true,
          output: {
            intent,
            message: 'Please provide a ticket number like IT-000123.',
          },
        });

        return NextResponse.json({
          runId: run.id,
          status: 'COMPLETED',
          intent,
          requiresConfirmation: false,
          actionCard: {
            type: 'info',
            title: 'Ticket Number Needed',
            description: 'Please provide a ticket number like IT-000123.',
          },
        } satisfies HomeCommandResponse);
      }

      const startedAt = Date.now();
      const res = await fetch(
        `${origin}/api/service-desk/self-service/ticket-status?ticketNumber=${encodeURIComponent(ticketNumber)}`,
        { headers: { cookie } }
      );
      const data = await res.json();
      const latencyMs = Date.now() - startedAt;

      await createAgentRunStep({
        runId: run.id,
        stepNo: stepNo++,
        phase: 'TOOL_RESULT',
        status: res.ok ? 'COMPLETED' : 'FAILED',
        tool: 'check_ticket_status',
        toolInput: { ticketNumber },
        toolOutput: data,
        riskLevel: 'LOW',
        latencyMs,
        errorText: res.ok ? null : data?.error || 'Failed to check ticket status',
      });

      await updateAgentRun({
        runId: run.id,
        status: res.ok ? 'COMPLETED' : 'FAILED',
        ended: true,
        output: {
          intent,
          ticketNumber,
          result: data,
        },
        errorText: res.ok ? null : data?.error || 'Failed to check ticket status',
      });

      return NextResponse.json({
        runId: run.id,
        status: res.ok ? 'COMPLETED' : 'FAILED',
        intent,
        requiresConfirmation: false,
        actionCard: res.ok
          ? {
              type: 'result',
              title: `Ticket ${ticketNumber}`,
              description: data?.message || 'Ticket status retrieved.',
              data,
            }
          : {
              type: 'error',
              title: 'Failed to Check Ticket',
              description: data?.error || 'Unable to fetch ticket status right now.',
            },
      } satisfies HomeCommandResponse);
    }

    if (intent === 'policy_question') {
      await updateAgentRun({
        runId: run.id,
        status: 'COMPLETED',
        ended: true,
        output: {
          intent,
          routeTo: '/policy-agent',
        },
      });

      return NextResponse.json({
        runId: run.id,
        status: 'COMPLETED',
        intent,
        requiresConfirmation: false,
        actionCard: {
          type: 'info',
          title: 'Policy Query Detected',
          description:
            'This looks like a policy question. Next step is to run it through Ask Beacon policy flow.',
          data: { routeTo: '/policy-agent' },
        },
      } satisfies HomeCommandResponse);
    }

    await updateAgentRun({
      runId: run.id,
      status: 'COMPLETED',
      ended: true,
      output: {
        intent: 'unknown',
      },
    });

    return NextResponse.json({
      runId: run.id,
      status: 'COMPLETED',
      intent: 'unknown',
      requiresConfirmation: false,
      actionCard: {
        type: 'info',
        title: 'Need More Context',
        description:
          'I can help with IT requests, ticket status checks, or policy questions. Try one of those.',
      },
    } satisfies HomeCommandResponse);
  } catch (error: any) {
    console.error('Home command error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process home command' },
      { status: 500 }
    );
  }
}
