import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';
import { sendMailViaGraph } from '@/lib/graph';

/**
 * GET /api/approvals/travel-admin
 * Get pending approvals for travel admins
 */
export async function GET(req: NextRequest) {
  try {
    // Require travel admin role
    const auth = await requireSessionRole(['ADMIN_TRAVEL', 'SUPER_ADMIN']);

    // Get pending approvals where approverEmail matches travel admin users
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
              employeeId,
              supervisorEmail
            )
          )
        )
      `)
      .eq('approverEmail', auth.email)
      .eq('state', 'PENDING')
      .order('requestedAt', { ascending: false });

    if (approvalsError) {
      console.error('Error fetching travel admin approvals:', approvalsError);
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
        supervisorEmail: approval.ticket?.requester?.profile?.supervisorEmail,
      },
    }));

    return NextResponse.json({
      approvals: formattedApprovals,
    });
  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in travel admin approvals API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/approvals/travel-admin
 * Approve or reject a travel ticket (travel admin action)
 */
export async function POST(req: NextRequest) {
  try {
    // Require travel admin role
    const auth = await requireSessionRole(['ADMIN_TRAVEL', 'SUPER_ADMIN']);

    const body = await req.json();
    const { approvalId, action, note } = body; // action: 'approve' | 'reject'

    if (!approvalId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Missing or invalid approvalId or action' },
        { status: 400 }
      );
    }

    // Verify the approval belongs to this travel admin
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
      .eq('approverEmail', auth.email)
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
        approverUserId: auth.userId,
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
        createdBy: auth.userId,
        payload: {
          approvalId,
          approverEmail: auth.email,
          note: note || null,
          level: 'travel_admin',
        },
      });

    if (eventError) {
      console.error('Error creating approval event:', eventError);
      // Don't fail the request, just log
    }

    // Get ticket and requester info for email notifications
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

    if (action === 'approve') {
      // Check if all travel admin approvals are complete
      const { data: allApprovals } = await supabaseServer
        .from('TicketApproval')
        .select('state')
        .eq('ticketId', approval.ticketId)
        .eq('approverEmail', auth.email);

      // Check if there are any other pending travel admin approvals
      const { data: pendingApprovals } = await supabaseServer
        .from('TicketApproval')
        .select('id')
        .eq('ticketId', approval.ticketId)
        .eq('state', 'PENDING');

      // If no pending approvals remain, move ticket to OPEN
      if (!pendingApprovals || pendingApprovals.length === 0) {
        await supabaseServer
          .from('Ticket')
          .update({
            status: 'OPEN',
            updatedAt: new Date().toISOString(),
          })
          .eq('id', approval.ticketId);

        // Create status change event
        await supabaseServer.from('TicketEvent').insert({
          ticketId: approval.ticketId,
          type: 'STATUS_CHANGED',
          createdBy: auth.userId,
          payload: {
            oldStatus: 'PENDING_APPROVAL',
            newStatus: 'OPEN',
            reason: 'All approvals completed',
          },
        });

        // Notify requester that all approvals are complete
        if (ticketData?.requester?.email) {
          try {
            const requesterSubject = `Travel Request Fully Approved: ${ticketData.ticketNumber}`;
            const requesterHtml = `
              <p>Your travel request has been fully approved and is now being processed.</p>
              <p><strong>Ticket Number:</strong> ${ticketData.ticketNumber}</p>
              <p>The travel desk will contact you with booking details.</p>
              ${note ? `<p><strong>Travel Admin Note:</strong> ${note}</p>` : ''}
            `;
            
            await sendMailViaGraph({
              to: [ticketData.requester.email],
              subject: requesterSubject,
              htmlBody: requesterHtml,
              textBody: `Your travel request has been fully approved and is now being processed.\n\nTicket Number: ${ticketData.ticketNumber}\n\nThe travel desk will contact you with booking details.${note ? `\n\nTravel Admin Note: ${note}` : ''}`,
            });
          } catch (emailError) {
            console.error('Failed to send approval notification email:', emailError);
          }
        }
      } else {
        // Notify requester that this admin approved (but others still pending)
        if (ticketData?.requester?.email) {
          try {
            const requesterSubject = `Travel Request Partially Approved: ${ticketData.ticketNumber}`;
            const requesterHtml = `
              <p>Your travel request has been approved by a travel admin.</p>
              <p><strong>Ticket Number:</strong> ${ticketData.ticketNumber}</p>
              <p>Waiting for additional approvals before processing.</p>
            `;
            
            await sendMailViaGraph({
              to: [ticketData.requester.email],
              subject: requesterSubject,
              htmlBody: requesterHtml,
              textBody: `Your travel request has been approved by a travel admin.\n\nTicket Number: ${ticketData.ticketNumber}\n\nWaiting for additional approvals before processing.`,
            });
          } catch (emailError) {
            console.error('Failed to send partial approval notification email:', emailError);
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
        createdBy: auth.userId,
        payload: {
          level: 'travel_admin',
          note: note || null,
        },
      });

      // Notify requester of rejection
      if (ticketData?.requester?.email) {
        try {
          const requesterSubject = `Travel Request Rejected: ${ticketData.ticketNumber}`;
          const requesterHtml = `
            <p>Your travel request has been rejected by the travel admin.</p>
            <p><strong>Ticket Number:</strong> ${ticketData.ticketNumber}</p>
            ${note ? `<p><strong>Reason:</strong> ${note}</p>` : ''}
            <p>If you have questions, please contact the travel desk.</p>
          `;
          
          await sendMailViaGraph({
            to: [ticketData.requester.email],
            subject: requesterSubject,
            htmlBody: requesterHtml,
            textBody: `Your travel request has been rejected by the travel admin.\n\nTicket Number: ${ticketData.ticketNumber}${note ? `\n\nReason: ${note}` : ''}\n\nIf you have questions, please contact the travel desk.`,
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
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error in travel admin approval POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

