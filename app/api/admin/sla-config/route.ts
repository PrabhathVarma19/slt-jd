import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';

const DEFAULTS = {
  URGENT: 240,
  HIGH: 480,
  MEDIUM: 1440,
  LOW: 4320,
};

type Priority = keyof typeof DEFAULTS;

export async function GET() {
  try {
    await requireSessionRole(['ADMIN_IT', 'SUPER_ADMIN']);
    const { data, error } = await supabaseServer.from('SlaConfig').select('*');
    if (error) {
      console.warn('SLA config fetch failed, using defaults:', error.message);
      return NextResponse.json({ config: DEFAULTS });
    }

    const config: Record<Priority, number> = { ...DEFAULTS };
    for (const row of data || []) {
      if (row.priority && typeof row.targetMinutes === 'number') {
        const priority = row.priority as Priority;
        if (priority in config) {
          config[priority] = row.targetMinutes;
        }
      }
    }
    return NextResponse.json({ config });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch SLA config' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireSessionRole(['ADMIN_IT', 'SUPER_ADMIN']);
    const body = await req.json();

    const updates = Object.entries(body || {})
      .filter(([key, value]) => ['URGENT', 'HIGH', 'MEDIUM', 'LOW'].includes(key))
      .map(([priority, value]) => ({
        priority,
        targetMinutes: Number(value),
        updatedAt: new Date().toISOString(),
      }))
      .filter((row) => Number.isFinite(row.targetMinutes) && row.targetMinutes > 0);

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid SLA values provided' },
        { status: 400 }
      );
    }

    const { error } = await supabaseServer.from('SlaConfig').upsert(updates, {
      onConflict: 'priority',
    });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update SLA config' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}
