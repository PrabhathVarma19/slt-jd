import { NextRequest, NextResponse } from 'next/server';
import { autocompleteJobTitle } from '@/lib/ai/llm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { partial_title } = body;

    if (!partial_title || typeof partial_title !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid partial_title field' },
        { status: 400 }
      );
    }

    if (partial_title.trim().length < 2) {
      return NextResponse.json({ suggestion: '' });
    }

    const suggestion = await autocompleteJobTitle(partial_title.trim());

    return NextResponse.json({ suggestion });
  } catch (error: any) {
    console.error('Job title autocomplete error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate suggestion' },
      { status: 500 }
    );
  }
}

