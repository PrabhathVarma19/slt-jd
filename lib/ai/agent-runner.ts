import OpenAI from 'openai';

export type AgentIntent =
  | 'create_request'
  | 'kb_search'
  | 'check_status'
  | 'password_reset'
  | 'ask_followup'
  | 'none';

export type AgentTool = 'create_ticket' | 'check_ticket_status' | 'kb_search' | 'password_reset';

export type AgentDecision = {
  intent: AgentIntent;
  confidence: number;
  extracted: Record<string, any>;
  missingFields: string[];
  proposedAction: { tool: AgentTool; input: Record<string, any> } | null;
  requiresConfirmation: boolean;
  assistantMessage: string;
};

type RunnerInput = {
  systemPrompt: string;
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  model?: string;
};

const VALID_TOOLS: AgentTool[] = [
  'create_ticket',
  'check_ticket_status',
  'kb_search',
  'password_reset',
];

const normalizeDecision = (parsed: any): AgentDecision | null => {
  if (!parsed || typeof parsed !== 'object') return null;

  const intent = (parsed.intent || 'none') as AgentIntent;
  const confidence = Number.isFinite(parsed.confidence) ? Number(parsed.confidence) : 0.5;
  const extracted = parsed.extracted && typeof parsed.extracted === 'object' ? parsed.extracted : {};
  const missingFields = Array.isArray(parsed.missing_fields)
    ? parsed.missing_fields.filter((field: any) => typeof field === 'string')
    : [];
  const assistantMessage =
    typeof parsed.assistant_message === 'string' && parsed.assistant_message.trim()
      ? parsed.assistant_message.trim()
      : '';

  let proposedAction: AgentDecision['proposedAction'] = null;
  if (parsed.proposed_action && typeof parsed.proposed_action === 'object') {
    const tool = parsed.proposed_action.tool as AgentTool;
    if (VALID_TOOLS.includes(tool)) {
      proposedAction = {
        tool,
        input:
          parsed.proposed_action.input && typeof parsed.proposed_action.input === 'object'
            ? parsed.proposed_action.input
            : {},
      };
    }
  }

  if (!assistantMessage) return null;

  return {
    intent,
    confidence: Math.max(0, Math.min(1, confidence)),
    extracted,
    missingFields,
    proposedAction,
    requiresConfirmation: !!parsed.requires_confirmation,
    assistantMessage,
  };
};

export async function runAgent(input: RunnerInput): Promise<AgentDecision> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      intent: 'none',
      confidence: 0,
      extracted: {},
      missingFields: [],
      proposedAction: null,
      requiresConfirmation: false,
      assistantMessage: 'AI is not configured. Please contact IT support.',
    };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const messages = [
      { role: 'system' as const, content: input.systemPrompt },
      ...input.history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: input.message },
    ];

    const completion = await openai.chat.completions.create({
      model: input.model || process.env.CHAT_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '';
    const jsonText = content.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
    const parsed = JSON.parse(jsonText);
    const decision = normalizeDecision(parsed);
    if (decision) {
      return decision;
    }
  } catch (error) {
    console.error('Agent runner failed to parse response:', error);
  }

  return {
    intent: 'none',
    confidence: 0,
    extracted: {},
    missingFields: [],
    proposedAction: null,
    requiresConfirmation: false,
    assistantMessage: 'I ran into an issue processing that. Please try again.',
  };
}
