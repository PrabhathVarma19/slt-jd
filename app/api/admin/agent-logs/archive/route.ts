import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    await requireSessionRole(['SUPER_ADMIN']);
    const { searchParams } = new URL(req.url);
    const daysParam = Number(searchParams.get('days') || 90);
    const limitParam = Number(searchParams.get('limit') || 500);
    const purge = searchParams.get('purge') === 'true';

    const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 7), 365) : 90;
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 2000) : 500;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: logs, error: logsError } = await supabaseServer
      .from('AgentLog')
      .select(
        'id, userId, agent, intent, tool, input, response, success, toolInput, metadata, createdAt'
      )
      .lt('createdAt', cutoff)
      .order('createdAt', { ascending: true })
      .limit(limit);

    if (logsError) {
      throw new Error(logsError.message);
    }

    const logRows = logs || [];
    if (logRows.length === 0) {
      return NextResponse.json({
        archived: 0,
        purged: 0,
        cutoff,
        days,
      });
    }

    const sourceIds = logRows.map((row) => row.id);
    const { data: existingArchive, error: archiveLookupError } = await supabaseServer
      .from('AgentLogArchive')
      .select('sourceLogId')
      .in('sourceLogId', sourceIds);

    if (archiveLookupError) {
      throw new Error(archiveLookupError.message);
    }

    const archivedIdSet = new Set((existingArchive || []).map((row) => row.sourceLogId));
    const rowsToArchive = logRows.filter((row) => !archivedIdSet.has(row.id));

    if (rowsToArchive.length > 0) {
      const { error: insertError } = await supabaseServer.from('AgentLogArchive').insert(
        rowsToArchive.map((row) => ({
          sourceLogId: row.id,
          userId: row.userId,
          agent: row.agent,
          intent: row.intent,
          tool: row.tool,
          input: row.input,
          response: row.response,
          success: row.success,
          toolInput: row.toolInput,
          metadata: row.metadata,
          createdAt: row.createdAt,
        }))
      );

      if (insertError) {
        throw new Error(insertError.message);
      }
    }

    let purged = 0;
    if (purge) {
      const allArchivedIds = new Set(sourceIds);
      const { error: deleteError, count } = await supabaseServer
        .from('AgentLog')
        .delete({ count: 'exact' })
        .in('id', Array.from(allArchivedIds));

      if (deleteError) {
        throw new Error(deleteError.message);
      }
      purged = count || 0;
    }

    return NextResponse.json({
      archived: rowsToArchive.length,
      purged,
      cutoff,
      days,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to archive agent logs' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}
