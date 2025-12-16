import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const DEFAULT_MODEL = process.env.CHAT_MODEL || 'gpt-4o-mini';

function loadTravelPolicyText(): string {
  const filePath = path.join(
    process.cwd(),
    'data',
    'policies',
    'hr',
    'Trianz India Travel policy Prev.normalized.txt'
  );
  if (!fs.existsSync(filePath)) {
    return '';
  }
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

export async function POST(req: NextRequest) {
  try {
  const body = await req.json();
  const {
      name,
      employeeId,
      mobile,
      email,
      grade,
      origin,
      destination,
      departDate,
      returnDate,
      isOneWay,
      purpose,
      modePreference,
      extraDetails,
    } = body || {};

    if (
      !name ||
      !employeeId ||
      !mobile ||
      !email ||
      !grade ||
      !origin ||
      !destination ||
      !departDate ||
      !purpose
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });
    }

    const travelPolicy = loadTravelPolicyText();

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = `You are a travel desk assistant for Trianz.
You:
- Use the provided travel policy excerpt as guidance, but do not invent rules that are not supported by the text.
- Prepare:
  1) A short plain-text summary of the travel request.
  2) A brief policy check note: whether the request seems compliant for the associate's grade and mode, and any approvals that may be needed.
  3) A clean email draft for the Travel Desk and manager, ready to paste into Outlook, in plain text (no Markdown).

Keep everything concise and practical. Do not include boilerplate disclaimers.`;

    const userPrompt = `Associate details:
Name (as per Govt ID): ${name}
Employee ID: ${employeeId}
Email: ${email}
Grade: ${grade}
Mobile: ${mobile}

Trip details:
Origin: ${origin}
Destination: ${destination}
Onward date: ${departDate}
Return date: ${isOneWay ? 'One-way trip (no return date yet)' : returnDate || 'Not specified'}
Preferred mode: ${modePreference || 'Not specified'}

Purpose of travel:
${purpose}

Additional details:
${extraDetails || 'None'}

Relevant travel policy (if provided):
${travelPolicy || '[No travel policy text available]'}

Please respond in JSON with exactly these keys:
- summary: string
- policyNotes: string
- emailBody: string

The emailBody should be addressed to the Travel Desk and CC the manager (describe as "Manager Name/Email" if unknown).`;

    const completion = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    const summary = (parsed.summary || '').toString().trim();
    const policyNotes = (parsed.policyNotes || '').toString().trim();
    const emailBody = (parsed.emailBody || '').toString().trim();

    return NextResponse.json({
      summary: summary || 'No summary generated.',
      policyNotes: policyNotes || '',
      emailBody: emailBody || 'No email draft generated.',
    });
  } catch (error: any) {
    console.error('Travel desk error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to prepare travel request' },
      { status: 500 }
    );
  }
}
