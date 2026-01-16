import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    await requireSessionRole(['SUPER_ADMIN']);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
    const agent = searchParams.get('agent');

    let query = supabaseServer
      .from('AgentLog')
      .select(
        `
        id,
        agent,
        input,
        intent,
        tool,
        toolInput,
        response,
        success,
        createdAt,
        user:User!AgentLog_userId_fkey(
          email,
          profile:UserProfile(empName)
        )
      `
      )
      .order('createdAt', { ascending: false })
      .limit(limit);

    if (agent) {
      query = query.eq('agent', agent);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ logs: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch agent logs' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}
