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
      .from('EngineeringToolPreset')
      .select('id, tool, name, data, createdAt, updatedAt')
      .eq('userId', session.userId)
      .order('updatedAt', { ascending: false });

    if (tool) {
      query = query.eq('tool', tool);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Engineering tools presets error:', error);
      return NextResponse.json({ items: [] });
    }

    return NextResponse.json({ items: data || [] });
  } catch (error: any) {
    console.error('Engineering tools presets error:', error);
    return NextResponse.json({ items: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tool, name, data } = body || {};
    if (!tool || !name || !data) {
      return NextResponse.json({ error: 'Missing preset data' }, { status: 400 });
    }

    const payload = {
      userId: session.userId,
      tool,
      name,
      data,
      updatedAt: new Date().toISOString(),
    };

    const { data: existing } = await supabaseServer
      .from('EngineeringToolPreset')
      .select('id')
      .eq('userId', session.userId)
      .eq('tool', tool)
      .eq('name', name)
      .maybeSingle();

    if (existing?.id) {
      const { error: updateError } = await supabaseServer
        .from('EngineeringToolPreset')
        .update(payload)
        .eq('id', existing.id);
      if (updateError) {
        throw updateError;
      }
    } else {
      const { error: insertError } = await supabaseServer
        .from('EngineeringToolPreset')
        .insert({
          ...payload,
          createdAt: new Date().toISOString(),
        });
      if (insertError) {
        throw insertError;
      }
    }

    await supabaseServer.from('EngineeringToolAuditLog').insert({
      userId: session.userId,
      tool,
      action: 'preset_saved',
      meta: { name },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Engineering tools presets error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save preset' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing preset id' }, { status: 400 });
    }

    const { error } = await supabaseServer
      .from('EngineeringToolPreset')
      .delete()
      .eq('id', id)
      .eq('userId', session.userId);
    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Engineering tools presets error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete preset' },
      { status: 500 }
    );
  }
}
