import { NextRequest, NextResponse } from 'next/server';
import { generateCommsAgentOutput } from '@/lib/ai/llm';
import { CommsAgentRequest } from '@/types/comms-agent';
import { getPublishedTemplate } from '@/lib/comms/templates';
import { CommsTemplateType } from '@/types/comms-templates';

export async function POST(request: NextRequest) {
  try {
    const body: CommsAgentRequest = await request.json();

    if (!body || !body.mode || !body.tone) {
      return NextResponse.json(
        { error: 'Missing required fields: mode, tone' },
        { status: 400 }
      );
    }

    let templateType: CommsTemplateType | null = null;
    if (body.templateType) {
      templateType = body.templateType as CommsTemplateType;
    } else if (body.mode === 'incident_update') {
      templateType = 'it_incident';
    } else if (body.mode === 'reply_assistant') {
      templateType = 'leadership_update';
    }

    const template = templateType ? await getPublishedTemplate(templateType) : null;
    if (templateType && !template) {
      return NextResponse.json(
        { error: `No published template found for ${templateType}` },
        { status: 500 }
      );
    }
    const result = await generateCommsAgentOutput(body, template?.sections);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Comms agent error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate comms' },
      { status: 500 }
    );
  }
}
