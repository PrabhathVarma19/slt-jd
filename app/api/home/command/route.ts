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

function buildRoute(path: string, params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (!value) return;
    searchParams.set(key, value);
  });
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
}

function detectIntent(message: string): HomeCommandIntent {
  const text = message.toLowerCase();
  const passwordSignals = ['reset password', 'forgot password', 'password reset', 'unlock account'];
  const commsSignals = ['newsletter', 'announcement', 'email draft', 'comms', 'communication'];
  const engineeringSignals = ['release notes', 'pr summary', 'post mortem', 'post-mortem', 'incident report'];
  const jdSignals = ['job description', 'jd for', 'create jd', 'hiring role', 'role description'];
  const createTicketSignals = [
    'raise ticket',
    'create ticket',
    'it request',
    'access request',
    'laptop',
    'vpn',
    'software install',
    'subscription',
    'not working',
  ];
  const statusSignals = ['ticket status', 'status of ticket', 'check ticket', 'track ticket'];
  const policySignals = ['policy', 'leave', 'travel policy', 'rto', 'how many days', 'guideline'];

  if (passwordSignals.some((s) => text.includes(s))) return 'password_reset';
  if (engineeringSignals.some((s) => text.includes(s))) return 'engineering_generate';
  if (commsSignals.some((s) => text.includes(s))) return 'comms_generate';
  if (jdSignals.some((s) => text.includes(s))) return 'jd_generate';
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
      const startedAt = Date.now();
      const res = await fetch(`${origin}/api/policy-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          question: message,
          messages: [{ role: 'user', content: message }],
          mode: 'default',
          style: 'standard',
        }),
      });
      const data = await res.json();
      const latencyMs = Date.now() - startedAt;

      await createAgentRunStep({
        runId: run.id,
        stepNo: stepNo++,
        phase: 'TOOL_RESULT',
        status: res.ok ? 'COMPLETED' : 'FAILED',
        tool: 'policy_agent',
        toolInput: { question: message },
        toolOutput: data,
        riskLevel: 'LOW',
        latencyMs,
        errorText: res.ok ? null : data?.error || 'Failed to fetch policy answer',
      });

      await updateAgentRun({
        runId: run.id,
        status: res.ok ? 'COMPLETED' : 'FAILED',
        ended: true,
        output: {
          intent,
          result: data,
        },
        errorText: res.ok ? null : data?.error || 'Failed to fetch policy answer',
      });

      return NextResponse.json({
        runId: run.id,
        status: res.ok ? 'COMPLETED' : 'FAILED',
        intent,
        requiresConfirmation: false,
        actionCard: res.ok
          ? {
              type: 'result',
              title: 'Policy Answer',
              description: data?.answer || 'Policy answer generated.',
              data: {
                keyRules: data?.keyRules || null,
                sources: data?.sources || [],
              },
            }
          : {
              type: 'error',
              title: 'Policy Lookup Failed',
              description: data?.error || 'Unable to fetch policy answer right now.',
            },
      } satisfies HomeCommandResponse);
    }

    if (intent === 'comms_generate') {
      const startedAt = Date.now();
      const res = await fetch(`${origin}/api/comms-hub`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          mode: 'team',
          template: 'default',
          audience: 'org',
          formality: 'medium',
          content: message,
          include_links: false,
          include_section_headers: true,
          include_deltas: false,
        }),
      });
      const data = await res.json();
      const latencyMs = Date.now() - startedAt;

      await createAgentRunStep({
        runId: run.id,
        stepNo: stepNo++,
        phase: 'TOOL_RESULT',
        status: res.ok ? 'COMPLETED' : 'FAILED',
        tool: 'comms_hub',
        toolInput: { content: message },
        toolOutput: data,
        riskLevel: 'LOW',
        latencyMs,
        errorText: res.ok ? null : data?.error || 'Failed to generate communication draft',
      });

      await updateAgentRun({
        runId: run.id,
        status: res.ok ? 'COMPLETED' : 'FAILED',
        ended: true,
        output: { intent, result: data },
        errorText: res.ok ? null : data?.error || 'Failed to generate communication draft',
      });

      return NextResponse.json({
        runId: run.id,
        status: res.ok ? 'COMPLETED' : 'FAILED',
        intent,
        requiresConfirmation: false,
        actionCard: res.ok
          ? {
              type: 'result',
              title: data?.subject || 'Comms Draft Generated',
              description: data?.summary || 'Generated a communication draft from your prompt.',
              data: {
                routeTo: buildRoute('/comms-hub', {
                  panel: 'builder',
                  mode: 'team',
                  audience: 'org',
                  formality: 'medium',
                  content: message.slice(0, 4000),
                  subject: (data?.subject || '').slice(0, 180),
                }),
                text: data?.text_body || null,
                sections: data?.sections || [],
              },
            }
          : {
              type: 'error',
              title: 'Comms Generation Failed',
              description: data?.error || 'Unable to generate communication draft right now.',
            },
      } satisfies HomeCommandResponse);
    }

    if (intent === 'engineering_generate') {
      const lower = message.toLowerCase();
      const tool: 'release_notes' | 'pr_summary' | 'post_mortem' = lower.includes('pr summary')
        ? 'pr_summary'
        : lower.includes('post mortem') || lower.includes('post-mortem')
          ? 'post_mortem'
          : 'release_notes';

      const payload =
        tool === 'release_notes'
          ? {
              tool,
              release_name: 'Quick Home Draft',
              audience: 'internal',
              change_list: message,
            }
          : tool === 'pr_summary'
            ? {
                tool,
                pr_title: message.slice(0, 120),
                pr_description: message,
                files_touched: 'Not provided',
              }
            : {
                tool,
                incident_title: message.slice(0, 120),
                impact: 'To be refined',
                timeline: message,
                mitigation: 'To be refined',
              };

      const startedAt = Date.now();
      const res = await fetch(`${origin}/api/engineering-tools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const latencyMs = Date.now() - startedAt;

      await createAgentRunStep({
        runId: run.id,
        stepNo: stepNo++,
        phase: 'TOOL_RESULT',
        status: res.ok ? 'COMPLETED' : 'FAILED',
        tool: 'engineering_tools',
        toolInput: payload,
        toolOutput: data,
        riskLevel: 'LOW',
        latencyMs,
        errorText: res.ok ? null : data?.error || 'Failed to generate engineering output',
      });

      await updateAgentRun({
        runId: run.id,
        status: res.ok ? 'COMPLETED' : 'FAILED',
        ended: true,
        output: { intent, result: data },
        errorText: res.ok ? null : data?.error || 'Failed to generate engineering output',
      });

      return NextResponse.json({
        runId: run.id,
        status: res.ok ? 'COMPLETED' : 'FAILED',
        intent,
        requiresConfirmation: false,
        actionCard: res.ok
          ? {
              type: 'result',
              title: 'Engineering Draft Generated',
              description: `Generated ${tool.replace('_', ' ')} output.`,
              data: {
                routeTo:
                  tool === 'release_notes'
                    ? buildRoute('/engineering-tools', {
                        tool: 'release_notes',
                        release_name: 'Quick Home Draft',
                        audience: 'internal',
                        change_list: message.slice(0, 4000),
                      })
                    : tool === 'pr_summary'
                      ? buildRoute('/engineering-tools', {
                          tool: 'pr_summary',
                          pr_title: message.slice(0, 120),
                          pr_description: message.slice(0, 4000),
                          files_touched: 'Not provided',
                        })
                      : buildRoute('/engineering-tools', {
                          tool: 'post_mortem',
                          incident_title: message.slice(0, 120),
                          impact: 'To be refined',
                          timeline: message.slice(0, 4000),
                          mitigation: 'To be refined',
                        }),
                output: data?.output || data,
              },
            }
          : {
              type: 'error',
              title: 'Engineering Generation Failed',
              description: data?.error || 'Unable to generate engineering output right now.',
            },
      } satisfies HomeCommandResponse);
    }

    if (intent === 'jd_generate') {
      const titleMatch =
        message.match(/(?:jd for|job description for|role description for)\s+(.+)/i)?.[1] || null;
      const jobTitle = (titleMatch || message).slice(0, 80).trim() || 'Software Engineer';
      const payload = {
        job_title: jobTitle,
        context: message,
        tone: 'standard',
        seniority: 'mid',
        length: 'standard',
      };

      const startedAt = Date.now();
      const res = await fetch(`${origin}/api/generate-jd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const latencyMs = Date.now() - startedAt;

      await createAgentRunStep({
        runId: run.id,
        stepNo: stepNo++,
        phase: 'TOOL_RESULT',
        status: res.ok ? 'COMPLETED' : 'FAILED',
        tool: 'generate_jd',
        toolInput: payload,
        toolOutput: data,
        riskLevel: 'LOW',
        latencyMs,
        errorText: res.ok ? null : data?.error || 'Failed to generate JD',
      });

      await updateAgentRun({
        runId: run.id,
        status: res.ok ? 'COMPLETED' : 'FAILED',
        ended: true,
        output: { intent, result: data },
        errorText: res.ok ? null : data?.error || 'Failed to generate JD',
      });

      return NextResponse.json({
        runId: run.id,
        status: res.ok ? 'COMPLETED' : 'FAILED',
        intent,
        requiresConfirmation: false,
        actionCard: res.ok
          ? {
              type: 'result',
              title: `JD Draft: ${data?.job_title || jobTitle}`,
              description: data?.sections?.summary || 'Generated a JD draft.',
              data: {
                routeTo: data?.jd_id ? `/jd?jd=${data.jd_id}` : '/jd',
                jd_id: data?.jd_id || null,
              },
            }
          : {
              type: 'error',
              title: 'JD Generation Failed',
              description: data?.error || 'Unable to generate JD right now.',
            },
      } satisfies HomeCommandResponse);
    }

    if (intent === 'password_reset') {
      const startedAt = Date.now();
      const res = await fetch(`${origin}/api/service-desk/self-service/password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      const latencyMs = Date.now() - startedAt;

      await createAgentRunStep({
        runId: run.id,
        stepNo: stepNo++,
        phase: 'TOOL_RESULT',
        status: res.ok ? 'COMPLETED' : 'FAILED',
        tool: 'password_reset',
        toolInput: {},
        toolOutput: data,
        riskLevel: 'LOW',
        latencyMs,
        errorText: res.ok ? null : data?.error || 'Failed to process password reset',
      });

      await updateAgentRun({
        runId: run.id,
        status: res.ok ? 'COMPLETED' : 'FAILED',
        ended: true,
        output: {
          intent,
          result: data,
        },
        errorText: res.ok ? null : data?.error || 'Failed to process password reset',
      });

      return NextResponse.json({
        runId: run.id,
        status: res.ok ? 'COMPLETED' : 'FAILED',
        intent,
        requiresConfirmation: false,
        actionCard: res.ok
          ? {
              type: 'result',
              title: 'Password Reset',
              description: data?.message || 'Password reset request submitted.',
              data,
            }
          : {
              type: 'error',
              title: 'Password Reset Failed',
              description: data?.error || 'Unable to process password reset right now.',
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
          'I can help with IT requests, ticket status checks, password reset, policy questions, comms drafts, engineering drafts, or JD generation.',
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
