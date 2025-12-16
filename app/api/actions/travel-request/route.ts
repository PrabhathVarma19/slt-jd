import { NextRequest, NextResponse } from 'next/server';

const REQUIRED_FIELDS = [
  'name',
  'employeeId',
  'mobile',
  'email',
  'grade',
  'origin',
  'destination',
  'departDate',
  'purpose',
  'summary',
  'emailBody',
] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const missing: RequiredField[] = [];
    for (const field of REQUIRED_FIELDS) {
      if (!body[field] || (typeof body[field] === 'string' && !body[field].trim())) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // For now we just log the payload so that wiring is ready
    // for future email/ticket automation (Graph, n8n, Zapier, etc.).
    console.log('Received travel request (stub handler):', {
      name: body.name,
      employeeId: body.employeeId,
      grade: body.grade,
      origin: body.origin,
      destination: body.destination,
      departDate: body.departDate,
      isOneWay: body.isOneWay,
    });

    return NextResponse.json({
      status: 'queued',
      message: 'Travel request captured in stub handler. Backend wiring to external systems is pending.',
    });
  } catch (error: any) {
    console.error('Travel request action error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to capture travel request' },
      { status: 500 }
    );
  }
}

