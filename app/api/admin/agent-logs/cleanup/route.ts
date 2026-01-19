import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    await requireSessionRole(['SUPER_ADMIN']);
    const { searchParams } = new URL(req.url);
    const daysParam = Number(searchParams.get('days') || 90);
    const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 7), 365) : 90;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { error, count } = await supabaseServer
      .from('AgentLog')
      .delete({ count: 'exact' })
      .lt('createdAt', cutoff);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      deleted: count || 0,
      cutoff,
      days,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to clean agent logs' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}
