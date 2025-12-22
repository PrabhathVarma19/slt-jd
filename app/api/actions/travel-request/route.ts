import { NextRequest, NextResponse } from 'next/server';
import { sendMailViaGraph } from '@/lib/graph';

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
  const travelDeskEmail = process.env.TRAVEL_DESK_EMAIL;

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

    if (!travelDeskEmail) {
      console.warn('TRAVEL_DESK_EMAIL is not set. Travel request will be validated but no email sent.');
      return NextResponse.json({
        status: 'accepted',
        message:
          'Travel request captured locally, but TRAVEL_DESK_EMAIL is not configured so no email was sent. Please contact IT to configure it.',
      });
    }

    const subject = `Travel request: ${body.name} (${body.employeeId}) – ${body.origin} → ${body.destination}`;

    const htmlBody = `
      <p>A new travel request was submitted from Beacon Travel Desk.</p>
      <h3>Employee details</h3>
      <ul>
        <li><strong>Name as per Govt ID:</strong> ${body.name}</li>
        <li><strong>Employee ID:</strong> ${body.employeeId}</li>
        <li><strong>Mobile:</strong> ${body.mobile}</li>
        <li><strong>Grade:</strong> ${body.grade}</li>
        <li><strong>Email:</strong> ${body.email}</li>
      </ul>
      <h3>Trip details</h3>
      <ul>
        <li><strong>Origin:</strong> ${body.origin}</li>
        <li><strong>Destination:</strong> ${body.destination}</li>
        <li><strong>Departure:</strong> ${body.departDate}</li>
        ${
          body.returnDate && !body.isOneWay
            ? `<li><strong>Return:</strong> ${body.returnDate}</li>`
            : ''
        }
        <li><strong>Purpose:</strong> ${body.purpose}</li>
      </ul>
      <h3>Beacon summary</h3>
      <p>${body.summary || 'No summary provided.'}</p>
      <h3>Proposed email text</h3>
      <pre style="white-space:pre-wrap;font-family:system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">${body.emailBody}</pre>
    `;

    const textBodyLines = [
      'A new travel request was submitted from Beacon Travel Desk.',
      '',
      'Employee details',
      `Name as per Govt ID: ${body.name}`,
      `Employee ID: ${body.employeeId}`,
      `Mobile: ${body.mobile}`,
      `Grade: ${body.grade}`,
      `Email: ${body.email}`,
      '',
      'Trip details',
      `Origin: ${body.origin}`,
      `Destination: ${body.destination}`,
      `Departure: ${body.departDate}`,
      body.returnDate && !body.isOneWay ? `Return: ${body.returnDate}` : '',
      `Purpose: ${body.purpose}`,
      '',
      'Beacon summary',
      body.summary || 'No summary provided.',
      '',
      'Proposed email text',
      body.emailBody,
    ].filter(Boolean);

    const mailResult = await sendMailViaGraph({
      to: [travelDeskEmail],
      subject,
      htmlBody,
      textBody: textBodyLines.join('\n'),
      replyTo: body.email ? [body.email] : undefined,
    });

    if (!mailResult.ok) {
      console.error('Failed to send travel request email via Graph:', mailResult.error);
      return NextResponse.json(
        {
          status: 'error',
          error:
            'Validated the travel request but failed to send email via Graph. Please contact IT or try again.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      status: 'queued',
      message: 'Travel request emailed to the Travel Desk.',
    });
  } catch (error: any) {
    console.error('Travel request action error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to capture travel request' },
      { status: 500 }
    );
  }
}
