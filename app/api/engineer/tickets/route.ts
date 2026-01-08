import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * GET /api/engineer/tickets
 * Get tickets assigned to the current engineer
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has IT engineer role (no travel engineers)
    const hasEngineerRole = session.roles?.some((role) =>
      ['ENGINEER_IT', 'ADMIN_IT', 'SUPER_ADMIN'].includes(role)
    );

    if (!hasEngineerRole) {
      return NextResponse.json({ error: 'IT Engineer role required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Engineers only see IT tickets
    const allowedDomain = 'IT';

    try {
      // Use Supabase
      // Get tickets assigned to this engineer OR unassigned IT tickets
      
      // First, get assigned tickets
      const { data: assignments } = await supabaseServer
        .from('TicketAssignment')
        .select(`
          ticketId,
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
        .eq('engineerId', session.userId)
        .is('unassignedAt', null);

      // Get unassigned IT tickets (tickets with no active assignments)
      const { data: allITTickets } = await supabaseServer
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
          ),
          assignments:TicketAssignment!left (
            id,
            engineerId,
            unassignedAt
          )
        `)
        .eq('domain', 'IT');

      // Filter to get unassigned tickets (no active assignments)
      const unassignedTickets = (allITTickets || []).filter((ticket: any) => {
        const hasActiveAssignment = ticket.assignments?.some(
          (a: any) => a.unassignedAt === null
        );
        return !hasActiveAssignment;
      });

      // Combine assigned and unassigned tickets
      const assignedTicketIds = new Set(
        (assignments || []).map((a: any) => a.ticketId)
      );
      
      let allTickets = [
        ...(assignments || []).map((a: any) => ({
          ...a.ticket,
          isAssigned: true,
        })),
        ...unassignedTickets
          .filter((t: any) => !assignedTicketIds.has(t.id))
          .map((t: any) => ({
            ...t,
            isAssigned: false,
            assignments: [],
          })),
      ];

      // Apply filters
      if (status) {
        allTickets = allTickets.filter((t: any) => t.status === status);
      }
      if (type) {
        allTickets = allTickets.filter((t: any) => t.type === type);
      }

      // Sort by createdAt desc
      allTickets.sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const total = allTickets.length;
      const tickets = allTickets.slice(offset, offset + limit);

      return NextResponse.json({
        tickets,
        total,
        limit,
        offset,
      });
    } catch (dbError: any) {
      console.error('Database error fetching engineer tickets:', dbError);
      return NextResponse.json(
        { error: 'Failed to fetch tickets' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error fetching engineer tickets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tickets' },
      { status: 500 }
    );
  }
}

