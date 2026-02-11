import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { updateDraftSections } from '@/lib/comms/templates';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSessionRole(['SUPER_ADMIN']);
    const body = await request.json();
    const sections = Array.isArray(body?.sections) ? body.sections : null;
    if (!sections) {
      return NextResponse.json({ error: 'Sections payload is required' }, { status: 400 });
    }

    const updated = await updateDraftSections(params.id, sections);
    return NextResponse.json({ sections: updated });
  } catch (error: any) {
    console.error('Update sections error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update sections' },
      { status: 500 }
    );
  }
}
