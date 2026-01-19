import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import { createTicketEvent } from '@/lib/tickets/ticket-utils';
import { sendItNotification } from '@/lib/notifications/it-notifications';

/**
 * GET /api/engineer/tickets/[id]
 * Get ticket details (if assigned to current engineer OR unassigned IT ticket)
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
      // Use Supabase
      // First check if ticket is assigned to this engineer
      const { data: assignment } = await supabaseServer
        .from('TicketAssignment')
        .select('id')
        .eq('ticketId', ticketId)
        .eq('engineerId', session.userId)
        .is('unassignedAt', null)
        .single();

      // Get ticket (assigned or unassigned IT ticket)
      const { data: ticket, error: ticketError } = await supabaseServer
        .from('Ticket')
        .select(`
          *,
          requester:User!Ticket_requesterId_fkey (
            id,
            email,
            profile:UserProfile (
              empName,
              employeeId
            )
          )
        `)
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticket) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      }

      // If ticket is assigned, must be assigned to this engineer
      // If ticket is unassigned, must be IT ticket
      if (assignment) {
        // Ticket is assigned - verify it's assigned to this engineer (already checked above)
      } else {
        // Ticket is unassigned - must be IT ticket
        if (ticket.domain !== 'IT') {
          return NextResponse.json(
            { error: 'Ticket not found or not assigned to you' },
            { status: 404 }
          );
        }
      }

      // Fetch events
      const { data: events } = await supabaseServer
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
        .order('createdAt', { ascending: false });

      const ticketWithEvents = {
        ...ticket,
        events: events || [],
        isAssigned: !!assignment,
      };

      return NextResponse.json({ ticket: ticketWithEvents });
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
 * PATCH /api/engineer/tickets/[id]
 * Update ticket (status, add note)
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
    const { status, note } = await req.json();

    // Verify ticket is assigned to this engineer (required for updates)
    try {
      // Use Supabase
      // Check assignment
      const { data: assignment, error: assignError } = await supabaseServer
        .from('TicketAssignment')
        .select('*, ticket:Ticket!inner(*)')
        .eq('ticketId', ticketId)
        .eq('engineerId', session.userId)
        .is('unassignedAt', null)
        .single();

      if (assignError || !assignment) {
        return NextResponse.json(
          { error: 'Ticket not found or not assigned to you' },
          { status: 403 }
        );
      }

      const ticket = assignment.ticket;
      const updates: any = {};

      // Update status
      if (status && status !== ticket.status) {
        updates.status = status;
        if (status === 'RESOLVED' && !ticket.resolvedAt) {
          updates.resolvedAt = new Date().toISOString();
        }
        if (status === 'CLOSED' && !ticket.closedAt) {
          updates.closedAt = new Date().toISOString();
        }

        await createTicketEvent(ticketId, 'STATUS_CHANGED', session.userId, {
          oldStatus: ticket.status,
          newStatus: status,
        });
        await sendItNotification({
          ticketId,
          actorId: session.userId,
          event: 'ticket_status_changed',
          payload: { oldStatus: ticket.status, newStatus: status },
        });
      }

      // Add note
      if (note && note.trim()) {
        await createTicketEvent(ticketId, 'NOTE_ADDED', session.userId, {
          note: note.trim(),
        });
        await sendItNotification({
          ticketId,
          actorId: session.userId,
          event: 'ticket_note_added',
          payload: { note: note.trim(), fromRequester: false },
        });
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ ticket });
      }

      // Update ticket
      const { data: updatedTicket, error: updateError } = await supabaseServer
        .from('Ticket')
        .update(updates)
        .eq('id', ticketId)
        .select(`
          *,
          requester:User!Ticket_requesterId_fkey (
            id,
            email,
            profile:UserProfile (
              empName,
              employeeId
            )
          )
        `)
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      return NextResponse.json({ ticket: updatedTicket });
    } catch (dbError: any) {
      console.error('Database error updating ticket:', dbError);
      return NextResponse.json(
        { error: 'Failed to update ticket' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error updating ticket:', error);
    return NextResponse.json(
      { error: 'Failed to update ticket' },
      { status: 500 }
    );
  }
}

