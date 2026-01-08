import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { supabaseServer } from '@/lib/supabase/server';
import { createTicketEvent } from '@/lib/tickets/ticket-utils';

/**
 * GET /api/engineer/tickets/[id]
 * Get ticket details (only if assigned to current engineer)
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
      if (prisma) {
        // Check if ticket is assigned to this engineer
        const assignment = await prisma.ticketAssignment.findFirst({
          where: {
            ticketId,
            engineerId: session.userId,
            unassignedAt: null,
          },
          include: {
            ticket: {
              include: {
                requester: {
                  select: {
                    id: true,
                    email: true,
                    profile: {
                      select: {
                        empName: true,
                        employeeId: true,
                      },
                    },
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
              },
            },
          },
        });

        if (!assignment) {
          return NextResponse.json({ error: 'Ticket not found or not assigned to you' }, { status: 404 });
        }

        return NextResponse.json({ ticket: assignment.ticket });
      } else {
        // Use Supabase
        const { data: assignment, error: assignError } = await supabaseServer
          .from('TicketAssignment')
          .select(`
            *,
            ticket:Ticket!inner (
              *,
              requester:User!Ticket_requesterId_fkey (
                id,
                email,
                profile:UserProfile (
                  empName,
                  employeeId
                )
              )
            )
          `)
          .eq('ticketId', ticketId)
          .eq('engineerId', session.userId)
          .is('unassignedAt', null)
          .single();

        if (assignError || !assignment) {
          return NextResponse.json({ error: 'Ticket not found or not assigned to you' }, { status: 404 });
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

        const ticket = {
          ...assignment.ticket,
          events: events || [],
        };

        return NextResponse.json({ ticket });
      }
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

    // Verify ticket is assigned to this engineer
    try {
      if (prisma) {
        const assignment = await prisma.ticketAssignment.findFirst({
          where: {
            ticketId,
            engineerId: session.userId,
            unassignedAt: null,
          },
          include: {
            ticket: true,
          },
        });

        if (!assignment) {
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
            updates.resolvedAt = new Date();
          }
          if (status === 'CLOSED' && !ticket.closedAt) {
            updates.closedAt = new Date();
          }

          await createTicketEvent(ticketId, 'STATUS_CHANGED', session.userId, {
            oldStatus: ticket.status,
            newStatus: status,
          });
        }

        // Add note
        if (note && note.trim()) {
          await createTicketEvent(ticketId, 'NOTE_ADDED', session.userId, {
            note: note.trim(),
          });
        }

        // Update ticket
        const updatedTicket = await prisma.ticket.update({
          where: { id: ticketId },
          data: updates,
          include: {
            requester: {
              select: {
                id: true,
                email: true,
                profile: {
                  select: {
                    empName: true,
                    employeeId: true,
                  },
                },
              },
            },
          },
        });

        return NextResponse.json({ ticket: updatedTicket });
      } else {
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
        }

        // Add note
        if (note && note.trim()) {
          await createTicketEvent(ticketId, 'NOTE_ADDED', session.userId, {
            note: note.trim(),
          });
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
      }
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

