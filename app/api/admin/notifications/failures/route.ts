import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    await requireSessionRole(['ADMIN_IT', 'SUPER_ADMIN']);
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
    const page = Math.max(Number(searchParams.get('page') || 1), 1);
    const status = searchParams.get('status');
    const event = searchParams.get('event');
    const domain = searchParams.get('domain') || 'IT';

    let query = supabaseServer
      .from('NotificationFailure')
      .select('*', { count: 'exact' })
      .eq('domain', domain);

    if (status) {
      query = query.eq('status', status);
    }
    if (event) {
      query = query.eq('event', event);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, error, count } = await query
      .order('createdAt', { ascending: false })
      .range(from, to);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      failures: data || [],
      page,
      limit,
      total: count || 0,
      totalPages: count ? Math.ceil(count / limit) : 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch notification failures' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}
