import { supabaseServer } from '@/lib/supabase/server';

export type AgentName = 'service-desk' | 'policy-agent' | 'new-joiner' | 'expenses-coach';

export type AgentMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const MEMORY_LIMIT = 10;

export async function getAgentHistory(
  userId: string,
  agent: AgentName,
  limit = MEMORY_LIMIT
): Promise<AgentMessage[]> {
  const { data, error } = await supabaseServer
    .from('AgentMessage')
    .select('role, content, createdAt')
    .eq('userId', userId)
    .eq('agent', agent)
    .order('createdAt', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Agent memory fetch failed:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    role: row.role,
    content: row.content,
  }));
}

export async function storeAgentMessages(
  userId: string,
  agent: AgentName,
  messages: AgentMessage[]
) {
  if (!messages.length) return;

  const { error } = await supabaseServer.from('AgentMessage').insert(
    messages.map((message) => ({
      userId,
      agent,
      role: message.role,
      content: message.content,
    }))
  );

  if (error) {
    console.error('Agent memory insert failed:', error);
    return;
  }

  const { data: oldMessages, error: oldError } = await supabaseServer
    .from('AgentMessage')
    .select('id')
    .eq('userId', userId)
    .eq('agent', agent)
    .order('createdAt', { ascending: false })
    .range(MEMORY_LIMIT, 200);

  if (oldError) {
    console.error('Agent memory cleanup failed:', oldError);
    return;
  }

  if (oldMessages && oldMessages.length > 0) {
    const ids = oldMessages.map((row: any) => row.id);
    const { error: deleteError } = await supabaseServer
      .from('AgentMessage')
      .delete()
      .in('id', ids);
    if (deleteError) {
      console.error('Agent memory cleanup delete failed:', deleteError);
    }
  }
}

export async function clearAgentMemory(userId: string, agent: AgentName) {
  const { error } = await supabaseServer
    .from('AgentMessage')
    .delete()
    .eq('userId', userId)
    .eq('agent', agent);

  if (error) {
    console.error('Agent memory clear failed:', error);
  }
}
