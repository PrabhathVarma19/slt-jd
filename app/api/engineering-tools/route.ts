import { NextRequest, NextResponse } from 'next/server';
import { generateEngineeringToolOutput } from '@/lib/ai/llm';
import { EngineeringToolRequest } from '@/types/engineering-tools';
import { supabaseServer } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    const body: EngineeringToolRequest = await request.json();
    if (!body || !body.tool) {
      return NextResponse.json({ error: 'Missing tool type' }, { status: 400 });
    }

    if (body.tool === 'release_notes' && !body.change_list?.trim()) {
      return NextResponse.json({ error: 'Change list is required' }, { status: 400 });
    }
    if (body.tool === 'pr_summary' && !body.pr_title?.trim()) {
      return NextResponse.json({ error: 'PR title is required' }, { status: 400 });
    }
    if (body.tool === 'post_mortem' && (!body.incident_title?.trim() || !body.timeline?.trim())) {
      return NextResponse.json({ error: 'Incident title and timeline are required' }, { status: 400 });
    }

    const result = await generateEngineeringToolOutput(body);

    const session = await getSession();
    if (session) {
      try {
        await supabaseServer.from('EngineeringToolDraft').insert({
          userId: session.userId,
          tool: body.tool,
          input: body,
          output: result,
        });

        await supabaseServer.from('EngineeringToolAuditLog').insert({
          userId: session.userId,
          tool: body.tool,
          action: body.focus_section ? 'regenerate_section' : 'generate',
          meta: { focus_section: body.focus_section || null },
        });
      } catch (dbError) {
        console.error('Engineering tools logging error:', dbError);
      }
    }
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Engineering tools error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate output' },
      { status: 500 }
    );
  }
}
