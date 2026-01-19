import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';

type RollupKey = {
  day: string;
  agent: string;
  intent: string | null;
  tool: string | null;
};

const toDayKey = (value: string) => value.slice(0, 10);

export async function POST(req: NextRequest) {
  try {
    await requireSessionRole(['SUPER_ADMIN']);
    const { searchParams } = new URL(req.url);
    const daysParam = Number(searchParams.get('days') || 30);
    const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 365) : 30;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date().toISOString();

    const { data: logs, error } = await supabaseServer
      .from('AgentLog')
      .select('agent, intent, tool, success, createdAt')
      .gte('createdAt', start)
      .lte('createdAt', end);

    if (error) {
      throw new Error(error.message);
    }

    const rollupMap = new Map<string, { key: RollupKey; success: number; failure: number }>();
    for (const log of logs || []) {
      const day = toDayKey(log.createdAt);
      const key: RollupKey = {
        day,
        agent: log.agent || 'unknown',
        intent: log.intent || null,
        tool: log.tool || null,
      };
      const mapKey = `${key.day}|${key.agent}|${key.intent || ''}|${key.tool || ''}`;
      const current = rollupMap.get(mapKey) || { key, success: 0, failure: 0 };
      if (log.success) {
        current.success += 1;
      } else {
        current.failure += 1;
      }
      rollupMap.set(mapKey, current);
    }

    const rows = Array.from(rollupMap.values()).map((entry) => ({
      day: entry.key.day,
      agent: entry.key.agent,
      intent: entry.key.intent,
      tool: entry.key.tool,
      successCount: entry.success,
      failureCount: entry.failure,
      totalCount: entry.success + entry.failure,
    }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabaseServer
        .from('AgentLogMetricsDaily')
        .upsert(rows, { onConflict: 'day,agent,intent,tool' });
      if (upsertError) {
        throw new Error(upsertError.message);
      }
    }

    return NextResponse.json({
      rolledUp: rows.length,
      range: { start, end },
      days,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to roll up agent metrics' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}
