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
- extracted: { category, subcategory, system, impact, reason, title, description, ticketNumber }
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

Tool names:
- create_ticket
- check_ticket_status
- kb_search
- password_reset

requires_confirmation must be true for create_ticket and password_reset.`;

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
    actionData.requestType = extracted.category || actionData.requestType || 'other';
    actionData.system = extracted.system || actionData.system || 'General';
    actionData.impact = extracted.impact || actionData.impact || 'medium';
    actionData.reason = extracted.reason || actionData.reason || 'Not specified';
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
