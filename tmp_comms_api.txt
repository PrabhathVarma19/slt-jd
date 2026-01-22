import { NextRequest, NextResponse } from 'next/server';
import { generateCommsOutput } from '@/lib/ai/llm';
import { CommsRequest } from '@/types/comms';

export async function POST(request: NextRequest) {
  try {
    const body: CommsRequest = await request.json();

    if (!body || !body.mode || !body.audience || !body.formality || !body.content) {
      return NextResponse.json(
        { error: 'Missing required fields: mode, audience, formality, content' },
        { status: 400 }
      );
    }

    const result = await generateCommsOutput(body);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Comms hub error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate comms' },
      { status: 500 }
    );
  }
}
