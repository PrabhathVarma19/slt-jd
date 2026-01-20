import { AgentDecision, runAgent } from '@/lib/ai/agent-runner';

export type AgentActionType = 'password_reset' | 'ticket_status' | 'kb_search' | 'create_request' | 'none';

export type ServiceDeskDecision = {
  response: string;
  actionType: AgentActionType;
  actionData?: Record<string, any>;
  requiresConfirmation: boolean;
};

const systemPrompt = `You are Beacon, the Trianz IT Service Desk assistant.
You help users with:
- Password resets
- Ticket status checks
- Knowledge Base search
- IT request creation

Return a JSON object with:
- intent: create_request | kb_search | check_status | password_reset | ask_followup | none
- confidence: number between 0 and 1
- extracted: { category, subcategory, system, impact, reason, duration, title, description, ticketNumber }
- missing_fields: array of required fields still needed
- proposed_action: { tool, input } or null
- requires_confirmation: true/false
- assistant_message: user-facing message

Rules:
- If the user asks for ticket status but no ticket number is provided, ask for it.
  intent should be ask_followup, missing_fields should include "ticketNumber", proposed_action must be null.
- If the user says "account locked" or "locked out", offer a password reset.
- If the user asks a policy/how-to question, propose a KB search with query.
- If the user describes an IT request, extract:
  category: access|hardware|software|subscription|password|other
  system: short system/tool name
  impact: blocker|high|medium|low
  reason: short reason
  description: include the free-text detail
- For software install, require system and reason before proposing create_ticket.
- For subscription requests, require system, reason, and duration before proposing create_ticket.
- For VPN access, require reason and duration before proposing create_ticket.
- For access and hardware requests, require system and reason before proposing create_ticket.

Tool names:
- create_ticket
- check_ticket_status
- kb_search
- password_reset

requires_confirmation must be true for create_ticket and password_reset.`;

const isBlank = (value?: string | null) => {
  if (!value) return true;
  const trimmed = value.trim();
  return !trimmed || trimmed.toLowerCase() === 'not specified';
};

const normalizeText = (value?: string | null) => (value || '').trim().toLowerCase();

const buildFollowup = (field: string, context: { category: string; wantsVpn: boolean }) => {
  if (field === 'system') {
    if (context.category === 'software' || context.category === 'subscription') {
      return 'Which software or application do you need?';
    }
    if (context.category === 'hardware') {
      return 'Which device or hardware item do you need?';
    }
    if (context.wantsVpn) {
      return 'Please confirm which VPN or remote access tool you need.';
    }
    return 'Which system or tool do you need access to?';
  }
  if (field === 'reason') {
    return 'What is the reason or use case for this request?';
  }
  if (field === 'duration') {
    if (context.wantsVpn) {
      return 'How long do you need VPN access for?';
    }
    return 'What duration do you need for this access or subscription?';
  }
  return 'Could you share a bit more detail?';
};

export async function runServiceDeskAgent(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<ServiceDeskDecision> {
  const decision: AgentDecision = await runAgent({
    systemPrompt,
    message,
    history,
  });

  const tool = decision.proposedAction?.tool;
  const actionData = decision.proposedAction?.input || {};
  let actionType: AgentActionType = 'none';

  if (tool === 'create_ticket') actionType = 'create_request';
  if (tool === 'check_ticket_status') actionType = 'ticket_status';
  if (tool === 'kb_search') actionType = 'kb_search';
  if (tool === 'password_reset') actionType = 'password_reset';

  if (actionType === 'create_request') {
    const extracted = decision.extracted || {};
    const category = normalizeText(extracted.category || actionData.requestType);
    const system = extracted.system || actionData.system;
    const reason = extracted.reason || actionData.reason;
    const duration = extracted.duration || actionData.duration || actionData.durationType;
    const wantsVpn =
      normalizeText(system).includes('vpn') ||
      normalizeText(extracted.subcategory).includes('vpn') ||
      normalizeText(message).includes('vpn');

    const requiresSystem =
      category === 'software' ||
      category === 'subscription' ||
      category === 'access' ||
      category === 'hardware' ||
      wantsVpn;
    const requiresReason =
      category === 'software' ||
      category === 'subscription' ||
      category === 'access' ||
      category === 'hardware' ||
      wantsVpn;
    const requiresDuration = category === 'subscription' || wantsVpn;

    const missingRequired: string[] = [];
    if (requiresSystem && isBlank(system)) missingRequired.push('system');
    if (requiresReason && isBlank(reason)) missingRequired.push('reason');
    if (requiresDuration && isBlank(duration as string | null)) missingRequired.push('duration');

    if (missingRequired.length > 0) {
      const followup = buildFollowup(missingRequired[0], { category, wantsVpn });
      return {
        response: followup,
        actionType: 'none',
        actionData: undefined,
        requiresConfirmation: false,
      };
    }

    actionData.requestType = extracted.category || actionData.requestType || 'other';
    actionData.system = system || 'General';
    actionData.impact = extracted.impact || actionData.impact || 'medium';
    actionData.reason = reason || 'Not specified';
    actionData.durationType = duration || actionData.durationType || '';
    actionData.details = extracted.description || actionData.details || message;
  }

  if (actionType === 'ticket_status' && !actionData.ticketNumber) {
    actionData.ticketNumber = decision.extracted?.ticketNumber;
  }

  const requiresConfirmation = actionType === 'create_request' || actionType === 'password_reset';

  return {
    response: decision.assistantMessage,
    actionType,
    actionData: actionType === 'none' ? undefined : actionData,
    requiresConfirmation,
  };
}
