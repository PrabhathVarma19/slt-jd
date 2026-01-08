import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
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

    // Check if user has engineer role
    const hasEngineerRole = session.roles?.some((role) =>
      ['ENGINEER_IT', 'ENGINEER_TRAVEL', 'ADMIN_IT', 'ADMIN_TRAVEL', 'SUPER_ADMIN'].includes(role)
    );

    if (!hasEngineerRole) {
      return NextResponse.json({ error: 'Engineer role required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Determine allowed domain based on roles
    let allowedDomain: string | null = null;
    if (!session.roles?.includes('SUPER_ADMIN')) {
      if (session.roles?.includes('ENGINEER_IT') || session.roles?.includes('ADMIN_IT')) {
        allowedDomain = 'IT';
      } else if (session.roles?.includes('ENGINEER_TRAVEL') || session.roles?.includes('ADMIN_TRAVEL')) {
        allowedDomain = 'TRAVEL';
      }
    }

    try {
      if (prisma) {
        // Find active assignments for this engineer
        const where: any = {
          engineerId: session.userId,
          unassignedAt: null,
        };

        const assignments = await prisma.ticketAssignment.findMany({
          where,
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
              },
            },
          },
        });

        // Filter tickets
        let tickets = assignments.map((a: any) => a.ticket).filter((ticket: any) => {
          if (allowedDomain && ticket.domain !== allowedDomain) return false;
          if (status && ticket.status !== status) return false;
          if (type && ticket.type !== type) return false;
          return true;
        });

        // Sort by createdAt desc
        tickets.sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime());

        const total = tickets.length;
        tickets = tickets.slice(offset, offset + limit);

        return NextResponse.json({
          tickets,
          total,
          limit,
          offset,
        });
      } else {
        // Use Supabase
        // First get active assignments
        let assignmentQuery = supabaseServer
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
          .eq('engineerId', session.userId)
          .is('unassignedAt', null);

        const { data: assignments, error: assignError } = await assignmentQuery;

        if (assignError) {
          throw new Error(assignError.message);
        }

        // Filter and transform tickets
        let tickets = (assignments || [])
          .map((a: any) => a.ticket)
          .filter((ticket: any) => {
            if (!ticket) return false;
            if (allowedDomain && ticket.domain !== allowedDomain) return false;
            if (status && ticket.status !== status) return false;
            if (type && ticket.type !== type) return false;
            return true;
          })
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const total = tickets.length;
        tickets = tickets.slice(offset, offset + limit);

        return NextResponse.json({
          tickets,
          total,
          limit,
          offset,
        });
      }
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

