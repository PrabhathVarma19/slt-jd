import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';
import {
  createSharePointSyncJob,
  getSharePointSyncJob,
  runSharePointSyncJobStep,
} from '@/lib/sharepoint/sync-jobs';

export async function POST(req: NextRequest) {
  try {
    await requireSessionRole(['SUPER_ADMIN']);

    const body = await req.json().catch(() => ({}));
    const sourceId = (body?.sourceId || '').toString().trim();

    if (!sourceId) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from('sharepoint_sources')
      .select('*')
      .eq('id', sourceId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const job = await createSharePointSyncJob(sourceId);
    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
      },
      { status: 202 }
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to sync SharePoint source';
    return NextResponse.json(
      { error: message },
      { status: message.includes('Access denied') ? 403 : 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    await requireSessionRole(['SUPER_ADMIN']);

    const jobId = (req.nextUrl.searchParams.get('jobId') || '').trim();
    const advance = req.nextUrl.searchParams.get('advance') === '1';

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const job = advance
      ? await runSharePointSyncJobStep(jobId)
      : await getSharePointSyncJob(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Sync job not found' }, { status: 404 });
    }

    return NextResponse.json({
      job: {
        id: job.id,
        sourceId: job.source_id,
        status: job.status,
        totalFiles: job.total_files || 0,
        processedFiles: job.processed_files || 0,
        syncedFiles: job.synced_files || 0,
        skippedFiles: job.skipped_files || 0,
        lastError: job.last_error,
        nextRunAt: job.next_run_at,
        finishedAt: job.finished_at,
      },
    });
  } catch (error: any) {
    const message = error?.message || 'Failed to read sync job status';
    return NextResponse.json(
      { error: message },
      { status: message.includes('Access denied') ? 403 : 500 }
    );
  }
}
