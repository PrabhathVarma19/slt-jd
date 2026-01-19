import { NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { runItSlaJobs } from '@/lib/notifications/it-sla-jobs';

export async function POST() {
  try {
    const auth = await requireSessionRole(['ADMIN_IT', 'SUPER_ADMIN']);
    const summary = await runItSlaJobs(auth.userId);
    return NextResponse.json({ success: true, summary });
  } catch (error: any) {
    console.error('SLA notification job failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run SLA notifications' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}
