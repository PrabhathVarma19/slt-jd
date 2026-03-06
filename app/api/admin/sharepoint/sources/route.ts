import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';
import {
  getGraphAccessToken,
  getSharePointDriveId,
  getSharePointSiteId,
} from '@/lib/graph';

interface GraphShareDriveItemResponse {
  name?: string;
  folder?: { childCount?: number };
  parentReference?: {
    siteId?: string;
    driveId?: string;
    path?: string;
  };
}

function normalizeFolderPath(folderPath?: string | null): string | null {
  if (!folderPath) return null;
  const normalized = folderPath.replace(/\\/g, '/').trim().replace(/^\/+|\/+$/g, '');
  return normalized || null;
}

function joinFolderPaths(basePath?: string | null, extraPath?: string | null): string | null {
  const base = normalizeFolderPath(basePath);
  const extra = normalizeFolderPath(extraPath);

  if (base && extra) {
    const baseLower = base.toLowerCase();
    const extraLower = extra.toLowerCase();
    if (extraLower === baseLower || extraLower.startsWith(`${baseLower}/`)) {
      return extra;
    }
    return `${base}/${extra}`;
  }

  return base || extra || null;
}

function toGraphShareToken(rawUrl: string): string {
  const base64 = Buffer.from(rawUrl, 'utf8').toString('base64');
  const base64Url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `u!${base64Url}`;
}

function extractRelativePath(parentPath?: string): string | null {
  if (!parentPath) return null;
  const marker = 'root:';
  const lower = parentPath.toLowerCase();
  const idx = lower.indexOf(marker);
  if (idx === -1) return null;

  const raw = parentPath.slice(idx + marker.length);
  return normalizeFolderPath(raw);
}

async function resolveDriveFromShareUrl(
  siteUrl: string
): Promise<{ siteId: string; driveId: string; baseFolderPath: string | null } | null> {
  try {
    const token = await getGraphAccessToken();
    const shareToken = toGraphShareToken(siteUrl);
    const endpoint = `https://graph.microsoft.com/v1.0/shares/${shareToken}/driveItem?$select=name,folder,parentReference`;

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GraphShareDriveItemResponse;
    const siteId = data.parentReference?.siteId?.trim();
    const driveId = data.parentReference?.driveId?.trim();

    if (!siteId || !driveId) {
      return null;
    }

    const parentRelative = extractRelativePath(data.parentReference?.path);
    const itemName = normalizeFolderPath(data.name || null);
    const baseFolderPath = data.folder ? joinFolderPaths(parentRelative, itemName) : parentRelative;

    return {
      siteId,
      driveId,
      baseFolderPath,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    await requireSessionRole(['SUPER_ADMIN']);

    const { data, error } = await supabaseServer
      .from('sharepoint_sources')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ sources: data || [] });
  } catch (error: any) {
    const message = error?.message || 'Failed to fetch SharePoint sources';
    return NextResponse.json(
      { error: message },
      { status: message.includes('Access denied') ? 403 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSessionRole(['SUPER_ADMIN']);

    const body = await req.json();
    const name = (body?.name || '').toString().trim();
    const category = (body?.category || '').toString().trim().toLowerCase();
    const siteUrl = (body?.site_url || '').toString().trim();
    const libraryName = (body?.library_name || '').toString().trim();
    const folderPath = normalizeFolderPath(body?.folder_path);

    if (!name || !category || !siteUrl || !libraryName) {
      return NextResponse.json(
        { error: 'name, category, site_url and library_name are required' },
        { status: 400 }
      );
    }

    let siteId = await getSharePointSiteId(siteUrl);
    let driveId: string;
    let effectiveFolderPath = folderPath;

    try {
      driveId = await getSharePointDriveId(siteId, libraryName);
    } catch (driveError) {
      const shareContext = await resolveDriveFromShareUrl(siteUrl);
      if (!shareContext) {
        throw driveError;
      }

      siteId = shareContext.siteId;
      driveId = shareContext.driveId;
      effectiveFolderPath = joinFolderPaths(shareContext.baseFolderPath, folderPath);
    }

    const { data, error } = await supabaseServer
      .from('sharepoint_sources')
      .insert({
        name,
        category,
        site_url: siteUrl,
        library_name: libraryName,
        folder_path: effectiveFolderPath,
        site_id: siteId,
        drive_id: driveId,
        enabled: true,
      })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ source: data }, { status: 201 });
  } catch (error: any) {
    const message = error?.message || 'Failed to create SharePoint source';
    return NextResponse.json(
      { error: message },
      { status: message.includes('Access denied') ? 403 : 500 }
    );
  }
}
