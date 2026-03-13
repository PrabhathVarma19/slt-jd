import path from 'path';
import { supabaseServer } from '@/lib/supabase/server';
import { resetKbCache } from '@/app/api/service-desk/kb/search/cache';
import {
  SharePointSource,
  SharePointSyncFileResult,
  ensureSourceConfigured,
  listSourceSharePointFiles,
  normalizeCategory,
  processSharePointFile,
} from '@/lib/sharepoint/sync';

type SharePointSyncJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface SharePointSyncJob {
  id: string;
  source_id: string;
  status: SharePointSyncJobStatus;
  total_files: number;
  processed_files: number;
  synced_files: number;
  skipped_files: number;
  pending_files: unknown;
  file_results: unknown;
  last_error: string | null;
  next_run_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

interface QueuedSharePointFile {
  id: string;
  name: string;
  downloadUrl: string;
  mimeType: string;
}

const SHAREPOINT_SYNC_BATCH_SIZE = 3;

function parseRetryAfterSeconds(message?: string | null): number | null {
  if (!message) return null;
  const match = message.match(/retryAfterSeconds=(\d+)/i);
  if (!match?.[1]) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds;
}

function addSecondsToIso(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asQueuedFiles(value: unknown): QueuedSharePointFile[] {
  const raw = asArray<any>(value);
  return raw
    .map((item) => ({
      id: typeof item?.id === 'string' ? item.id : '',
      name: typeof item?.name === 'string' ? item.name : '',
      downloadUrl: typeof item?.downloadUrl === 'string' ? item.downloadUrl : '',
      mimeType: typeof item?.mimeType === 'string' ? item.mimeType : '',
    }))
    .filter((item) => Boolean(item.id) && Boolean(item.name) && Boolean(item.downloadUrl));
}

function asFileResults(value: unknown): SharePointSyncFileResult[] {
  const raw = asArray<any>(value);
  return raw
    .map((item): SharePointSyncFileResult | null => {
      const id = typeof item?.id === 'string' ? item.id : '';
      const name = typeof item?.name === 'string' ? item.name : '';
      if (!id || !name) {
        return null;
      }

      const status: SharePointSyncFileResult['status'] =
        item?.status === 'synced' ? 'synced' : 'skipped';

      return {
        id,
        name,
        status,
        reason: typeof item?.reason === 'string' ? item.reason : undefined,
        outputFile: typeof item?.outputFile === 'string' ? item.outputFile : undefined,
      };
    })
    .filter((item): item is SharePointSyncFileResult => item !== null);
}

function usedOutputNames(results: SharePointSyncFileResult[]): Set<string> {
  const used = new Set<string>();
  for (const result of results) {
    if (!result.outputFile) continue;
    used.add(path.basename(result.outputFile).toLowerCase());
  }
  return used;
}

async function updateJob(
  jobId: string,
  patch: Record<string, any>
): Promise<SharePointSyncJob> {
  const { data, error } = await supabaseServer
    .from('sharepoint_sync_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as SharePointSyncJob;
}

export async function getSharePointSyncJob(jobId: string): Promise<SharePointSyncJob | null> {
  const { data, error } = await supabaseServer
    .from('sharepoint_sync_jobs')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as SharePointSyncJob | null) || null;
}

async function getSourceForJob(job: SharePointSyncJob): Promise<SharePointSource> {
  const { data, error } = await supabaseServer
    .from('sharepoint_sources')
    .select('*')
    .eq('id', job.source_id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Source not found for sync job');
  }

  return data as SharePointSource;
}

export async function createSharePointSyncJob(sourceId: string): Promise<SharePointSyncJob> {
  const { data, error } = await supabaseServer
    .from('sharepoint_sync_jobs')
    .insert({
      source_id: sourceId,
      status: 'queued',
      pending_files: [],
      file_results: [],
      total_files: 0,
      processed_files: 0,
      synced_files: 0,
      skipped_files: 0,
      next_run_at: null,
      last_error: null,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as SharePointSyncJob;
}

function isTerminalStatus(status: SharePointSyncJobStatus): boolean {
  return status === 'succeeded' || status === 'failed';
}

export async function runSharePointSyncJobStep(jobId: string): Promise<SharePointSyncJob> {
  let job = await getSharePointSyncJob(jobId);
  if (!job) {
    throw new Error('Sync job not found');
  }

  if (isTerminalStatus(job.status)) {
    return job;
  }

  if (job.next_run_at && new Date(job.next_run_at).getTime() > Date.now()) {
    return job;
  }

  if (job.status === 'queued') {
    job = await updateJob(job.id, {
      status: 'running',
      started_at: job.started_at || new Date().toISOString(),
      next_run_at: null,
      last_error: null,
    });
  }

  try {
    const source = await getSourceForJob(job);
    ensureSourceConfigured(source);
    const category = normalizeCategory(source.category);

    let pendingFiles = asQueuedFiles(job.pending_files);
    let fileResults = asFileResults(job.file_results);
    let totalFiles = Number(job.total_files || 0);
    let processedFiles = Number(job.processed_files || 0);
    let syncedFiles = Number(job.synced_files || 0);
    let skippedFiles = Number(job.skipped_files || 0);

    if (pendingFiles.length === 0 && totalFiles === 0) {
      const listed = await listSourceSharePointFiles(source);
      pendingFiles = listed.map((file) => ({
        id: file.id,
        name: file.name,
        downloadUrl: file.downloadUrl,
        mimeType: file.mimeType,
      }));
      totalFiles = pendingFiles.length;
    }

    if (pendingFiles.length === 0) {
      const completed = await updateJob(job.id, {
        status: 'succeeded',
        total_files: totalFiles,
        processed_files: processedFiles,
        synced_files: syncedFiles,
        skipped_files: skippedFiles,
        pending_files: [],
        file_results: fileResults,
        last_error: null,
        next_run_at: null,
        finished_at: new Date().toISOString(),
      });

      await supabaseServer
        .from('sharepoint_sources')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', source.id);

      resetKbCache();
      return completed;
    }

    const batch = pendingFiles.slice(0, SHAREPOINT_SYNC_BATCH_SIZE);
    const remaining = pendingFiles.slice(batch.length);
    const usedFileNames = usedOutputNames(fileResults);

    for (const file of batch) {
      const result = await processSharePointFile(file, category, usedFileNames);
      fileResults.push(result);
      processedFiles += 1;
      if (result.status === 'synced') {
        syncedFiles += 1;
      } else {
        skippedFiles += 1;
      }
    }

    const isDone = remaining.length === 0;
    const updated = await updateJob(job.id, {
      status: isDone ? 'succeeded' : 'running',
      total_files: totalFiles,
      processed_files: processedFiles,
      synced_files: syncedFiles,
      skipped_files: skippedFiles,
      pending_files: remaining,
      file_results: fileResults,
      last_error: null,
      next_run_at: null,
      finished_at: isDone ? new Date().toISOString() : null,
    });

    if (isDone) {
      await supabaseServer
        .from('sharepoint_sources')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', source.id);

      resetKbCache();
    }

    return updated;
  } catch (error: any) {
    const message = error?.message || 'Sync job step failed';
    const retryAfterSeconds = parseRetryAfterSeconds(message);

    if (retryAfterSeconds) {
      return updateJob(job.id, {
        status: 'running',
        last_error: message,
        next_run_at: addSecondsToIso(retryAfterSeconds),
      });
    }

    return updateJob(job.id, {
      status: 'failed',
      last_error: message,
      finished_at: new Date().toISOString(),
      next_run_at: null,
    });
  }
}
