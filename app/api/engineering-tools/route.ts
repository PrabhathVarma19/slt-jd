import { NextRequest, NextResponse } from 'next/server';
import { generateEngineeringToolOutput } from '@/lib/ai/llm';
import { EngineeringToolRequest } from '@/types/engineering-tools';

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
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Engineering tools error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate output' },
      { status: 500 }
    );
  }
}
