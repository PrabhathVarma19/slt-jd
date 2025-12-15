import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.question || typeof body.question !== 'string') {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 });
    }
    // Placeholder until retrieval/LLM wiring is added.
    return NextResponse.json(
      { error: 'Policy agent retrieval not wired yet. Ingestion and retrieval will be added next.' },
      { status: 501 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to process request' }, { status: 500 });
  }
}
