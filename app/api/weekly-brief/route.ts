import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyBriefDraft } from '@/lib/ai/llm';
import { WeeklyBriefRequest } from '@/types/weekly';

export async function POST(request: NextRequest) {
  try {
    const body: WeeklyBriefRequest = await request.json();
    if (!body || !body.raw_updates || !body.raw_updates.trim()) {
      return NextResponse.json({ error: 'Missing raw_updates' }, { status: 400 });
    }

    const brief = await generateWeeklyBriefDraft(body);
    return NextResponse.json(brief);
  } catch (error: any) {
    console.error('Weekly brief generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate weekly brief' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: 'History not implemented yet' }, { status: 501 });
}
