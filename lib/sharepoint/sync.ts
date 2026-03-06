import fs from 'fs';
import path from 'path';
import { supabaseServer } from '@/lib/supabase/server';
import {
  downloadSharePointFileAsText,
  listSharePointFiles,
  SharePointFileRef,
} from '@/lib/graph';
import { resetKbCache } from '@/app/api/service-desk/kb/search/cache';

const POLICY_ROOT = path.join(process.cwd(), 'data', 'policies');

export interface SharePointSource {
  id: string;
  name: string;
  category: string;
  site_url: string;
  library_name: string;
  folder_path: string | null;
  site_id: string | null;
  drive_id: string | null;
  enabled: boolean;
  last_synced_at?: string | null;
  created_at?: string;
}

export interface SharePointSyncFileResult {
  id: string;
  name: string;
  status: 'synced' | 'skipped';
  reason?: string;
  outputFile?: string;
}

export interface SharePointSyncResult {
  sourceId: string;
  sourceName: string;
  category: string;
  synced: number;
  skipped: number;
  files: SharePointSyncFileResult[];
}

function normalizeCategory(category: string): string {
  return category.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

function getTextFileName(originalName: string, used: Set<string>): string {
  const ext = path.extname(originalName);
  const rawBase = ext ? originalName.slice(0, -ext.length) : originalName;
  const safeBase = rawBase
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const base = safeBase || 'sharepoint-file';
  let candidate = `${base}.txt`;
  let suffix = 1;

  while (used.has(candidate.toLowerCase())) {
    suffix += 1;
    candidate = `${base} (${suffix}).txt`;
  }

  used.add(candidate.toLowerCase());
  return candidate;
}

function ensureSourceConfigured(source: SharePointSource): { siteId: string; driveId: string } {
  const siteId = (source.site_id || '').trim();
  const driveId = (source.drive_id || '').trim();
  if (!siteId || !driveId) {
    throw new Error('Source is missing site_id or drive_id. Re-save the source to resolve IDs.');
  }
  return { siteId, driveId };
}

async function processFile(
  file: SharePointFileRef,
  targetDir: string,
  usedFileNames: Set<string>
): Promise<SharePointSyncFileResult> {
  try {
    const extractedText = await downloadSharePointFileAsText(file.downloadUrl, file.mimeType, file.name);
    if (!extractedText) {
      return {
        id: file.id,
        name: file.name,
        status: 'skipped',
        reason: 'Unsupported file type or empty content',
      };
    }

    const textFileName = getTextFileName(file.name, usedFileNames);
    const destination = path.join(targetDir, textFileName);
    fs.writeFileSync(destination, extractedText, 'utf8');

    return {
      id: file.id,
      name: file.name,
      status: 'synced',
      outputFile: destination,
    };
  } catch (error: any) {
    return {
      id: file.id,
      name: file.name,
      status: 'skipped',
      reason: error?.message || 'Failed to process file',
    };
  }
}

export async function syncSharePointSource(source: SharePointSource): Promise<SharePointSyncResult> {
  const { siteId, driveId } = ensureSourceConfigured(source);
  const category = normalizeCategory(source.category);
  const targetDir = path.join(POLICY_ROOT, category);

  fs.mkdirSync(targetDir, { recursive: true });

  const sharePointFiles = await listSharePointFiles(siteId, driveId, source.folder_path || null);
  const usedFileNames = new Set<string>();
  const files: SharePointSyncFileResult[] = [];

  for (const file of sharePointFiles) {
    const result = await processFile(file, targetDir, usedFileNames);
    files.push(result);
  }

  const syncedCount = files.filter((file) => file.status === 'synced').length;
  const skippedCount = files.length - syncedCount;

  await supabaseServer
    .from('sharepoint_sources')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', source.id);

  resetKbCache();

  return {
    sourceId: source.id,
    sourceName: source.name,
    category,
    synced: syncedCount,
    skipped: skippedCount,
    files,
  };
}

