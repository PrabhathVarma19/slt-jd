import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAuth } from '@/lib/auth/require-auth';
import {
  createAgentApproval,
  createAgentRun,
  createAgentRunStep,
  getLatestPendingHomeApprovalForUser,
  updateAgentApprovalMetadata,
  updateAgentRun,
  upsertPersistentMemory,
} from '@/lib/agents/store';
import { HomeCommandIntent, HomeCommandResponse } from '@/lib/agents/types';
import { evaluateItTicketDraft } from '@/lib/home/it-ticket-rules';

type CreateTicketDraft = {
  requestType?: string;
  system?: string;
  impact?: string;
  reason?: string;
  durationType?: string;
  durationUntil?: string;
  details: string;
};

type LlmIntentResult = {
  intent: HomeCommandIntent;
  confidence: number;
  suggestedActions: string[];
  reason?: string;
};

const GENERIC_REASON_PATTERNS = [
  /\braise\b.*\bticket\b/i,
  /\bcreate\b.*\bticket\b/i,
  /^\s*(raise|create|open|submit|request)\s*$/i,
  /\bneed\b.*\baccess\b/i,
  /\b(access|vpn|subscription)\s+request\b/i,
];

function isMeaningfulReason(reason: string | undefined, sourceMessage: string) {
  const normalizedReason = (reason || '').trim();
  if (!normalizedReason) return false;
  const normalizedMessage = sourceMessage.trim();
  if (!normalizedMessage) return true;
  if (normalizedReason.toLowerCase() === normalizedMessage.toLowerCase()) return false;
  // Accept concise but specific reasons like "ABC UAT" or "Prod support".
  if (normalizedReason.length < 3) return false;
  const genericSingleTokens = new Set(['raise', 'create', 'open', 'submit', 'request', 'help']);
  if (
    normalizedReason.split(/\s+/).length === 1 &&
    genericSingleTokens.has(normalizedReason.toLowerCase())
  ) {
    return false;
  }
  if (GENERIC_REASON_PATTERNS.some((pattern) => pattern.test(normalizedReason))) return false;
  return true;
}

function extractDurationFromText(input: string) {
  const text = input.toLowerCase();
  const absoluteDate = input.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] || '';

  if (absoluteDate) {
    return { durationType: 'temporary', durationUntil: absoluteDate };
  }

  if (/\b(permanent|indefinite)\b/i.test(text)) {
    return { durationType: 'permanent', durationUntil: '' };
  }

  const relative = input.match(/\b\d+\s*(day|week|month|year)s?\b/i)?.[0] || '';
  if (relative) {
    return { durationType: relative, durationUntil: '' };
  }

  if (/\btemporary\b/i.test(text)) {
    return { durationType: 'temporary', durationUntil: '' };
  }

  return { durationType: '', durationUntil: '' };
}

function inferImpactFromText(input: string, fallback: string = 'medium') {
  const text = input.toLowerCase();
  if (
    /\b(blocker|cannot work|can't work|production down|prod down|sev1|sev 1)\b/.test(text)
  ) {
    return 'blocker';
  }
  if (/\b(urgent|asap|immediately|today|before eod|deadline|client escalation)\b/.test(text)) {
    return 'high';
  }
  if (/\b(low impact|minor|not urgent)\b/.test(text)) {
    return 'low';
  }
  return fallback || 'medium';
}

function inferRequestTypeFromText(input: string, fallback?: string) {
  const text = input.toLowerCase();
  if (/\b(password|forgot password|reset password|unlock account|login issue)\b/.test(text)) {
    return 'password';
  }
  if (
    /\b(laptop|monitor|mouse|keyboard|headset|dock|charger|hardware|device)\b/.test(text)
  ) {
    return 'hardware';
  }
  if (
    /\b(license|licence|subscription|saas|seat|power bi pro|jira premium)\b/.test(text)
  ) {
    return 'subscription';
  }
  if (/\b(vpn|access|permission|grant access|enable access)\b/.test(text)) {
    return 'access';
  }
  if (/\b(install|installation|setup|set up|software)\b/.test(text)) {
    return 'software';
  }
  return fallback || 'other';
}

function inferSystemFromText(input: string, fallback?: string) {
  const current = (fallback || '').trim();
  const genericSystemValues = new Set([
    '',
    'general',
    'system',
    'application',
    'app',
    'software',
    'access',
    'request',
    'it',
  ]);
  const currentLower = current.toLowerCase();
  if (current && !genericSystemValues.has(currentLower)) return current;

  const trimmed = input.trim();
  const candidates = [
    trimmed.match(
      /\b(?:install|setup|set up)\s+([a-zA-Z0-9][a-zA-Z0-9 .+\-_/]{1,80}?)(?:\s+(?:for|on|in)\b|$)/i
    )?.[1],
    trimmed.match(/\baccess\s+(?:to\s+)?([a-zA-Z0-9][a-zA-Z0-9 .+\-_/]{1,80}?)(?:\s+(?:for|on|in)\b|$)/i)?.[1],
    trimmed.match(/\bfor\s+([a-zA-Z][a-zA-Z0-9 .+\-_/]{1,60})\s+(?:access|installation|install)\b/i)?.[1],
    trimmed.match(/\b([a-zA-Z0-9][a-zA-Z0-9 .+\-_/]{1,80}?)\s+installation\b/i)?.[1],
  ];

  for (const rawCandidate of candidates) {
    const candidate = (rawCandidate || '').trim().replace(/[.,;:]+$/, '');
    if (!candidate) continue;
    const normalized = candidate.toLowerCase();
    if (!genericSystemValues.has(normalized)) return candidate;
  }

  return current || 'General';
}

function deriveReasonFromMessage(message: string) {
  let working = message.trim();
  if (!working) return '';

  // Prefer explicit "for <reason>" phrasing when present.
  const forMatch = working.match(/\bfor\b([\s\S]*)$/i);
  if (forMatch?.[1]) {
    working = forMatch[1].trim();
  }

  // Remove common duration phrases so business reason remains.
  working = working
    .replace(/\b\d+\s*(day|week|month|year)s?\b/gi, ' ')
    .replace(/\b(permanent|indefinite|temporary)\b/gi, ' ')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ');

  // Remove common request boilerplate.
  working = working
    .replace(
      /\b(please|kindly)?\s*(raise|create|open|submit)\s+(an?\s+)?(it\s+)?(ticket|request)\b/gi,
      ' '
    )
    .replace(/\b(raise|create|open|submit|request)\b/gi, ' ')
    .replace(
      /\b(i\s+need|need|request|require|want)\b/gi,
      ' '
    )
    .replace(
      /\b(vpn|access|subscription|license|licence|software|install|hardware|network|issue)\b/gi,
      ' '
    );

  // Cleanup punctuation and spacing.
  working = working
    .replace(/^[\s,;:\-]+/, '')
    .replace(/[\s,;:\-]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!working || working.length < 5) return '';
  return working;
}

function applyFollowupToDraft(
  draft: CreateTicketDraft & Record<string, any>,
  message: string
) {
  const nextDraft: CreateTicketDraft & Record<string, any> = { ...draft };
  const trimmed = message.trim();
  let changed = false;

  const duration = extractDurationFromText(trimmed);
  if (duration.durationType && duration.durationType !== (nextDraft.durationType || '')) {
    nextDraft.durationType = duration.durationType;
    changed = true;
  }
  if (duration.durationUntil && duration.durationUntil !== (nextDraft.durationUntil || '')) {
    nextDraft.durationUntil = duration.durationUntil;
    changed = true;
  }

  const inferredImpact = inferImpactFromText(trimmed, nextDraft.impact || 'medium');
  if (inferredImpact && inferredImpact !== (nextDraft.impact || '')) {
    nextDraft.impact = inferredImpact;
    changed = true;
  }

  const inferredRequestType = inferRequestTypeFromText(trimmed, nextDraft.requestType || 'other');
  if (inferredRequestType && inferredRequestType !== (nextDraft.requestType || '')) {
    nextDraft.requestType = inferredRequestType;
    changed = true;
  }

  const looksLikeDurationOnly = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (/\b\d{4}-\d{2}-\d{2}\b/.test(normalized)) return true;
    if (/\b(permanent|indefinite|temporary)\b/.test(normalized)) return true;
    if (/^\d+\s*(day|week|month|year)s?$/.test(normalized)) return true;
    if (/^for\s+\d+\s*(day|week|month|year)s?$/.test(normalized)) return true;
    return false;
  };

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('for ') ||
    lower.startsWith('because ') ||
    lower.startsWith('reason ') ||
    lower.startsWith('use case ')
  ) {
    const normalizedReason = trimmed
      .replace(/^(for|because|reason|use case)\s*[:\-]?\s*/i, '')
      .trim();
    if (
      normalizedReason &&
      !looksLikeDurationOnly(normalizedReason) &&
      normalizedReason !== (nextDraft.reason || '').trim()
    ) {
      nextDraft.reason = normalizedReason;
      changed = true;
    }
  } else if (!looksLikeDurationOnly(trimmed)) {
    const derivedReason = deriveReasonFromMessage(trimmed);
    if (
      derivedReason &&
      derivedReason !== (nextDraft.reason || '').trim() &&
      isMeaningfulReason(derivedReason, trimmed)
    ) {
      nextDraft.reason = derivedReason;
      changed = true;
    }
  }

  const candidateSystem = inferSystemFromText(trimmed, nextDraft.system);
  if (candidateSystem && candidateSystem.toLowerCase() !== (nextDraft.system || '').toLowerCase()) {
    nextDraft.system = candidateSystem;
    changed = true;
  }

  if (trimmed.length > 0) {
    const existingDetails = (nextDraft.details || '').trim();
    if (!existingDetails || trimmed.length > existingDetails.length) {
      nextDraft.details = trimmed;
      changed = true;
    }
  }

  return { nextDraft, changed };
}

const VALID_HOME_INTENTS: HomeCommandIntent[] = [
  'create_it_ticket',
  'check_ticket_status',
  'password_reset',
  'policy_question',
  'comms_generate',
  'engineering_generate',
  'jd_generate',
  'pdf_to_ppt_convert',
  'unknown',
];

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
  const passwordPatterns = [
    /\breset(?:\s+my)?\s+password\b/i,
    /\bforgot(?:\s+my)?\s+password\b/i,
    /\bpassword\s+reset\b/i,
    /\bunlock(?:\s+my)?\s+account\b/i,
    /\b(can(?:not|'t)|unable)\s+to\s+log\s*in\b/i,
    /\blog\s*in\s+issue\b/i,
  ];
  const commsSignals = ['newsletter', 'announcement', 'email draft', 'comms', 'communication'];
  const engineeringSignals = ['release notes', 'pr summary', 'post mortem', 'post-mortem', 'incident report'];
  const jdSignals = ['job description', 'jd for', 'create jd', 'hiring role', 'role description'];
  const pdfToPptSignals = [
    'pdf to ppt',
    'pdf to powerpoint',
    'convert pdf',
    'ppt from pdf',
    'powerpoint from pdf',
    'convert to ppt',
    'convert to powerpoint',
  ];
  const createTicketSignals = [
    'raise ticket',
    'create ticket',
    'it request',
    'access request',
    'laptop',
    'monitor',
    'mouse',
    'keyboard',
    'headset',
    'dock',
    'vpn',
    'wifi',
    'internet',
    'network',
    'lan',
    'software install',
    'installation',
    'subscription',
    'not working',
  ];
  const createTicketPatterns = [
    /\b(?:install|installation|setup|set up)\b/i,
    /\bsoftware\b/i,
    /\bdesktop app\b/i,
    /\blicen[cs]e\b/i,
    /\bsubscription\b/i,
    /\b(can(?:not|'t)|unable)\s+to\s+access\b/i,
    /\b(issue|problem)\b/i,
  ];
  const statusSignals = ['ticket status', 'status of ticket', 'check ticket', 'track ticket'];
  const policySignals = ['policy', 'leave', 'travel policy', 'rto', 'how many days', 'guideline'];

  if (passwordPatterns.some((pattern) => pattern.test(text))) return 'password_reset';
  if (engineeringSignals.some((s) => text.includes(s))) return 'engineering_generate';
  if (commsSignals.some((s) => text.includes(s))) return 'comms_generate';
  if (jdSignals.some((s) => text.includes(s))) return 'jd_generate';
  if (pdfToPptSignals.some((s) => text.includes(s))) return 'pdf_to_ppt_convert';
  if (statusSignals.some((s) => text.includes(s))) return 'check_ticket_status';
  if (
    createTicketSignals.some((s) => text.includes(s)) ||
    createTicketPatterns.some((pattern) => pattern.test(text))
  ) {
    return 'create_it_ticket';
  }
  if (policySignals.some((s) => text.includes(s))) return 'policy_question';
  return 'unknown';
}

function isStarterOnlyPrompt(message: string) {
  const normalized = message.trim().toLowerCase().replace(/\s+/g, ' ');
  const starterPhrases = [
    'raise a request for',
    'check status of ticket',
    'ask a policy question',
    'raise request for',
    'check ticket status',
  ];
  return starterPhrases.some((starter) => normalized === starter);
}

function isLikelyDraftFollowup(message: string) {
  const text = message.trim().toLowerCase();
  if (!text) return false;

  // Strong follow-up cues.
  if (/^(for|because|reason|use case)\b/.test(text)) return true;
  if (/^\d+\s*(day|week|month|year)s?$/.test(text)) return true;
  if (/^for\s+\d+\s*(day|week|month|year)s?$/.test(text)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return true;
  if (/^(temporary|permanent|indefinite)$/.test(text)) return true;

  // Avoid hijacking clear "new task" intents.
  const explicitNewIntentSignals = [
    'ticket status',
    'check status',
    'reset password',
    'forgot password',
    'policy',
    'newsletter',
    'release notes',
    'pr summary',
    'post mortem',
    'create jd',
    'job description',
  ];
  if (explicitNewIntentSignals.some((signal) => text.includes(signal))) return false;

  // Short contextual fragments are usually follow-ups while a draft is pending.
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= 8;
}

async function classifyIntentWithLlm(message: string): Promise<LlmIntentResult> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      intent: 'unknown',
      confidence: 0,
      suggestedActions: [],
      reason: 'OPENAI_API_KEY missing',
    };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const systemPrompt = `Classify the user message into exactly one intent.
Valid intents:
- create_it_ticket
- check_ticket_status
- password_reset
- policy_question
- comms_generate
- engineering_generate
- jd_generate
- pdf_to_ppt_convert
- unknown

Return JSON only with keys:
- intent (one of valid intents)
- confidence (0 to 1)
- suggested_actions (array of up to 3 short strings the user can click next)
- reason (one short sentence)
`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.CHAT_MODEL || 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    const intent = VALID_HOME_INTENTS.includes(parsed?.intent) ? parsed.intent : 'unknown';
    const confidence = Number.isFinite(parsed?.confidence)
      ? Math.max(0, Math.min(1, Number(parsed.confidence)))
      : 0;
    const suggestedActions = Array.isArray(parsed?.suggested_actions)
      ? parsed.suggested_actions
          .filter((item: unknown) => typeof item === 'string')
          .slice(0, 3)
      : [];

    return {
      intent,
      confidence,
      suggestedActions,
      reason: typeof parsed?.reason === 'string' ? parsed.reason : undefined,
    };
  } catch (error: any) {
    return {
      intent: 'unknown',
      confidence: 0,
      suggestedActions: [],
      reason: error?.message || 'classifier_failed',
    };
  }
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

    const ruleIntent = detectIntent(message);
    let intent = ruleIntent;
    let llmIntent: LlmIntentResult | null = null;
    if (ruleIntent === 'unknown') {
      llmIntent = await classifyIntentWithLlm(message);
      if (llmIntent.confidence >= 0.7) {
        intent = llmIntent.intent;
      }
    }
    const origin = new URL(req.url).origin;
    const cookie = req.headers.get('cookie') || '';

    const pendingCtx = await getLatestPendingHomeApprovalForUser(auth.userId);
    const shouldApplyPendingItDraftFollowup =
      !!pendingCtx &&
      (intent === 'create_it_ticket' || (intent === 'unknown' && isLikelyDraftFollowup(message)));
    if (shouldApplyPendingItDraftFollowup) {
      const draft = (pendingCtx.approval?.metadata?.draft || {}) as CreateTicketDraft & Record<string, any>;
      const { nextDraft, changed } = applyFollowupToDraft(draft, message);
    if (changed) {
        const followupMissingFields = evaluateItTicketDraft(nextDraft, {
          reasonValid: isMeaningfulReason(nextDraft.reason, nextDraft.details || message),
        }).missingFields;
        const previousHistory = Array.isArray(pendingCtx.approval?.metadata?.followupHistory)
          ? pendingCtx.approval.metadata.followupHistory
          : [];
        const followupEntry = {
          message,
          at: new Date().toISOString(),
        };
        const followupHistory = [...previousHistory, followupEntry].slice(-20);

        await updateAgentApprovalMetadata({
          approvalId: pendingCtx.approval.id,
          metadata: {
            ...(pendingCtx.approval.metadata || {}),
            draft: nextDraft,
            followupMessage: message,
            followupHistory,
          },
        });

        await updateAgentRun({
          runId: pendingCtx.run.id,
          output: {
            ...(pendingCtx.run.output || {}),
            intent: 'create_it_ticket',
            requiresConfirmation: true,
            approvalId: pendingCtx.approval.id,
            draft: nextDraft,
            missingFields: followupMissingFields,
          },
        });

        return NextResponse.json({
          runId: pendingCtx.run.id,
          status: 'WAITING_APPROVAL',
          intent: 'create_it_ticket',
          requiresConfirmation: true,
          actionCard: {
            type: 'confirm',
            title: 'Updated IT Ticket Draft',
            description: 'I updated the pending draft from your latest message. Review and approve.',
            data: {
              requestType: nextDraft.requestType,
              system: nextDraft.system,
              impact: nextDraft.impact,
              reason: nextDraft.reason,
              durationType: nextDraft.durationType,
              durationUntil: nextDraft.durationUntil,
              details: nextDraft.details,
              missingFields: followupMissingFields,
              lastFollowupMessage: message,
              lastFollowupAt: followupEntry.at,
            },
          },
        } as HomeCommandResponse);
      }

      return NextResponse.json({
        runId: pendingCtx.run.id,
        status: 'WAITING_APPROVAL',
        intent: 'create_it_ticket',
        requiresConfirmation: true,
        actionCard: {
          type: 'confirm',
          title: 'Pending IT Ticket Draft',
          description:
            'No new changes detected from your last message. Update fields or approve to submit.',
          data: {
            requestType: draft.requestType,
            system: draft.system,
            impact: draft.impact,
            reason: draft.reason,
            durationType: draft.durationType,
            durationUntil: draft.durationUntil,
            details: draft.details,
            missingFields: evaluateItTicketDraft(draft, {
              reasonValid: isMeaningfulReason(draft.reason, draft.details || message),
            }).missingFields,
            lastFollowupMessage: message,
          },
        },
      } as HomeCommandResponse);
    }

    const run = await createAgentRun({
      userId: auth.userId,
      agent: 'home-orchestrator',
      sessionId,
      model,
      status: 'RUNNING',
      riskLevel: intent === 'create_it_ticket' ? 'MEDIUM' : 'LOW',
      input: {
        message,
        ruleIntent,
        llmIntent,
        finalIntent: intent,
      },
    });

    let stepNo = 1;
    await createAgentRunStep({
      runId: run.id,
      stepNo: stepNo++,
      phase: 'PLAN',
      status: 'COMPLETED',
      tool: 'intent_router',
      toolInput: { message },
      toolOutput: {
        ruleIntent,
        llmIntent,
        finalIntent: intent,
      },
      riskLevel: 'LOW',
    });

    if (intent === 'create_it_ticket') {
      if (isStarterOnlyPrompt(message) || message.trim().length < 10) {
        await updateAgentRun({
          runId: run.id,
          status: 'COMPLETED',
          ended: true,
          output: {
            intent,
            needsMoreDetails: true,
          },
        });

        return NextResponse.json({
          runId: run.id,
          status: 'COMPLETED',
          intent,
          requiresConfirmation: false,
          actionCard: {
            type: 'info',
            title: 'Need More Details',
            description:
              'Please add what you need, for which system/app, and why (plus duration if access is temporary).',
            data: {
              suggestions: [
                'Raise a request for Cursor installation for QA team',
                'Need VPN for ABC UAT for 2 weeks',
                'Need monitor replacement for dual-screen setup',
              ],
            },
          },
        });
      }

      const classification = await classifyItDraft(origin, cookie, message);
      const extractedDuration = extractDurationFromText(message);
      const derivedReason = deriveReasonFromMessage(message);
      const inferredRequestType = inferRequestTypeFromText(message, classification?.requestType);
      const inferredSystem = inferSystemFromText(message, classification?.system);
      const inferredImpact = inferImpactFromText(message, classification?.impact || 'medium');
      const draft: CreateTicketDraft = {
        requestType: inferredRequestType || 'other',
        system: inferredSystem || 'General',
        impact: inferredImpact || 'medium',
        reason: derivedReason || classification?.reason || message,
        durationType: extractedDuration.durationType,
        durationUntil: extractedDuration.durationUntil,
        details: message,
      };

      const evaluation = evaluateItTicketDraft(draft, {
        reasonValid: isMeaningfulReason(draft.reason, message),
      });
      const missingFields = evaluation.missingFields;

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
          missingFields,
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
          description:
            missingFields.length > 0
              ? 'I prepared a draft. Please fill required fields, then approve to submit.'
              : 'I prepared an IT ticket draft. Review and confirm to submit.',
          data: {
            category: evaluation.category,
            requestType: draft.requestType,
            system: draft.system,
            impact: draft.impact,
            reason: draft.reason,
            durationType: draft.durationType,
            durationUntil: draft.durationUntil,
            details: draft.details,
            missingFields,
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
              data: {
                ...data,
                routeTo:
                  typeof data?.ticket?.id === 'string' && data.ticket.id
                    ? `/tickets/${data.ticket.id}`
                    : undefined,
              },
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
                  autorun: '1',
                  handoffRunId: run.id,
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

    if (intent === 'pdf_to_ppt_convert') {
      await updateAgentRun({
        runId: run.id,
        status: 'COMPLETED',
        ended: true,
        output: {
          intent,
          routeTo: '/pdf-to-ppt',
        },
      });

      return NextResponse.json({
        runId: run.id,
        status: 'COMPLETED',
        intent,
        requiresConfirmation: false,
        actionCard: {
          type: 'info',
          title: 'PDF to PowerPoint Converter',
          description:
            'Upload your PDF in Home to convert now, or open the full converter for advanced options.',
          data: {
            routeTo: '/pdf-to-ppt',
            supportsInlineUpload: true,
            acceptedTypes: ['application/pdf'],
            maxSizeMb: 25,
          },
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
                        autorun: '1',
                        handoffRunId: run.id,
                        tool: 'release_notes',
                        release_name: 'Quick Home Draft',
                        audience: 'internal',
                        change_list: message.slice(0, 4000),
                      })
                    : tool === 'pr_summary'
                      ? buildRoute('/engineering-tools', {
                          autorun: '1',
                          handoffRunId: run.id,
                          tool: 'pr_summary',
                          pr_title: message.slice(0, 120),
                          pr_description: message.slice(0, 4000),
                          files_touched: 'Not provided',
                        })
                      : buildRoute('/engineering-tools', {
                          autorun: '1',
                          handoffRunId: run.id,
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
        llmIntent,
      },
    });

    const suggestions = llmIntent?.suggestedActions?.length
      ? llmIntent.suggestedActions
      : [
          'Reset my password',
          'Check status of ticket IT-000123',
          'Convert this PDF to PowerPoint',
          'Create a newsletter update for my team',
        ];

    return NextResponse.json({
      runId: run.id,
      status: 'COMPLETED',
      intent: 'unknown',
      requiresConfirmation: false,
      actionCard: {
        type: 'info',
        title: 'Need More Context',
        description:
          'I can help with IT requests, ticket status checks, password reset, policy questions, comms drafts, engineering drafts, JD generation, or PDF to PowerPoint conversion.',
        data: {
          suggestions,
          reason: llmIntent?.reason || 'low_confidence_or_no_match',
          confidence: llmIntent?.confidence ?? 0,
        },
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
