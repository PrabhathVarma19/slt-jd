import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';

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

