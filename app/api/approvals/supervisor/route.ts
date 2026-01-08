import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import { sendMailViaGraph } from '@/lib/graph';

/**
 * GET /api/approvals/supervisor
 * Get pending approvals for the current supervisor
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get supervisor's email from their profile
    const { data: supervisorProfile } = await supabaseServer
      .from('UserProfile')
      .select('supervisorEmail')
      .eq('userId', session.userId)
      .single();

    // If user doesn't have a profile or supervisorEmail doesn't match their email, they're not a supervisor
    // Actually, we need to check if their email matches any TicketApproval approverEmail
    // So we'll query approvals where approverEmail matches the current user's email
    const { data: approvals, error: approvalsError } = await supabaseServer
      .from('TicketApproval')
      .select(`
        id,
        ticketId,
        approverEmail,
        state,
        note,
        requestedAt,
        decidedAt,
        ticket:Ticket!inner(
          id,
          ticketNumber,
          type,
          title,
          description,
          status,
          priority,
          createdAt,
          requester:User!Ticket_requesterId_fkey(
            id,
            email,
            profile:UserProfile(
              empName,
              employeeId
            )
          )
        )
      `)
      .eq('approverEmail', session.email)
      .eq('state', 'PENDING')
      .order('requestedAt', { ascending: false });

    if (approvalsError) {
      console.error('Error fetching supervisor approvals:', approvalsError);
      return NextResponse.json(
        { error: 'Failed to fetch approvals' },
        { status: 500 }
      );
    }

    // Transform the data to a cleaner format
    const formattedApprovals = (approvals || []).map((approval: any) => ({
      id: approval.id,
      ticketId: approval.ticketId,
      ticketNumber: approval.ticket?.ticketNumber,
      title: approval.ticket?.title,
      description: approval.ticket?.description,
      status: approval.ticket?.status,
      priority: approval.ticket?.priority,
      createdAt: approval.ticket?.createdAt,
      requestedAt: approval.requestedAt,
      requester: {
        email: approval.ticket?.requester?.email,
        name: approval.ticket?.requester?.profile?.empName,
        employeeId: approval.ticket?.requester?.profile?.employeeId,
      },
    }));

    return NextResponse.json({
      approvals: formattedApprovals,
    });
  } catch (error: any) {
    console.error('Error in supervisor approvals API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/approvals/supervisor
 * Approve or reject a travel ticket (supervisor action)
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { approvalId, action, note } = body; // action: 'approve' | 'reject'

    if (!approvalId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Missing or invalid approvalId or action' },
        { status: 400 }
      );
    }

    // Verify the approval belongs to this supervisor
    const { data: approval, error: approvalError } = await supabaseServer
      .from('TicketApproval')
      .select(`
        id,
        ticketId,
        approverEmail,
        state,
        ticket:Ticket!inner(
          id,
          ticketNumber,
          type,
          status
        )
      `)
      .eq('id', approvalId)
      .eq('approverEmail', session.email)
      .eq('state', 'PENDING')
      .single();

    if (approvalError || !approval) {
      return NextResponse.json(
        { error: 'Approval not found or already processed' },
        { status: 404 }
      );
    }

    // Handle ticket data (could be array or object from Supabase)
    const ticket = Array.isArray(approval.ticket) ? approval.ticket[0] : approval.ticket;

    // Verify it's a travel ticket
    if (ticket?.type !== 'TRAVEL') {
      return NextResponse.json(
        { error: 'Only travel tickets can be approved via this endpoint' },
        { status: 400 }
      );
    }

    const newState = action === 'approve' ? 'APPROVED' : 'REJECTED';

    // Update the approval record
    const { error: updateError } = await supabaseServer
      .from('TicketApproval')
      .update({
        state: newState,
        note: note || null,
        decidedAt: new Date().toISOString(),
        approverUserId: session.userId,
      })
      .eq('id', approvalId);

    if (updateError) {
      console.error('Error updating approval:', updateError);
      return NextResponse.json(
        { error: 'Failed to update approval' },
        { status: 500 }
      );
    }

    // Create approval event
    const { error: eventError } = await supabaseServer
      .from('TicketEvent')
      .insert({
        ticketId: approval.ticketId,
        type: action === 'approve' ? 'APPROVED' : 'REJECTED',
        createdBy: session.userId,
        payload: {
          approvalId,
          approverEmail: session.email,
          note: note || null,
          level: 'supervisor',
        },
      });

    if (eventError) {
      console.error('Error creating approval event:', eventError);
      // Don't fail the request, just log
    }

    // Get requester info for email notifications
    const { data: ticketData } = await supabaseServer
      .from('Ticket')
      .select(`
        ticketNumber,
        title,
        description,
        requester:User!Ticket_requesterId_fkey(
          email
        )
      `)
      .eq('id', approval.ticketId)
      .single();

    // Handle requester data (could be array or object from Supabase)
    const requester = ticketData?.requester 
      ? (Array.isArray(ticketData.requester) ? ticketData.requester[0] : ticketData.requester)
      : null;
    const requesterEmail = requester?.email;

    // If approved, create travel admin approval record
    if (action === 'approve') {
      // Find travel admin users (users with ADMIN_TRAVEL role)
      const { data: travelAdminRoles } = await supabaseServer
        .from('Role')
        .select('id')
        .eq('type', 'ADMIN_TRAVEL')
        .single();

      if (travelAdminRoles) {
        // Get travel admin users
        const { data: travelAdmins } = await supabaseServer
          .from('UserRole')
          .select(`
            userId,
            user:User!inner(
              email
            )
          `)
          .eq('roleId', travelAdminRoles.id)
          .is('revokedAt', null);

        // Create approval records for all travel admins
        if (travelAdmins && travelAdmins.length > 0) {
          const travelAdminApprovals = travelAdmins.map((admin: any) => ({
            ticketId: approval.ticketId,
            approverEmail: admin.user.email,
            approverUserId: admin.userId,
            state: 'PENDING',
          }));

          const { error: adminApprovalError } = await supabaseServer
            .from('TicketApproval')
            .insert(travelAdminApprovals);

          if (adminApprovalError) {
            console.error('Error creating travel admin approvals:', adminApprovalError);
            // Don't fail, just log
          }

          // Create approval requested event
          await supabaseServer.from('TicketEvent').insert({
            ticketId: approval.ticketId,
            type: 'APPROVAL_REQUESTED',
            createdBy: session.userId,
            payload: {
              level: 'travel_admin',
              approverEmails: travelAdmins.map((admin: any) => admin.user.email),
            },
          });

          // Send email notifications to travel admins
          const travelAdminEmails = travelAdmins.map((admin: any) => admin.user.email);
          try {
            const adminSubject = `Travel Request Approval Required: ${ticketData?.ticketNumber}`;
            const adminHtml = `
              <p>A travel request has been approved by the supervisor and now requires your approval.</p>
              <p><strong>Ticket Number:</strong> ${ticketData?.ticketNumber}</p>
              <h3>Request Details</h3>
              <p>${ticketData?.description?.replace(/\n/g, '<br>') || ''}</p>
              <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/approvals/travel-admin">Review and Approve</a></p>
            `;
            
            await sendMailViaGraph({
              to: travelAdminEmails,
              cc: requesterEmail ? [requesterEmail] : undefined,
              subject: adminSubject,
              htmlBody: adminHtml,
              textBody: `A travel request has been approved by the supervisor and now requires your approval.\n\nTicket Number: ${ticketData?.ticketNumber}\n\n${ticketData?.description || ''}\n\nReview at: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/approvals/travel-admin`,
            });
          } catch (emailError) {
            console.error('Failed to send travel admin notification email:', emailError);
          }

          // Notify requester of supervisor approval
          if (requesterEmail && ticketData) {
            try {
              const requesterSubject = `Travel Request Approved by Supervisor: ${ticketData.ticketNumber}`;
              const requesterHtml = `
                <p>Your travel request has been approved by your supervisor.</p>
                <p><strong>Ticket Number:</strong> ${ticketData.ticketNumber}</p>
                <p>The request is now pending travel admin approval.</p>
                ${note ? `<p><strong>Supervisor Note:</strong> ${note}</p>` : ''}
              `;
              
              await sendMailViaGraph({
                to: [requesterEmail],
                subject: requesterSubject,
                htmlBody: requesterHtml,
                textBody: `Your travel request has been approved by your supervisor.\n\nTicket Number: ${ticketData.ticketNumber}\n\nThe request is now pending travel admin approval.${note ? `\n\nSupervisor Note: ${note}` : ''}`,
              });
            } catch (emailError) {
              console.error('Failed to send requester notification email:', emailError);
            }
          }
        }
      }
    } else {
      // If rejected, close the ticket
      await supabaseServer
        .from('Ticket')
        .update({
          status: 'CLOSED',
          closedAt: new Date().toISOString(),
        })
        .eq('id', approval.ticketId);

      // Create rejection event
      await supabaseServer.from('TicketEvent').insert({
        ticketId: approval.ticketId,
        type: 'REJECTED',
        createdBy: session.userId,
        payload: {
          level: 'supervisor',
          note: note || null,
        },
      });

      // Notify requester of rejection
      if (requesterEmail && ticketData) {
        try {
          const requesterSubject = `Travel Request Rejected: ${ticketData.ticketNumber}`;
          const requesterHtml = `
            <p>Your travel request has been rejected by your supervisor.</p>
            <p><strong>Ticket Number:</strong> ${ticketData.ticketNumber}</p>
            ${note ? `<p><strong>Reason:</strong> ${note}</p>` : ''}
            <p>If you have questions, please contact your supervisor.</p>
          `;
          
          await sendMailViaGraph({
            to: [requesterEmail],
            subject: requesterSubject,
            htmlBody: requesterHtml,
            textBody: `Your travel request has been rejected by your supervisor.\n\nTicket Number: ${ticketData.ticketNumber}${note ? `\n\nReason: ${note}` : ''}\n\nIf you have questions, please contact your supervisor.`,
          });
        } catch (emailError) {
          console.error('Failed to send rejection notification email:', emailError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Ticket ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    });
  } catch (error: any) {
    console.error('Error in supervisor approval POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

