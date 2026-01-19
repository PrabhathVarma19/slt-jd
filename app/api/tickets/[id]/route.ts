import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import { createTicketEvent } from '@/lib/tickets/ticket-utils';
import { sendItNotification } from '@/lib/notifications/it-notifications';

/**
 * GET /api/tickets/[id]
 * Get ticket details (unified endpoint - checks permissions based on user role)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ticketId = params.id;

    try {
      // Get ticket
      const { data: ticket, error: ticketError } = await supabaseServer
        .from('Ticket')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticket) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      }

      // Check permissions:
      // 1. Requester can always view their own tickets
      // 2. Assigned engineer can view
      // 3. Admin can view (domain-based)
      // 4. Unassigned IT tickets can be viewed by engineers

      const isRequester = ticket.requesterId === session.userId;
      
      // Check if assigned to current user
      const { data: assignment } = await supabaseServer
        .from('TicketAssignment')
        .select('id')
        .eq('ticketId', ticketId)
        .eq('engineerId', session.userId)
        .is('unassignedAt', null)
        .single();

      const isAssignedEngineer = !!assignment;

      // Check admin access
      const isAdmin = session.roles?.some((role: string) =>
        ['ADMIN_IT', 'ADMIN_TRAVEL', 'SUPER_ADMIN'].includes(role)
      );

      let hasAccess = false;
      if (isRequester) {
        hasAccess = true;
      } else if (isAssignedEngineer) {
        hasAccess = true;
      } else if (isAdmin) {
        // Check domain access for admins
        if (session.roles?.includes('SUPER_ADMIN')) {
          hasAccess = true;
        } else if (session.roles?.includes('ADMIN_IT') && ticket.domain === 'IT') {
          hasAccess = true;
        } else if (session.roles?.includes('ADMIN_TRAVEL') && ticket.domain === 'TRAVEL') {
          hasAccess = true;
        }
      } else if (!assignment && ticket.domain === 'IT') {
        // Unassigned IT tickets can be viewed by engineers
        const isEngineer = session.roles?.some((role: string) =>
          ['ENGINEER_IT', 'ADMIN_IT', 'SUPER_ADMIN'].includes(role)
        );
        hasAccess = isEngineer;
      }

      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Fetch all related data
      const [requesterResult, assignments, events, approvals] = await Promise.all([
        supabaseServer
          .from('User')
          .select(`
            id,
            email,
            status,
            profile:UserProfile (
              empName,
              employeeId
            )
          `)
          .eq('id', ticket.requesterId)
          .single(),
        supabaseServer
          .from('TicketAssignment')
          .select(`
            *,
            engineer:User!TicketAssignment_engineerId_fkey (
              id,
              email,
              profile:UserProfile (
                empName,
                employeeId
              )
            )
          `)
          .eq('ticketId', ticketId)
          .order('assignedAt', { ascending: false }),
        supabaseServer
          .from('TicketEvent')
          .select(`
            *,
            creator:User!TicketEvent_createdBy_fkey (
              id,
              email,
              profile:UserProfile (
                empName
              )
            )
          `)
          .eq('ticketId', ticketId)
          .order('createdAt', { ascending: true }), // Ascending for timeline
        supabaseServer
          .from('TicketApproval')
          .select('*')
          .eq('ticketId', ticketId)
          .order('requestedAt', { ascending: true }), // Ascending for timeline
      ]);

      const requester = requesterResult.data;
      const requesterProfile = Array.isArray(requester?.profile) 
        ? requester.profile[0] 
        : requester?.profile;

      return NextResponse.json({
        ticket: {
          ...ticket,
          requester: requester ? {
            ...requester,
            profile: requesterProfile,
          } : null,
          assignments: assignments.data || [],
          events: events.data || [],
          approvals: approvals.data || [],
          isRequester,
          isAssignedEngineer,
          isAdmin,
        },
      });
    } catch (dbError: any) {
      console.error('Database error fetching ticket:', dbError);
      return NextResponse.json(
        { error: 'Failed to fetch ticket' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error fetching ticket:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ticket' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tickets/[id]
 * Add comment/note to ticket (for requesters, engineers, and admins)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

 const ticketId = params.id;
  const { comment, action } = await req.json();

  if (action) {
    try {
      const { data: ticket, error: ticketError } = await supabaseServer
        .from('Ticket')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticket) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      }

      const isRequester = ticket.requesterId === session.userId;
      if (!isRequester) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      if (action === 'acknowledge') {
        if (ticket.status !== 'RESOLVED') {
          return NextResponse.json(
            { error: 'Only resolved tickets can be acknowledged' },
            { status: 400 }
          );
        }

        const { error: updateError } = await supabaseServer
          .from('Ticket')
          .update({
            status: 'CLOSED',
            closedAt: new Date().toISOString(),
          })
          .eq('id', ticketId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        await createTicketEvent(ticketId, 'STATUS_CHANGED', session.userId, {
          oldStatus: ticket.status,
          newStatus: 'CLOSED',
          requesterAction: 'acknowledged',
        });
        await sendItNotification({
          ticketId,
          actorId: session.userId,
          event: 'ticket_status_changed',
          payload: { oldStatus: ticket.status, newStatus: 'CLOSED' },
        });

        return NextResponse.json({ success: true });
      }

      if (action === 'reopen') {
        if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
          return NextResponse.json(
            { error: 'Only resolved or closed tickets can be reopened' },
            { status: 400 }
          );
        }

        const { error: updateError } = await supabaseServer
          .from('Ticket')
          .update({
            status: 'OPEN',
            resolvedAt: null,
            closedAt: null,
          })
          .eq('id', ticketId);

        if (updateError) {
          throw new Error(updateError.message);
        }

        await createTicketEvent(ticketId, 'STATUS_CHANGED', session.userId, {
          oldStatus: ticket.status,
          newStatus: 'OPEN',
          requesterAction: 'reopened',
        });
        await sendItNotification({
          ticketId,
          actorId: session.userId,
          event: 'ticket_reopened',
          payload: { oldStatus: ticket.status, newStatus: 'OPEN' },
        });

        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (dbError: any) {
      console.error('Database error updating ticket:', dbError);
      return NextResponse.json(
        { error: 'Failed to update ticket' },
        { status: 500 }
      );
    }
  }

  if (!comment || !comment.trim()) {
    return NextResponse.json(
      { error: 'Comment is required' },
      { status: 400 }
    );
  }

    try {
      // Get ticket to verify access
      const { data: ticket, error: ticketError } = await supabaseServer
        .from('Ticket')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticket) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      }

      // Check permissions: requester, assigned engineer, or admin can add comments
      const isRequester = ticket.requesterId === session.userId;
      
      const { data: assignment } = await supabaseServer
        .from('TicketAssignment')
        .select('id')
        .eq('ticketId', ticketId)
        .eq('engineerId', session.userId)
        .is('unassignedAt', null)
        .single();

      const isAssignedEngineer = !!assignment;

      const isAdmin = session.roles?.some((role: string) =>
        ['ADMIN_IT', 'ADMIN_TRAVEL', 'SUPER_ADMIN'].includes(role)
      );

      if (!isRequester && !isAssignedEngineer && !isAdmin) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Add comment as a NOTE_ADDED event
      await createTicketEvent(ticketId, 'NOTE_ADDED', session.userId, {
        note: comment.trim(),
        fromRequester: isRequester,
      });
      await sendItNotification({
        ticketId,
        actorId: session.userId,
        event: 'ticket_note_added',
        payload: { note: comment.trim(), fromRequester: isRequester },
      });

      return NextResponse.json({
        success: true,
        message: 'Comment added successfully',
      });
    } catch (dbError: any) {
      console.error('Database error adding comment:', dbError);
      return NextResponse.json(
        { error: 'Failed to add comment' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error adding comment:', error);
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    );
  }
}

