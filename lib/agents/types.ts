export type AgentRunStatus =
  | 'PENDING'
  | 'WAITING_APPROVAL'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type AgentStepStatus =
  | 'PENDING'
  | 'WAITING_APPROVAL'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED';

export type AgentApprovalDecision =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type AgentRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type HomeCommandIntent =
  | 'create_it_ticket'
  | 'check_ticket_status'
  | 'password_reset'
  | 'policy_question'
  | 'unknown';

export type HomeActionCard = {
  type: 'confirm' | 'info' | 'result' | 'error';
  title: string;
  description: string;
  data?: Record<string, any>;
};

export type HomeCommandResponse = {
  runId: string;
  status: AgentRunStatus;
  intent: HomeCommandIntent;
  requiresConfirmation: boolean;
  actionCard: HomeActionCard;
};
