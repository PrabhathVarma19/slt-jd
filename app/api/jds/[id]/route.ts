import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { JDRecord } from '@/types/jd';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Missing JD ID' }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from('jds')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'JD not found' }, { status: 404 });
      }
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch JD' },
        { status: 500 }
      );
    }

    const jd: JDRecord = {
      id: data.id,
      job_title: data.job_title,
      brief_context: data.brief_context,
      tone: data.tone,
      seniority: data.seniority,
      length: data.length,
      sections: data.sections,
      full_text: data.full_text,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    return NextResponse.json(jd);
  } catch (error: any) {
    console.error('Get JD error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch JD' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Missing JD ID' }, { status: 400 });
    }

    const body = await request.json();
    const { sections, full_text } = body;

    if (!sections || !full_text) {
      return NextResponse.json(
        { error: 'Missing required fields: sections, full_text' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseServer
      .from('jds')
      .update({
        sections,
        full_text,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update JD' },
        { status: 500 }
      );
    }

    const jd: JDRecord = {
      id: data.id,
      job_title: data.job_title,
      brief_context: data.brief_context,
      tone: data.tone,
      seniority: data.seniority,
      length: data.length,
      sections: data.sections,
      full_text: data.full_text,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    return NextResponse.json(jd);
  } catch (error: any) {
    console.error('Update JD error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update JD' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'Missing JD ID' }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from('jds')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Failed to delete JD' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete JD error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete JD' },
      { status: 500 }
    );
  }
}

