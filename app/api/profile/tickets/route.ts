import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * GET /api/profile/tickets
 * Get tickets created by the current user
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    try {
      if (prisma) {
        const where: any = {
          requesterId: session.userId,
        };

        if (status) {
          where.status = status;
        }
        if (type) {
          where.type = type;
        }

        const [tickets, total] = await Promise.all([
          prisma.ticket.findMany({
            where,
            include: {
              assignments: {
                where: {
                  unassignedAt: null,
                },
                include: {
                  engineer: {
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
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: limit,
            skip: offset,
          }),
          prisma.ticket.count({ where }),
        ]);

        return NextResponse.json({
          tickets,
          total,
          limit,
          offset,
        });
      } else {
        // Use Supabase
        let query = supabaseServer
          .from('Ticket')
          .select('*', { count: 'exact' })
          .eq('requesterId', session.userId);

        if (status) {
          query = query.eq('status', status);
        }
        if (type) {
          query = query.eq('type', type);
        }

        const { data: tickets, error, count } = await query
          .order('createdAt', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          throw new Error(error.message);
        }

        // Fetch assignments separately
        const ticketIds = tickets?.map((t: any) => t.id) || [];
        let assignments: any[] = [];
        if (ticketIds.length > 0) {
          const { data: assignData } = await supabaseServer
            .from('TicketAssignment')
            .select(`
              *,
              engineer:User!TicketAssignment_engineerId_fkey (
                id,
                email,
                profile:UserProfile (
                  empName
                )
              )
            `)
            .in('ticketId', ticketIds)
            .is('unassignedAt', null);

          assignments = assignData || [];
        }

        // Merge assignments into tickets
        const ticketsWithAssignments = tickets?.map((ticket: any) => ({
          ...ticket,
          assignments: assignments.filter((a: any) => a.ticketId === ticket.id),
        })) || [];

        return NextResponse.json({
          tickets: ticketsWithAssignments,
          total: count || 0,
          limit,
          offset,
        });
      }
    } catch (dbError: any) {
      console.error('Database error fetching user tickets:', dbError);
      return NextResponse.json(
        { error: 'Failed to fetch tickets' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error fetching user tickets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tickets' },
      { status: 500 }
    );
  }
}

