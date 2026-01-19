import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';
import { createTicketEvent } from '@/lib/tickets/ticket-utils';
import { sendItNotification } from '@/lib/notifications/it-notifications';

/**
 * GET /api/admin/tickets/[id]
 * Get single ticket with full details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireSessionRole(['ADMIN_IT', 'ADMIN_TRAVEL', 'SUPER_ADMIN']);

    const ticketId = params.id;

    try {
      // Use Supabase
      const { data: ticket, error } = await supabaseServer
        .from('Ticket')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (error || !ticket) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      }

      // Check domain access
      if (!auth.roles.includes('SUPER_ADMIN')) {
        if (auth.roles.includes('ADMIN_IT') && ticket.domain !== 'IT') {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
        if (auth.roles.includes('ADMIN_TRAVEL') && ticket.domain !== 'TRAVEL') {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }

      // Fetch related data
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
          .order('createdAt', { ascending: false }),
        supabaseServer
          .from('TicketApproval')
          .select('*')
          .eq('ticketId', ticketId)
          .order('requestedAt', { ascending: false }),
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
        },
      });
    } catch (dbError: any) {
      console.error('Database error fetching ticket:', dbError);
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error fetching ticket:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch ticket' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}

/**
 * PATCH /api/admin/tickets/[id]
 * Update ticket (status, priority, assign engineer)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireSessionRole(['ADMIN_IT', 'ADMIN_TRAVEL', 'SUPER_ADMIN']);

    const ticketId = params.id;
    const body = await req.json();
    const { status, priority, engineerId, action } = body;

    try {
      // Use Supabase
      const { data: ticket, error: ticketError } = await supabaseServer
          .from('Ticket')
          .select('*')
          .eq('id', ticketId)
          .maybeSingle();

        if (ticketError) {
          console.error('Error fetching ticket:', ticketError);
          return NextResponse.json(
            { error: ticketError.message || 'Failed to fetch ticket' },
            { status: 500 }
          );
        }

        if (!ticket) {
          return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        // Check domain access
        if (!auth.roles.includes('SUPER_ADMIN')) {
          if (auth.roles.includes('ADMIN_IT') && ticket.domain !== 'IT') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
          }
          if (auth.roles.includes('ADMIN_TRAVEL') && ticket.domain !== 'TRAVEL') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
          }
        }

        const updates: any = {};
        if (status) {
          updates.status = status;
          if (status === 'RESOLVED') {
            updates.resolvedAt = new Date().toISOString();
          } else if (status === 'CLOSED') {
            updates.closedAt = new Date().toISOString();
          }
        }
        if (priority) {
          updates.priority = priority;
        }

        let updatedTicket = ticket;
        // Only update if there are actual changes
        if (Object.keys(updates).length > 0) {
          const { data: updated, error: updateError } = await supabaseServer
            .from('Ticket')
            .update(updates)
            .eq('id', ticketId)
            .select()
            .maybeSingle();

          if (updateError) {
            throw new Error(updateError.message);
          }

          if (updated) {
            updatedTicket = updated;
          }
        }

        // Create events
        if (status && status !== ticket.status) {
          await createTicketEvent(ticketId, 'STATUS_CHANGED', auth.userId, {
            oldStatus: ticket.status,
            newStatus: status,
          });
          await sendItNotification({
            ticketId,
            actorId: auth.userId,
            event: 'ticket_status_changed',
            payload: { oldStatus: ticket.status, newStatus: status },
          });
        }

        if (priority && priority !== ticket.priority) {
          await createTicketEvent(ticketId, 'PRIORITY_CHANGED', auth.userId, {
            oldPriority: ticket.priority,
            newPriority: priority,
          });
          await sendItNotification({
            ticketId,
            actorId: auth.userId,
            event: 'ticket_priority_changed',
            payload: { oldPriority: ticket.priority, newPriority: priority },
          });
        }

        // Handle assignment
        if (action === 'assign' && engineerId) {
          // Validate engineer exists
          const { data: engineer, error: engineerError } = await supabaseServer
            .from('User')
            .select('id')
            .eq('id', engineerId)
            .maybeSingle();

          if (engineerError) {
            console.error('Engineer validation error:', engineerError);
            return NextResponse.json(
              { error: engineerError?.message || 'Failed to validate engineer' },
              { status: 500 }
            );
          }

          if (!engineer) {
            return NextResponse.json(
              { error: 'Engineer not found' },
              { status: 400 }
            );
          }

          // Unassign existing
          const { error: unassignError } = await supabaseServer
            .from('TicketAssignment')
            .update({
              unassignedAt: new Date().toISOString(),
              unassignedBy: auth.userId,
            })
            .eq('ticketId', ticketId)
            .is('unassignedAt', null);

          if (unassignError) {
            console.error('Error unassigning existing assignment:', unassignError);
            // Continue anyway - might not have existing assignment
          }

          // Create new assignment
          const { data: assignment, error: assignError } = await supabaseServer
            .from('TicketAssignment')
            .insert({
              ticketId,
              engineerId,
              assignedBy: auth.userId,
            })
            .select()
            .maybeSingle();

          if (assignError) {
            console.error('Error creating assignment:', assignError);
            const errorMessage = assignError?.message || assignError?.details || assignError?.hint || 'Failed to assign engineer';
            return NextResponse.json(
              { error: errorMessage },
              { status: 500 }
            );
          }

          if (!assignment) {
            console.error('Assignment created but no data returned');
            return NextResponse.json(
              { error: 'Failed to create assignment - no data returned' },
              { status: 500 }
            );
          }

          await createTicketEvent(ticketId, 'ASSIGNED', auth.userId, {
            engineerId,
          });
          await sendItNotification({
            ticketId,
            actorId: auth.userId,
            event: 'ticket_assigned',
          });
        } else if (action === 'unassign') {
          await supabaseServer
            .from('TicketAssignment')
            .update({
              unassignedAt: new Date().toISOString(),
              unassignedBy: auth.userId,
            })
            .eq('ticketId', ticketId)
            .is('unassignedAt', null);

          await createTicketEvent(ticketId, 'ASSIGNED', auth.userId, {
            action: 'unassigned',
          });
        }

      return NextResponse.json({ ticket: updatedTicket });
    } catch (dbError: any) {
      console.error('Database error updating ticket:', dbError);
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error updating ticket:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update ticket' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}

