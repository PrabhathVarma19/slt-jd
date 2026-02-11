import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { publishTemplate } from '@/lib/comms/templates';

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSessionRole(['SUPER_ADMIN']);
    const published = await publishTemplate(params.id);
    return NextResponse.json({ published });
  } catch (error: any) {
    console.error('Publish template error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to publish template' },
      { status: 500 }
    );
  }
}
