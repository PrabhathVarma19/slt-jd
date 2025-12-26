import { NextRequest, NextResponse } from 'next/server';
import { sendMailViaGraph } from '@/lib/graph';

const REQUIRED_FIELDS = ['name', 'employeeId', 'email', 'requestType', 'details'] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];

export async function POST(req: NextRequest) {
  const itDeskEmail = process.env.IT_SERVICEDESK_EMAIL;

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

    if (!itDeskEmail) {
      console.warn(
        'IT_SERVICEDESK_EMAIL is not set. IT service request will be validated but no email sent.'
      );
      return NextResponse.json({
        status: 'accepted',
        message:
          'IT service request captured locally, but IT_SERVICEDESK_EMAIL is not configured so no email was sent.',
      });
    }

    const {
      name,
      employeeId,
      email,
      mobile,
      location,
      grade,
      requestType,
      system,
      environment,
      accessType,
      reason,
      durationType,
      durationUntil,
      project,
      managerEmail,
      impact,
      details,
    } = body;

    const requestTypeLabelMap: Record<string, string> = {
      access: 'System / application access',
      laptop: 'New laptop / hardware',
      software: 'Software install / license',
      password: 'Password / account issue',
      other: 'Other IT request',
    };

    const requestLabel = requestTypeLabelMap[requestType] || requestType || 'IT request';
    const systemLabel = system?.trim() || 'General';

    const subject = `IT Service – ${requestLabel} – ${name} (${employeeId}) – ${systemLabel}`;

    const htmlLines: string[] = [];
    htmlLines.push('<p>A new IT / access service request was submitted from Beacon Service Desk.</p>');
    htmlLines.push('<h3>Employee details</h3>');
    htmlLines.push('<ul>');
    htmlLines.push(`<li><strong>Name:</strong> ${name}</li>`);
    htmlLines.push(`<li><strong>Employee ID:</strong> ${employeeId}</li>`);
    if (email) htmlLines.push(`<li><strong>Email:</strong> ${email}</li>`);
    if (mobile) htmlLines.push(`<li><strong>Mobile:</strong> ${mobile}</li>`);
    if (grade) htmlLines.push(`<li><strong>Grade:</strong> ${grade}</li>`);
    if (location) htmlLines.push(`<li><strong>Location:</strong> ${location}</li>`);
    htmlLines.push('</ul>');

    htmlLines.push('<h3>Request</h3>');
    htmlLines.push('<ul>');
    htmlLines.push(`<li><strong>Type:</strong> ${requestLabel}</li>`);
    htmlLines.push(`<li><strong>System / application:</strong> ${systemLabel}</li>`);
    if (environment) htmlLines.push(`<li><strong>Environment:</strong> ${environment}</li>`);
    if (accessType) htmlLines.push(`<li><strong>Access level:</strong> ${accessType}</li>`);
    if (reason) htmlLines.push(`<li><strong>Reason / use case:</strong> ${reason}</li>`);
    if (durationType) htmlLines.push(`<li><strong>Duration:</strong> ${durationType}</li>`);
    if (durationUntil)
      htmlLines.push(`<li><strong>Requested until:</strong> ${durationUntil}</li>`);
    if (project) htmlLines.push(`<li><strong>Project / client:</strong> ${project}</li>`);
    if (impact) htmlLines.push(`<li><strong>Impact:</strong> ${impact}</li>`);
    if (managerEmail)
      htmlLines.push(`<li><strong>Manager / approver email:</strong> ${managerEmail}</li>`);
    htmlLines.push('</ul>');

    htmlLines.push('<h3>Details</h3>');
    htmlLines.push(
      `<p>${details.replace(
        /\n/g,
        '<br/>'
      )}</p>` || '<p>No additional details were provided.</p>'
    );

    const htmlBody = htmlLines.join('\n');

    const textLines: string[] = [];
    textLines.push('A new IT / access service request was submitted from Beacon Service Desk.');
    textLines.push('');
    textLines.push('Employee details');
    textLines.push(`Name: ${name}`);
    textLines.push(`Employee ID: ${employeeId}`);
    if (email) textLines.push(`Email: ${email}`);
    if (mobile) textLines.push(`Mobile: ${mobile}`);
    if (grade) textLines.push(`Grade: ${grade}`);
    if (location) textLines.push(`Location: ${location}`);
    textLines.push('');
    textLines.push('Request');
    textLines.push(`Type: ${requestLabel}`);
    textLines.push(`System / application: ${systemLabel}`);
    if (environment) textLines.push(`Environment: ${environment}`);
    if (accessType) textLines.push(`Access level: ${accessType}`);
    if (reason) textLines.push(`Reason / use case: ${reason}`);
    if (durationType) textLines.push(`Duration: ${durationType}`);
    if (durationUntil) textLines.push(`Requested until: ${durationUntil}`);
    if (project) textLines.push(`Project / client: ${project}`);
    if (impact) textLines.push(`Impact: ${impact}`);
    if (managerEmail) textLines.push(`Manager / approver email: ${managerEmail}`);
    textLines.push('');
    textLines.push('Details');
    textLines.push(details);

    const mailResult = await sendMailViaGraph({
      to: [itDeskEmail],
      subject,
      htmlBody,
      textBody: textLines.join('\n'),
      replyTo: email ? [email] : undefined,
    });

    if (!mailResult.ok) {
      console.error('Failed to send IT service request via Graph:', mailResult.error);
      return NextResponse.json(
        {
          status: 'error',
          error:
            'Validated the IT service request but failed to send email via Graph. Please contact IT or try again.',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      status: 'queued',
      message: 'IT service request emailed to the IT Service Desk.',
    });
  } catch (error: any) {
    console.error('IT service-desk action error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to capture IT service request' },
      { status: 500 }
    );
  }
}

