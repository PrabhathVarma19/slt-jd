import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

export async function POST(req: NextRequest) {
  if (!openai) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not configured for classification.' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const details = (body?.details || '').toString().trim();

    if (!details) {
      return NextResponse.json(
        { error: 'Missing details for classification.' },
        { status: 400 }
      );
    }

    const prompt = `You are an internal IT service-desk assistant.
Given the free-text description of an IT request below, classify it and propose structured fields.

Return a JSON object with these keys:
- request_type: one of "access", "laptop", "software", "password", "other"
- system: short system or application name (e.g. "VPN", "GitLab", "ERP"). If unknown, use "General".
- environment: one of "Prod", "UAT", "Dev", "NA" (if not applicable)
- access_level: short label such as "View only", "Standard user", "Admin" (or "NA" if not relevant)
- impact: one of "blocker", "high", "medium", "low"
- reason: one sentence reason or use case summarising why this is needed.

Description:
${details}

Respond with JSON only, no explanation.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You classify IT service requests into structured fields.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'No classification returned from model.' },
        { status: 502 }
      );
    }

    const jsonText = content.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
    const parsed = JSON.parse(jsonText);

    return NextResponse.json({
      requestType: parsed.request_type || null,
      system: parsed.system || null,
      environment: parsed.environment || null,
      accessType: parsed.access_level || null,
      impact: parsed.impact || null,
      reason: parsed.reason || null,
    });
  } catch (error: any) {
    console.error('IT classification error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to classify IT request' },
      { status: 500 }
    );
  }
}
