import { supabaseServer } from '@/lib/supabase/server';
import {
  AgentApprovalDecision,
  AgentRiskLevel,
  AgentRunStatus,
  AgentStepStatus,
} from './types';

type JsonValue = Record<string, any> | null;

export async function createAgentRun(params: {
  userId: string;
  agent: string;
  sessionId?: string | null;
  model?: string | null;
  status: AgentRunStatus;
  riskLevel?: AgentRiskLevel | null;
  input?: JsonValue;
  output?: JsonValue;
}) {
  const { data, error } = await supabaseServer
    .from('AgentRun')
    .insert({
      userId: params.userId,
      agent: params.agent,
      sessionId: params.sessionId || null,
      model: params.model || null,
      status: params.status,
      riskLevel: params.riskLevel || null,
      input: params.input || {},
      output: params.output || null,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create agent run');
  }
  return data;
}

export async function createAgentRunStep(params: {
  runId: string;
  stepNo: number;
  phase: 'PLAN' | 'TOOL_CALL' | 'TOOL_RESULT' | 'DECISION' | 'FINAL';
  status: AgentStepStatus;
  tool?: string | null;
  toolInput?: JsonValue;
  toolOutput?: JsonValue;
  riskLevel?: AgentRiskLevel | null;
  requiresApproval?: boolean;
  errorText?: string | null;
  latencyMs?: number | null;
}) {
  const { data, error } = await supabaseServer
    .from('AgentRunStep')
    .insert({
      runId: params.runId,
      stepNo: params.stepNo,
      phase: params.phase,
      status: params.status,
      tool: params.tool || null,
      toolInput: params.toolInput || null,
      toolOutput: params.toolOutput || null,
      riskLevel: params.riskLevel || null,
      requiresApproval: params.requiresApproval || false,
      error: params.errorText || null,
      latencyMs: params.latencyMs || null,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create agent run step');
  }
  return data;
}

export async function updateAgentRun(params: {
  runId: string;
  status?: AgentRunStatus;
  output?: JsonValue;
  errorText?: string | null;
  ended?: boolean;
}) {
  const payload: Record<string, any> = {};
  if (params.status) payload.status = params.status;
  if (params.output !== undefined) payload.output = params.output;
  if (params.errorText !== undefined) payload.error = params.errorText;
  if (params.ended) payload.endedAt = new Date().toISOString();

  const { data, error } = await supabaseServer
    .from('AgentRun')
    .update(payload)
    .eq('id', params.runId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update agent run');
  }
  return data;
}

export async function updateAgentRunStep(params: {
  stepId: string;
  status?: AgentStepStatus;
  toolOutput?: JsonValue;
  errorText?: string | null;
  latencyMs?: number | null;
}) {
  const payload: Record<string, any> = {};
  if (params.status) payload.status = params.status;
  if (params.toolOutput !== undefined) payload.toolOutput = params.toolOutput;
  if (params.errorText !== undefined) payload.error = params.errorText;
  if (params.latencyMs !== undefined) payload.latencyMs = params.latencyMs;

  const { data, error } = await supabaseServer
    .from('AgentRunStep')
    .update(payload)
    .eq('id', params.stepId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update agent run step');
  }
  return data;
}

export async function createAgentApproval(params: {
  runId: string;
  stepId: string;
  requestedBy?: string | null;
  approverUserId?: string | null;
  metadata?: JsonValue;
}) {
  const { data, error } = await supabaseServer
    .from('AgentApproval')
    .insert({
      runId: params.runId,
      stepId: params.stepId,
      requestedBy: params.requestedBy || null,
      approverUserId: params.approverUserId || null,
      decision: 'PENDING',
      metadata: params.metadata || {},
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create agent approval');
  }
  return data;
}

export async function setAgentApprovalDecision(params: {
  approvalId: string;
  decision: Exclude<AgentApprovalDecision, 'PENDING'>;
  reason?: string | null;
  approverUserId?: string | null;
}) {
  const { data, error } = await supabaseServer
    .from('AgentApproval')
    .update({
      decision: params.decision,
      reason: params.reason || null,
      approverUserId: params.approverUserId || null,
      decidedAt: new Date().toISOString(),
    })
    .eq('id', params.approvalId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update agent approval');
  }
  return data;
}

export async function getRunById(runId: string) {
  const { data, error } = await supabaseServer
    .from('AgentRun')
    .select('*')
    .eq('id', runId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function getRunWithDetails(runId: string) {
  const [runResult, stepsResult, approvalsResult] = await Promise.all([
    supabaseServer.from('AgentRun').select('*').eq('id', runId).maybeSingle(),
    supabaseServer
      .from('AgentRunStep')
      .select('*')
      .eq('runId', runId)
      .order('stepNo', { ascending: true }),
    supabaseServer
      .from('AgentApproval')
      .select('*')
      .eq('runId', runId)
      .order('requestedAt', { ascending: true }),
  ]);

  if (runResult.error) throw new Error(runResult.error.message);
  if (stepsResult.error) throw new Error(stepsResult.error.message);
  if (approvalsResult.error) throw new Error(approvalsResult.error.message);

  return {
    run: runResult.data,
    steps: stepsResult.data || [],
    approvals: approvalsResult.data || [],
  };
}

export async function getPendingApprovalForRun(runId: string) {
  const { data, error } = await supabaseServer
    .from('AgentApproval')
    .select('*')
    .eq('runId', runId)
    .eq('decision', 'PENDING')
    .order('requestedAt', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function getLatestPendingHomeApprovalForUser(userId: string, sessionId?: string | null) {
  if (!sessionId) return null;
  const { data: run, error: runError } = await supabaseServer
    .from('AgentRun')
    .select('*')
    .eq('userId', userId)
    .eq('agent', 'home-orchestrator')
    .eq('status', 'WAITING_APPROVAL')
    .eq('sessionId', sessionId)
    .order('createdAt', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (runError) throw new Error(runError.message);
  if (!run) return null;

  const { data: approval, error: approvalError } = await supabaseServer
    .from('AgentApproval')
    .select('*')
    .eq('runId', run.id)
    .eq('decision', 'PENDING')
    .order('requestedAt', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (approvalError) throw new Error(approvalError.message);
  if (!approval) return null;

  return { run, approval };
}

export async function updateAgentApprovalMetadata(params: {
  approvalId: string;
  metadata: Record<string, any>;
}) {
  const { data, error } = await supabaseServer
    .from('AgentApproval')
    .update({ metadata: params.metadata })
    .eq('id', params.approvalId)
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to update agent approval metadata');
  }
  return data;
}

export async function upsertPersistentMemory(params: {
  userId: string;
  agent: string;
  memoryKey: string;
  memoryValue: Record<string, any>;
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  source?: string | null;
  confidence?: number | null;
  expiresAt?: string | null;
}) {
  const { data, error } = await supabaseServer
    .from('AgentMemoryPersistent')
    .upsert(
      {
        userId: params.userId,
        agent: params.agent,
        memoryKey: params.memoryKey,
        memoryValue: params.memoryValue,
        sensitivity: params.sensitivity || 'internal',
        source: params.source || null,
        confidence: params.confidence ?? null,
        expiresAt: params.expiresAt || null,
        lastAccessedAt: new Date().toISOString(),
      },
      { onConflict: 'userId,agent,memoryKey' }
    )
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to upsert persistent memory');
  }
  return data;
}

export async function getPersistentMemory(params: {
  userId: string;
  agent: string;
  memoryKey: string;
}) {
  const { data, error } = await supabaseServer
    .from('AgentMemoryPersistent')
    .select('*')
    .eq('userId', params.userId)
    .eq('agent', params.agent)
    .eq('memoryKey', params.memoryKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    await supabaseServer
      .from('AgentMemoryPersistent')
      .update({ lastAccessedAt: new Date().toISOString() })
      .eq('id', data.id);
  }

  return data;
}
