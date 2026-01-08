import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import { createTicketEvent } from '@/lib/tickets/ticket-utils';

/**
 * POST /api/engineer/tickets/[id]/claim
 * Claim an unassigned IT ticket (assign it to current engineer)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has IT engineer role
    const hasEngineerRole = session.roles?.some((role) =>
      ['ENGINEER_IT', 'ADMIN_IT', 'SUPER_ADMIN'].includes(role)
    );

    if (!hasEngineerRole) {
      return NextResponse.json({ error: 'IT Engineer role required' }, { status: 403 });
    }

    const ticketId = params.id;

    // Check if ticket exists and is IT ticket
    const { data: ticket, error: ticketError } = await supabaseServer
      .from('Ticket')
      .select('id, domain, status')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (ticket.domain !== 'IT') {
      return NextResponse.json({ error: 'Only IT tickets can be claimed' }, { status: 400 });
    }

    // Check if ticket is already assigned
    const { data: existingAssignment } = await supabaseServer
      .from('TicketAssignment')
      .select('id')
      .eq('ticketId', ticketId)
      .is('unassignedAt', null)
      .single();

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'Ticket is already assigned to an engineer' },
        { status: 400 }
      );
    }

    // Create assignment
    const { data: assignment, error: assignError } = await supabaseServer
      .from('TicketAssignment')
      .insert({
        ticketId,
        engineerId: session.userId,
        assignedBy: session.userId,
      })
      .select('id')
      .single();

    if (assignError || !assignment) {
      console.error('Error creating assignment:', assignError);
      return NextResponse.json(
        { error: 'Failed to claim ticket' },
        { status: 500 }
      );
    }

    // Create ASSIGNED event
    await createTicketEvent(ticketId, 'ASSIGNED', session.userId, {
      engineerId: session.userId,
      action: 'claimed',
    });

    // Update ticket status to IN_PROGRESS if it's OPEN
    if (ticket.status === 'OPEN') {
      await supabaseServer
        .from('Ticket')
        .update({ status: 'IN_PROGRESS' })
        .eq('id', ticketId);

      await createTicketEvent(ticketId, 'STATUS_CHANGED', session.userId, {
        oldStatus: 'OPEN',
        newStatus: 'IN_PROGRESS',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Ticket claimed successfully',
    });
  } catch (error: any) {
    console.error('Error claiming ticket:', error);
    return NextResponse.json(
      { error: 'Failed to claim ticket' },
      { status: 500 }
    );
  }
}

