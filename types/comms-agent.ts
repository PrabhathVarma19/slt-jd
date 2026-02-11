export type CommsAgentMode = 'incident_update' | 'reply_assistant';
export type CommsAgentTone = 'formal' | 'neutral' | 'casual' | 'executive';
export type CommsAgentAudience = 'org' | 'team' | 'exec';
export type CommsAgentTemplateType =
  | 'security_advisory'
  | 'it_incident'
  | 'policy_update'
  | 'travel_advisory'
  | 'leadership_update';

export interface CommsAgentRequest {
  mode: CommsAgentMode;
  tone: CommsAgentTone;
  audience?: CommsAgentAudience;
  templateType?: CommsAgentTemplateType;
  ticketId?: string;
  title?: string;
  impact?: string;
  eta?: string;
  context?: string;
  emailContent?: string;
  desiredOutcome?: string;
}

export interface CommsAgentResponse {
  subject: string;
  body: string;
  summary: string;
  followUpQuestions: string[];
}
