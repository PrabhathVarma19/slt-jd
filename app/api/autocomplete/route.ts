import { NextRequest, NextResponse } from 'next/server';
import { autocompleteSuggestion } from '@/lib/ai/llm';
import { AutocompleteRequest } from '@/types/jd';

export async function POST(request: NextRequest) {
  try {
    const body: AutocompleteRequest = await request.json();

    // Validate request body
    if (
      !body.field ||
      body.current_line === undefined ||
      !body.job_title ||
      !body.tone ||
      !body.seniority
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (body.field !== 'responsibility' && body.field !== 'skill') {
      return NextResponse.json(
        { error: 'field must be "responsibility" or "skill"' },
        { status: 400 }
      );
    }

    const suggestion = await autocompleteSuggestion(body);

    return NextResponse.json({ suggestion });
  } catch (error: any) {
    console.error('Autocomplete error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate suggestion' },
      { status: 500 }
    );
  }
}

