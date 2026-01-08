import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * GET /api/admin/tickets
 * List tickets with filters (domain, status, etc.)
 * Requires: ADMIN_IT, ADMIN_TRAVEL, or SUPER_ADMIN
 */
export async function GET(req: NextRequest) {
  try {
    // Check admin access
    const auth = await requireSessionRole(['ADMIN_IT', 'ADMIN_TRAVEL', 'SUPER_ADMIN']);

    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain'); // 'IT' or 'TRAVEL'
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search'); // Search in ticket number, title, description
    const assigned = searchParams.get('assigned'); // 'true', 'false', or null for all
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Super admin can see all domains, domain admins only see their domain
    let allowedDomain = domain;
    if (!auth.roles.includes('SUPER_ADMIN')) {
      if (auth.roles.includes('ADMIN_IT')) {
        allowedDomain = 'IT';
      } else if (auth.roles.includes('ADMIN_TRAVEL')) {
        allowedDomain = 'TRAVEL';
      }
    }

    try {
      // Use Supabase
      let query = supabaseServer
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
          `, { count: 'exact' });

        if (allowedDomain) {
          query = query.eq('domain', allowedDomain);
        }
        if (status) {
          query = query.eq('status', status);
        }
        if (type) {
          query = query.eq('type', type);
        }
        if (priority) {
          query = query.eq('priority', priority);
        }
        if (search) {
          // Search in ticketNumber, title, description
          query = query.or(`ticketNumber.ilike.%${search}%,title.ilike.%${search}%,description.ilike.%${search}%`);
        }

        const { data: tickets, error, count } = await query
          .order('createdAt', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          throw new Error(error.message);
        }

        // Fetch assignments and approvals separately
        const ticketIds = tickets?.map((t: any) => t.id) || [];
        let assignments: any[] = [];
        let approvals: any[] = [];
        
        if (ticketIds.length > 0) {
          const [assignData, approvalData] = await Promise.all([
            supabaseServer
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
              .is('unassignedAt', null),
            supabaseServer
              .from('TicketApproval')
              .select('*')
              .in('ticketId', ticketIds),
          ]);

          assignments = assignData.data || [];
          approvals = approvalData.data || [];
        }

        // Merge assignments and approvals into tickets
        let ticketsWithAssignments = tickets?.map((ticket: any) => ({
          ...ticket,
          assignments: assignments.filter((a: any) => a.ticketId === ticket.id),
          approvals: approvals.filter((a: any) => a.ticketId === ticket.id),
        })) || [];

        // Filter by assigned/unassigned if requested
        if (assigned === 'true') {
          ticketsWithAssignments = ticketsWithAssignments.filter((t: any) => t.assignments.length > 0);
        } else if (assigned === 'false') {
          ticketsWithAssignments = ticketsWithAssignments.filter((t: any) => t.assignments.length === 0);
        }

      return NextResponse.json({
        tickets: ticketsWithAssignments,
        total: count || 0,
        limit,
        offset,
      });
    } catch (dbError: any) {
      console.error('Database error fetching tickets:', dbError);
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tickets' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}

