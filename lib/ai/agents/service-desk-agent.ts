import OpenAI from 'openai';

export type AgentActionType = 'password_reset' | 'ticket_status' | 'kb_search' | 'create_request' | 'none';

export type AgentDecision = {
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

Rules:
- If the user asks for ticket status but does not provide a ticket number, ask for it and set actionType to "none".
- If the user mentions "account locked" or "locked out", offer a password reset (actionType "password_reset").
- If the user asks a policy/how-to question, propose a KB search (actionType "kb_search") with query.
- If the user describes an IT request, extract:
  requestType: access|hardware|software|subscription|password|other
  system: short system/tool name
  impact: blocker|high|medium|low
  reason: short reason

Output a JSON object with keys:
response, actionType, actionData, requiresConfirmation.

Set requiresConfirmation true for any actionType except "none".
If actionType is "create_request", include actionData with requestType, system, impact, reason, details.`;

function normalizeDecision(parsed: any): AgentDecision | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const actionType = (parsed.actionType || parsed.action_type || 'none') as AgentActionType;
  const response = typeof parsed.response === 'string' ? parsed.response : '';
  if (!response) return null;
  return {
    response,
    actionType,
    actionData: parsed.actionData || parsed.action_data || undefined,
    requiresConfirmation: !!parsed.requiresConfirmation,
  };
}

export async function runServiceDeskAgent(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AgentDecision> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      response: 'AI is not configured. Please contact IT support.',
      actionType: 'none',
      requiresConfirmation: false,
    };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let decision: AgentDecision | null = null;
  try {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message },
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.CHAT_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '';
    const jsonText = content.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
    const parsed = JSON.parse(jsonText);
    decision = normalizeDecision(parsed);
  } catch (error) {
    console.error('Service Desk agent JSON parse failed:', error);
  }

  if (!decision) {
    return {
      response: 'I ran into an issue processing that. Please try again.',
      actionType: 'none',
      requiresConfirmation: false,
    };
  }

  return decision;
}
