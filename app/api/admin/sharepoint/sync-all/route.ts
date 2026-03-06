import { NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';
import { SharePointSource, syncSharePointSource } from '@/lib/sharepoint/sync';

export async function POST() {
  try {
    await requireSessionRole(['SUPER_ADMIN']);

    const { data: sources, error } = await supabaseServer
      .from('sharepoint_sources')
      .select('*')
      .eq('enabled', true)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const results = [];
    for (const source of (sources || []) as SharePointSource[]) {
      try {
        const result = await syncSharePointSource(source);
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          success: true,
          result,
        });
      } catch (sourceError: any) {
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          success: false,
          error: sourceError?.message || 'Sync failed',
        });
      }
    }

    return NextResponse.json({
      totalSources: (sources || []).length,
      results,
    });
  } catch (error: any) {
    const message = error?.message || 'Failed to run sync-all';
    return NextResponse.json(
      { error: message },
      { status: message.includes('Access denied') ? 403 : 500 }
    );
  }
}
