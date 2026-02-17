import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ items: [] });
    }

    const { searchParams } = new URL(request.url);
    const tool = searchParams.get('tool');

    let query = supabaseServer
      .from('EngineeringToolDraft')
      .select('id, tool, input, output, createdAt')
      .eq('userId', session.userId)
      .order('createdAt', { ascending: false })
      .limit(15);

    if (tool) {
      query = query.eq('tool', tool);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Engineering tools history error:', error);
      return NextResponse.json({ items: [] });
    }

    return NextResponse.json({ items: data || [] });
  } catch (error: any) {
    console.error('Engineering tools history error:', error);
    return NextResponse.json({ items: [] });
  }
}
