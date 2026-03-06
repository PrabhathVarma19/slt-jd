import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';
import { SharePointSource, syncSharePointSource } from '@/lib/sharepoint/sync';

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

    const result = await syncSharePointSource(data as SharePointSource);
    return NextResponse.json(result);
  } catch (error: any) {
    const message = error?.message || 'Failed to sync SharePoint source';
    return NextResponse.json(
      { error: message },
      { status: message.includes('Access denied') ? 403 : 500 }
    );
  }
}
