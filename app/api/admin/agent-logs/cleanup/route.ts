import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    await requireSessionRole(['SUPER_ADMIN']);
    const { searchParams } = new URL(req.url);
    const daysParam = Number(searchParams.get('days') || 90);
    const limitParam = Number(searchParams.get('limit') || 1000);
    const requireArchive = searchParams.get('requireArchive') !== 'false';
    const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 7), 365) : 90;
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 5000) : 1000;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    let deleted = 0;

    if (requireArchive) {
      const { data: archivedRows, error: archiveError } = await supabaseServer
        .from('AgentLogArchive')
        .select('sourceLogId')
        .lt('createdAt', cutoff)
        .limit(limit);

      if (archiveError) {
        throw new Error(archiveError.message);
      }

      const ids = (archivedRows || []).map((row) => row.sourceLogId);
      if (ids.length > 0) {
        const { error: deleteError, count } = await supabaseServer
          .from('AgentLog')
          .delete({ count: 'exact' })
          .in('id', ids);
        if (deleteError) {
          throw new Error(deleteError.message);
        }
        deleted = count || 0;
      }
    } else {
      const { data: candidates, error: candidateError } = await supabaseServer
        .from('AgentLog')
        .select('id')
        .lt('createdAt', cutoff)
        .limit(limit);
      if (candidateError) {
        throw new Error(candidateError.message);
      }
      const ids = (candidates || []).map((row) => row.id);
      if (ids.length > 0) {
        const { error: deleteError, count } = await supabaseServer
          .from('AgentLog')
          .delete({ count: 'exact' })
          .in('id', ids);
        if (deleteError) {
          throw new Error(deleteError.message);
        }
        deleted = count || 0;
      }
    }

    return NextResponse.json({
      deleted,
      cutoff,
      days,
      requireArchive,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to clean agent logs' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}
