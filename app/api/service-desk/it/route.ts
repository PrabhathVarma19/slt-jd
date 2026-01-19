import { NextRequest, NextResponse } from 'next/server';
import { sendMailViaGraph } from '@/lib/graph';
import OpenAI from 'openai';
import { requireAuth } from '@/lib/auth/require-auth';
import { createTicket } from '@/lib/tickets/ticket-utils';
import { supabaseServer } from '@/lib/supabase/server';
import { sendItNotification } from '@/lib/notifications/it-notifications';

const REQUIRED_FIELDS = ['name', 'employeeId', 'email', 'requestType', 'details'] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

export async function POST(req: NextRequest) {
  const itDeskEmail = process.env.IT_SERVICEDESK_EMAIL;

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

    let {
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
      projectCode,
      projectName,
      managerEmail,
      impact,
      details,
    } = body;

    // If the user has not filled many classification fields, let the AI suggest them
    const shouldClassify =
      openai &&
      (!requestType || requestType === 'other' || !system || !impact || !reason);

    if (shouldClassify && openai) {
      try {
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
${details || ''}

Respond with JSON only, no explanation.`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You classify IT service requests into structured fields.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0,
        });

        const content = completion.choices[0]?.message?.content;
        if (content) {
          const jsonText = content.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
          const parsed = JSON.parse(jsonText);

          if (!requestType || requestType === 'other') {
            requestType = parsed.request_type || requestType;
          }
          if (!system) {
            system = parsed.system || system;
          }
          // We currently ignore environment and access level in the outgoing email to keep it simple.
          if (!impact) {
            impact = parsed.impact || impact;
          }
          if (!reason) {
            reason = parsed.reason || reason;
          }
        }
      } catch (e) {
        console.error('IT service AI classification failed; continuing with raw fields.', e);
      }
    }

    const requestTypeLabelMap: Record<string, string> = {
      access: 'System / application access',
      hardware: 'Hardware / devices',
      software: 'Software install',
      subscription: 'Subscription / SaaS access',
      password: 'Password / account issue',
      other: 'Other IT request',
    };

    const requestLabel = requestTypeLabelMap[requestType] || requestType || 'IT request';
    const systemLabel = system?.trim() || 'General';

    // Create ticket in database first
    let ticketNumber: string | null = null;
    let ticketId: string | null = null;
    try {
      // Find user by email to get userId
      let userId = auth.userId;
      
      // If email doesn't match session, try to find user by email
      if (email && email.toLowerCase() !== auth.email.toLowerCase()) {
        const { data: userByEmail } = await supabaseServer
          .from('User')
          .select('id')
          .eq('email', email.toLowerCase())
          .single();
        if (userByEmail) {
          userId = userByEmail.id;
        }
      }

      // Map requestType to category/subcategory
      const category = requestType || 'other';
      const subcategory = system || undefined;
      
      // Map impact to priority
      const priorityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'> = {
        blocker: 'URGENT',
        high: 'HIGH',
        medium: 'MEDIUM',
        low: 'LOW',
      };
      const priority = impact ? priorityMap[impact.toLowerCase()] || 'MEDIUM' : 'MEDIUM';

      const ticket = await createTicket(
        {
          type: 'IT',
          requesterId: userId,
          title: `${requestLabel} - ${systemLabel}`,
          description: details,
          category,
          subcategory,
          priority,
          impact,
          domain: 'IT',
          projectCode: projectCode,
          projectName: projectName,
        },
        auth.userId
      );

      ticketNumber = ticket.ticketNumber;
      ticketId = ticket.id;
    } catch (ticketError: any) {
      console.error('Failed to create ticket in database:', ticketError);
      // Continue with email even if ticket creation fails
    }

    const subject = ticketNumber 
      ? `IT Service – ${ticketNumber} – ${requestLabel} – ${name} (${employeeId}) – ${systemLabel}`
      : `IT Service – ${requestLabel} – ${name} (${employeeId}) – ${systemLabel}`;

    const htmlLines: string[] = [];
    if (ticketNumber) {
      htmlLines.push(`<p>A new IT / access service request was submitted from Beacon Service Desk.</p><p><strong>Ticket Number: ${ticketNumber}</strong></p>`);
    } else {
      htmlLines.push('<p>A new IT / access service request was submitted from Beacon Service Desk.</p>');
    }
    htmlLines.push('<h3>Employee details</h3>');
    htmlLines.push('<ul>');
    htmlLines.push(`<li><strong>Name:</strong> ${name}</li>`);
    htmlLines.push(`<li><strong>Employee ID:</strong> ${employeeId}</li>`);
    if (email) htmlLines.push(`<li><strong>Email:</strong> ${email}</li>`);
    if (mobile) htmlLines.push(`<li><strong>Mobile:</strong> ${mobile}</li>`);
    if (grade) htmlLines.push(`<li><strong>Grade:</strong> ${grade}</li>`);
    htmlLines.push('</ul>');

    htmlLines.push('<h3>Request</h3>');
    htmlLines.push('<ul>');
    htmlLines.push(`<li><strong>Type:</strong> ${requestLabel}</li>`);
    htmlLines.push(`<li><strong>Subcategory / system:</strong> ${systemLabel}</li>`);
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

    // Add ticket number to email body if created
    if (ticketNumber) {
      htmlLines[0] = `<p>A new IT / access service request was submitted from Beacon Service Desk.</p><p><strong>Ticket Number: ${ticketNumber}</strong></p>`;
    }

    const htmlBody = htmlLines.join('\n');

    const textLines: string[] = [];
    textLines.push('A new IT / access service request was submitted from Beacon Service Desk.');
    if (ticketNumber) {
      textLines.push(`Ticket Number: ${ticketNumber}`);
    }
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
    textLines.push(`Subcategory / system: ${systemLabel}`);
    if (reason) textLines.push(`Reason / use case: ${reason}`);
    if (durationType) textLines.push(`Duration: ${durationType}`);
    if (durationUntil) textLines.push(`Requested until: ${durationUntil}`);
    if (projectCode) {
      textLines.push(`Project Code: ${projectCode}${projectName ? ` - ${projectName}` : ''}`);
    }
    if (project) textLines.push(`Project / client: ${project}`);
    if (impact) textLines.push(`Impact: ${impact}`);
    if (managerEmail) textLines.push(`Manager / approver email: ${managerEmail}`);
    textLines.push('');
    textLines.push('Details');
    textLines.push(details);

    const mailResult = await sendMailViaGraph({
      to: [itDeskEmail],
      cc: email ? [email] : undefined,
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
      message: ticketNumber 
        ? `IT service request created (${ticketNumber}) and emailed to the IT Service Desk.`
        : 'IT service request emailed to the IT Service Desk.',
      ticketNumber,
    });
  } catch (error: any) {
    console.error('IT service-desk action error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to capture IT service request' },
      { status: 500 }
    );
  }
}
