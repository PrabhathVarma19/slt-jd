import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { createDraftFromPublished, deleteDraft } from '@/lib/comms/templates';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSessionRole(['SUPER_ADMIN']);
    const draft = await createDraftFromPublished(params.id, session.userId);
    return NextResponse.json({ draft });
  } catch (error: any) {
    console.error('Create draft error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create draft' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSessionRole(['SUPER_ADMIN']);
    await deleteDraft(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete draft error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to discard draft' },
      { status: 500 }
    );
  }
}
