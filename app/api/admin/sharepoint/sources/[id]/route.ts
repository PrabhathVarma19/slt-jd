import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSessionRole(['SUPER_ADMIN']);

    const sourceId = (params?.id || '').trim();
    if (!sourceId) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from('sharepoint_sources')
      .delete()
      .eq('id', sourceId);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const message = error?.message || 'Failed to delete SharePoint source';
    return NextResponse.json(
      { error: message },
      { status: message.includes('Access denied') ? 403 : 500 }
    );
  }
}
