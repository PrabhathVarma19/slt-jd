import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    await requireSessionRole(['SUPER_ADMIN']);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
    const agent = searchParams.get('agent');
    const intent = searchParams.get('intent');
    const tool = searchParams.get('tool');
    const email = searchParams.get('email');
    const success = searchParams.get('success');
    const range = searchParams.get('range') || '30d';
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    const parseDate = (value: string | null, endOfDay = false) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      if (endOfDay) {
        date.setHours(23, 59, 59, 999);
      } else if (value.length <= 10) {
        date.setHours(0, 0, 0, 0);
      }
      return date.toISOString();
    };

    const now = new Date();
    let startIso = parseDate(startParam);
    let endIso = parseDate(endParam, true);

    if (!startIso || !endIso) {
      const end = now.toISOString();
      let start: Date;
      if (range === '7d') {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (range === '30d') {
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else {
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      startIso = start.toISOString();
      endIso = end;
    }

    let emailUserIds: string[] | null = null;
    if (email) {
      const { data: users, error: userError } = await supabaseServer
        .from('User')
        .select('id')
        .ilike('email', `%${email}%`)
        .limit(200);
      if (userError) {
        throw new Error(userError.message);
      }
      emailUserIds = (users || []).map((user) => user.id);
      if (emailUserIds.length === 0) {
        return NextResponse.json({ logs: [] });
      }
    }

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
          profile:UserProfile(empName),
          roles:UserRole!UserRole_userId_fkey(
            id,
            revokedAt,
            role:Role!UserRole_roleId_fkey(
              id,
              type,
              name
            )
          )
        )
      `
      )
      .order('createdAt', { ascending: false })
      .limit(limit);

    if (agent) {
      query = query.eq('agent', agent);
    }
    if (intent) {
      query = query.eq('intent', intent);
    }
    if (tool) {
      query = query.eq('tool', tool);
    }
    if (emailUserIds) {
      query = query.in('userId', emailUserIds);
    }
    if (success === 'true') {
      query = query.eq('success', true);
    }
    if (success === 'false') {
      query = query.eq('success', false);
    }
    if (startIso) {
      query = query.gte('createdAt', startIso);
    }
    if (endIso) {
      query = query.lte('createdAt', endIso);
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
