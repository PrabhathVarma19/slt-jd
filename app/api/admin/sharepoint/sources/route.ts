import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';
import { getSharePointDriveId, getSharePointSiteId } from '@/lib/graph';

function normalizeFolderPath(folderPath?: string | null): string | null {
  if (!folderPath) return null;
  const normalized = folderPath.replace(/\\/g, '/').trim().replace(/^\/+|\/+$/g, '');
  return normalized || null;
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

    const siteId = await getSharePointSiteId(siteUrl);
    const driveId = await getSharePointDriveId(siteId, libraryName);

    const { data, error } = await supabaseServer
      .from('sharepoint_sources')
      .insert({
        name,
        category,
        site_url: siteUrl,
        library_name: libraryName,
        folder_path: folderPath,
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
