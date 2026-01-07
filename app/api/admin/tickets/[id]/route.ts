import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { supabaseServer } from '@/lib/supabase/server';
import { createTicketEvent } from '@/lib/tickets/ticket-utils';

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
      if (prisma) {
        const ticket = await prisma.ticket.findUnique({
          where: { id: ticketId },
          include: {
            requester: {
              include: {
                profile: true,
              },
            },
            assignments: {
              include: {
                engineer: {
                  include: {
                    profile: {
                      select: {
                        empName: true,
                        employeeId: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                assignedAt: 'desc',
              },
            },
            events: {
              include: {
                creator: {
                  select: {
                    id: true,
                    email: true,
                    profile: {
                      select: {
                        empName: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
            approvals: {
              include: {
                approver: {
                  select: {
                    id: true,
                    email: true,
                    profile: {
                      select: {
                        empName: true,
                      },
                    },
                  },
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        });

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

        return NextResponse.json({ ticket });
      } else {
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
        const [requester, assignments, events] = await Promise.all([
          supabaseServer
            .from('User')
            .select(`
              *,
              profile:UserProfile (*)
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
        ]);

        return NextResponse.json({
          ticket: {
            ...ticket,
            requester: requester.data,
            assignments: assignments.data || [],
            events: events.data || [],
            approvals: [], // TODO: Implement approvals
          },
        });
      }
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
      if (prisma) {
        // Get ticket first to check domain access
        const ticket = await prisma.ticket.findUnique({
          where: { id: ticketId },
        });

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
            updates.resolvedAt = new Date();
          } else if (status === 'CLOSED') {
            updates.closedAt = new Date();
          }
        }

        if (priority) {
          updates.priority = priority;
        }

        // Update ticket
        const updatedTicket = await prisma.ticket.update({
          where: { id: ticketId },
          data: updates,
        });

        // Create events
        if (status && status !== ticket.status) {
          await createTicketEvent(ticketId, 'STATUS_CHANGED', auth.userId, {
            oldStatus: ticket.status,
            newStatus: status,
          });
        }

        if (priority && priority !== ticket.priority) {
          await createTicketEvent(ticketId, 'PRIORITY_CHANGED', auth.userId, {
            oldPriority: ticket.priority,
            newPriority: priority,
          });
        }

        // Handle assignment
        if (action === 'assign' && engineerId) {
          // Unassign existing active assignments
          await prisma.ticketAssignment.updateMany({
            where: {
              ticketId,
              unassignedAt: null,
            },
            data: {
              unassignedAt: new Date(),
              unassignedBy: auth.userId,
            },
          });

          // Create new assignment
          await prisma.ticketAssignment.create({
            data: {
              ticketId,
              engineerId,
              assignedBy: auth.userId,
            },
          });

          await createTicketEvent(ticketId, 'ASSIGNED', auth.userId, {
            engineerId,
          });
        } else if (action === 'unassign') {
          await prisma.ticketAssignment.updateMany({
            where: {
              ticketId,
              unassignedAt: null,
            },
            data: {
              unassignedAt: new Date(),
              unassignedBy: auth.userId,
            },
          });

          await createTicketEvent(ticketId, 'ASSIGNED', auth.userId, {
            action: 'unassigned',
          });
        }

        return NextResponse.json({ ticket: updatedTicket });
      } else {
        // Use Supabase
        const { data: ticket, error: ticketError } = await supabaseServer
          .from('Ticket')
          .select('*')
          .eq('id', ticketId)
          .single();

        if (ticketError || !ticket) {
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

        const { data: updatedTicket, error: updateError } = await supabaseServer
          .from('Ticket')
          .update(updates)
          .eq('id', ticketId)
          .select()
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        // Create events
        if (status && status !== ticket.status) {
          await createTicketEvent(ticketId, 'STATUS_CHANGED', auth.userId, {
            oldStatus: ticket.status,
            newStatus: status,
          });
        }

        if (priority && priority !== ticket.priority) {
          await createTicketEvent(ticketId, 'PRIORITY_CHANGED', auth.userId, {
            oldPriority: ticket.priority,
            newPriority: priority,
          });
        }

        // Handle assignment
        if (action === 'assign' && engineerId) {
          // Unassign existing
          await supabaseServer
            .from('TicketAssignment')
            .update({
              unassignedAt: new Date().toISOString(),
              unassignedBy: auth.userId,
            })
            .eq('ticketId', ticketId)
            .is('unassignedAt', null);

          // Create new assignment
          await supabaseServer.from('TicketAssignment').insert({
            ticketId,
            engineerId,
            assignedBy: auth.userId,
          });

          await createTicketEvent(ticketId, 'ASSIGNED', auth.userId, {
            engineerId,
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
      }
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

