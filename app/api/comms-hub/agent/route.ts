import { NextRequest, NextResponse } from 'next/server';
import { generateCommsAgentOutput } from '@/lib/ai/llm';
import { CommsAgentRequest } from '@/types/comms-agent';

export async function POST(request: NextRequest) {
  try {
    const body: CommsAgentRequest = await request.json();

    if (!body || !body.mode || !body.tone) {
      return NextResponse.json(
        { error: 'Missing required fields: mode, tone' },
        { status: 400 }
      );
    }

    const result = await generateCommsAgentOutput(body);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Comms agent error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate comms' },
      { status: 500 }
    );
  }
}
