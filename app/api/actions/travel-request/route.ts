import { NextRequest, NextResponse } from 'next/server';
import { sendMailViaGraph } from '@/lib/graph';
import { requireAuth } from '@/lib/auth/require-auth';
import { createTicket } from '@/lib/tickets/ticket-utils';
import { supabaseServer } from '@/lib/supabase/server';

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
] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];

export async function POST(req: NextRequest) {
  const travelDeskEmail = process.env.TRAVEL_DESK_EMAIL;

  try {
    // Require authentication
    const auth = await requireAuth();
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
      console.warn(
        'TRAVEL_DESK_EMAIL is not set. Travel request will be validated but no email sent.'
      );
      return NextResponse.json({
        status: 'accepted',
        message:
          'Travel request captured locally, but TRAVEL_DESK_EMAIL is not configured so no email was sent. Please contact IT to configure it.',
      });
    }

    // Create ticket in database first
    let ticketNumber: string | null = null;
    try {
      // Find user by email to get userId
      let userId = auth.userId;
      
      // If email doesn't match session, try to find user by email
      if (body.email && body.email.toLowerCase() !== auth.email.toLowerCase()) {
        const { data: userByEmail } = await supabaseServer
          .from('User')
          .select('id')
          .eq('email', body.email.toLowerCase())
          .single();
        if (userByEmail) {
          userId = userByEmail.id;
        }
      }

      // Build description from trip details
      const description = `Travel Request Details:
Origin: ${body.origin}
Destination: ${body.destination}
Departure: ${body.departDate}
${body.returnDate && !body.isOneWay ? `Return: ${body.returnDate}` : body.isOneWay ? 'Return: One-way trip' : ''}
Purpose: ${body.purpose}
${body.modePreference ? `Preferred mode: ${body.modePreference}` : ''}
${body.extraDetails ? `Additional details: ${body.extraDetails}` : ''}`;

      const ticket = await createTicket(
        {
          type: 'TRAVEL',
          requesterId: userId,
          title: `Travel: ${body.origin} → ${body.destination}`,
          description,
          category: 'travel_request',
          subcategory: body.modePreference || undefined,
          priority: 'MEDIUM', // Travel requests default to MEDIUM
          domain: 'TRAVEL',
          status: 'PENDING_APPROVAL', // Travel tickets start with approval workflow
          projectCode: body.projectCode,
          projectName: body.projectName,
        },
        auth.userId
      );

      // Create supervisor approval record
      // Get requester's profile to find supervisor email
      const { data: requesterProfile } = await supabaseServer
        .from('UserProfile')
        .select('supervisorEmail')
        .eq('userId', userId)
        .single();

      if (requesterProfile?.supervisorEmail) {
        await supabaseServer
          .from('TicketApproval')
          .insert({
            ticketId: ticket.id,
            approverEmail: requesterProfile.supervisorEmail,
            state: 'PENDING',
          });

        // Send email notification to supervisor
        try {
          const supervisorSubject = `Travel Request Approval Required: ${ticket.ticketNumber}`;
          const supervisorHtml = `
            <p>A new travel request requires your approval.</p>
            <p><strong>Ticket Number:</strong> ${ticket.ticketNumber}</p>
            <h3>Request Details</h3>
            <p>${description.replace(/\n/g, '<br>')}</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/approvals/supervisor">Review and Approve</a></p>
          `;
          
          await sendMailViaGraph({
            to: [requesterProfile.supervisorEmail],
            cc: [body.email],
            subject: supervisorSubject,
            htmlBody: supervisorHtml,
            textBody: `A new travel request requires your approval.\n\nTicket Number: ${ticket.ticketNumber}\n\n${description}\n\nReview at: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/approvals/supervisor`,
          });
        } catch (emailError) {
          console.error('Failed to send supervisor notification email:', emailError);
          // Don't fail the request if email fails
        }
      }

      ticketNumber = ticket.ticketNumber;
    } catch (ticketError: any) {
      console.error('Failed to create ticket in database:', ticketError);
      // Continue with email even if ticket creation fails
    }

    const subject = ticketNumber
      ? `Travel request: ${ticketNumber} – ${body.name} (${body.employeeId}) – ${body.origin} → ${body.destination}`
      : `Travel request: ${body.name} (${body.employeeId}) – ${body.origin} → ${body.destination}`;

    const htmlBody = `
      ${ticketNumber 
        ? `<p>A new travel request was submitted from Beacon Travel Desk.</p><p><strong>Ticket Number: ${ticketNumber}</strong></p>`
        : '<p>A new travel request was submitted from Beacon Travel Desk.</p>'}
      <h3>Employee details</h3>
      <ul>
        <li><strong>Name as per Govt ID:</strong> ${body.name}</li>
        <li><strong>Employee ID:</strong> ${body.employeeId}</li>
        <li><strong>Mobile:</strong> ${body.mobile}</li>
        <li><strong>Grade:</strong> ${body.grade}</li>
        <li><strong>Email:</strong> ${body.email}</li>
        ${body.projectCode ? `<li><strong>Project Code:</strong> ${body.projectCode}${body.projectName ? ` - ${body.projectName}` : ''}</li>` : ''}
      </ul>
      <h3>Trip details</h3>
      <ul>
        <li><strong>Origin:</strong> ${body.origin}</li>
        <li><strong>Destination:</strong> ${body.destination}</li>
        <li><strong>Departure:</strong> ${body.departDate}</li>
        ${
          body.returnDate && !body.isOneWay
            ? `<li><strong>Return:</strong> ${body.returnDate}</li>`
            : body.isOneWay
            ? `<li><strong>Return:</strong> One-way trip</li>`
            : ''
        }
        <li><strong>Purpose:</strong> ${body.purpose}</li>
        ${
          body.modePreference
            ? `<li><strong>Preferred mode:</strong> ${body.modePreference}</li>`
            : ''
        }
        ${
          body.extraDetails
            ? `<li><strong>Additional details:</strong> ${body.extraDetails}</li>`
            : ''
        }
      </ul>
    `;

    const textBodyLines = [
      'A new travel request was submitted from Beacon Travel Desk.',
      ticketNumber ? `Ticket Number: ${ticketNumber}` : '',
      '',
      'Employee details',
      `Name as per Govt ID: ${body.name}`,
      `Employee ID: ${body.employeeId}`,
      `Mobile: ${body.mobile}`,
      `Grade: ${body.grade}`,
      `Email: ${body.email}`,
      body.projectCode ? `Project Code: ${body.projectCode}${body.projectName ? ` - ${body.projectName}` : ''}` : '',
      '',
      'Trip details',
      `Origin: ${body.origin}`,
      `Destination: ${body.destination}`,
      `Departure: ${body.departDate}`,
      body.returnDate && !body.isOneWay
        ? `Return: ${body.returnDate}`
        : body.isOneWay
        ? 'Return: One-way trip'
        : '',
      `Purpose: ${body.purpose}`,
      body.modePreference ? `Preferred mode: ${body.modePreference}` : '',
      body.extraDetails ? `Additional details: ${body.extraDetails}` : '',
    ].filter(Boolean);

    const mailResult = await sendMailViaGraph({
      to: [travelDeskEmail],
      cc: body.email ? [body.email] : undefined,
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
      message: ticketNumber
        ? `Travel request created (${ticketNumber}) and emailed to the Travel Desk.`
        : 'Travel request emailed to the Travel Desk.',
      ticketNumber,
    });
  } catch (error: any) {
    console.error('Travel request action error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to capture travel request' },
      { status: 500 }
    );
  }
}

