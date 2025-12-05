import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { JDSummary } from '@/types/jd';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');

    let supabaseQuery = supabaseServer
      .from('jds')
      .select('id, job_title, tone, seniority, length, created_at')
      .order('created_at', { ascending: false });

    // Apply search filter if query provided
    if (query && query.trim()) {
      supabaseQuery = supabaseQuery.or(
        `job_title.ilike.%${query}%,brief_context.ilike.%${query}%`
      );
    }

    const { data, error } = await supabaseQuery;

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch JDs' },
        { status: 500 }
      );
    }

    const summaries: JDSummary[] = (data || []).map((jd) => ({
      jd_id: jd.id,
      job_title: jd.job_title,
      tone: jd.tone,
      seniority: jd.seniority,
      length: jd.length,
      created_at: jd.created_at,
    }));

    return NextResponse.json(summaries);
  } catch (error: any) {
    console.error('Get JDs error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch JDs' },
      { status: 500 }
    );
  }
}

