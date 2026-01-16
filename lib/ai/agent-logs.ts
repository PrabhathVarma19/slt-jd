import { supabaseServer } from '@/lib/supabase/server';

export type AgentLogInput = {
  userId: string;
  agent: string;
  input: string;
  intent: string;
  tool: string;
  toolInput?: Record<string, any> | null;
  response: string;
  success: boolean;
  metadata?: Record<string, any> | null;
};

export async function createAgentLog(entry: AgentLogInput) {
  try {
    await supabaseServer.from('AgentLog').insert({
      userId: entry.userId,
      agent: entry.agent,
      input: entry.input,
      intent: entry.intent,
      tool: entry.tool,
      toolInput: entry.toolInput ?? null,
      response: entry.response,
      success: entry.success,
      metadata: entry.metadata ?? null,
    });
  } catch (error) {
    console.error('Agent log insert failed:', error);
  }
}
