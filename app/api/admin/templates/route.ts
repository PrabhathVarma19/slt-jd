import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { getTemplatesForAdmin } from '@/lib/comms/templates';

export async function GET(_request: NextRequest) {
  try {
    await requireSessionRole(['SUPER_ADMIN']);
    const templates = await getTemplatesForAdmin();
    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('Admin templates fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}
