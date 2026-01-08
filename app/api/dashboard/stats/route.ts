import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics for admins
 */
export async function GET(req: NextRequest) {
  try {
    // Require admin role
    const auth = await requireSessionRole(['ADMIN_IT', 'ADMIN_TRAVEL', 'SUPER_ADMIN']);

    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain'); // Optional domain filter

    // Determine allowed domain
    let allowedDomain = domain;
    if (!auth.roles.includes('SUPER_ADMIN')) {
      if (auth.roles.includes('ADMIN_IT')) {
        allowedDomain = 'IT';
      } else if (auth.roles.includes('ADMIN_TRAVEL')) {
        allowedDomain = 'TRAVEL';
      }
    }

    try {
      // Build base query
      let ticketQuery = supabaseServer.from('Ticket').select('*', { count: 'exact' });

      if (allowedDomain) {
        ticketQuery = ticketQuery.eq('domain', allowedDomain);
      }

      // Get all tickets for calculations
      const { data: allTickets, error: ticketsError } = await ticketQuery;

      if (ticketsError) {
        throw new Error(ticketsError.message);
      }

      const tickets = allTickets || [];

      // Calculate statistics
      const stats = {
        total: tickets.length,
        byStatus: {
          OPEN: tickets.filter((t: any) => t.status === 'OPEN').length,
          IN_PROGRESS: tickets.filter((t: any) => t.status === 'IN_PROGRESS').length,
          WAITING_ON_REQUESTER: tickets.filter((t: any) => t.status === 'WAITING_ON_REQUESTER').length,
          RESOLVED: tickets.filter((t: any) => t.status === 'RESOLVED').length,
          CLOSED: tickets.filter((t: any) => t.status === 'CLOSED').length,
          PENDING_APPROVAL: tickets.filter((t: any) => t.status === 'PENDING_APPROVAL').length,
        },
        byPriority: {
          LOW: tickets.filter((t: any) => t.priority === 'LOW').length,
          MEDIUM: tickets.filter((t: any) => t.priority === 'MEDIUM').length,
          HIGH: tickets.filter((t: any) => t.priority === 'HIGH').length,
          URGENT: tickets.filter((t: any) => t.priority === 'URGENT').length,
        },
        byType: {
          IT: tickets.filter((t: any) => t.type === 'IT').length,
          TRAVEL: tickets.filter((t: any) => t.type === 'TRAVEL').length,
        },
        byDomain: {
          IT: tickets.filter((t: any) => t.domain === 'IT').length,
          TRAVEL: tickets.filter((t: any) => t.domain === 'TRAVEL').length,
        },
      };

      // Calculate average resolution time (for resolved tickets)
      const resolvedTickets = tickets.filter(
        (t: any) => t.status === 'RESOLVED' && t.resolvedAt && t.createdAt
      );
      
      let avgResolutionTime = 0;
      if (resolvedTickets.length > 0) {
        const totalMs = resolvedTickets.reduce((sum: number, t: any) => {
          const created = new Date(t.createdAt).getTime();
          const resolved = new Date(t.resolvedAt).getTime();
          return sum + (resolved - created);
        }, 0);
        avgResolutionTime = Math.round(totalMs / resolvedTickets.length / (1000 * 60 * 60)); // Hours
      }

      // Get unassigned tickets count
      const ticketIds = tickets.map((t: any) => t.id);
      let unassignedCount = 0;
      if (ticketIds.length > 0) {
        const { data: assignments } = await supabaseServer
          .from('TicketAssignment')
          .select('ticketId')
          .in('ticketId', ticketIds)
          .is('unassignedAt', null);

        const assignedTicketIds = new Set((assignments || []).map((a: any) => a.ticketId));
        unassignedCount = tickets.filter((t: any) => !assignedTicketIds.has(t.id)).length;
      }

      // Get pending approvals count
      let pendingApprovalsCount = 0;
      if (ticketIds.length > 0) {
        const { data: approvals } = await supabaseServer
          .from('TicketApproval')
          .select('id')
          .in('ticketId', ticketIds)
          .eq('state', 'PENDING');

        pendingApprovalsCount = (approvals || []).length;
      }

      // Get engineer workload
      const { data: engineerRole } = await supabaseServer
        .from('Role')
        .select('id')
        .eq('type', 'ENGINEER_IT')
        .single();

      const engineerWorkload: Array<{
        engineerId: string;
        engineerEmail: string;
        engineerName?: string;
        assignedCount: number;
      }> = [];

      if (engineerRole?.id && ticketIds.length > 0) {
        const { data: engineerUsers } = await supabaseServer
          .from('UserRole')
          .select(`
            userId,
            user:User!inner(
              id,
              email,
              profile:UserProfile(
                empName
              )
            )
          `)
          .eq('roleId', engineerRole.id)
          .is('revokedAt', null);

        const engineers = engineerUsers || [];

        for (const engineer of engineers) {
          const { data: assignments } = await supabaseServer
            .from('TicketAssignment')
            .select('id')
            .eq('engineerId', engineer.userId)
            .in('ticketId', ticketIds)
            .is('unassignedAt', null);

          const profile = Array.isArray(engineer.user.profile) 
            ? engineer.user.profile[0] 
            : engineer.user.profile;

          engineerWorkload.push({
            engineerId: engineer.userId,
            engineerEmail: engineer.user.email,
            engineerName: profile?.empName,
            assignedCount: (assignments || []).length,
          });
        }
      }

      // Get recent activity (last 10 events)
      const { data: recentEvents } = await supabaseServer
        .from('TicketEvent')
        .select(`
          *,
          ticket:Ticket!inner(
            id,
            ticketNumber,
            title,
            domain
          ),
          creator:User!TicketEvent_createdBy_fkey(
            email,
            profile:UserProfile(
              empName
            )
          )
        `)
        .order('createdAt', { ascending: false })
        .limit(10);

      // Filter recent events by domain if needed
      let filteredRecentEvents = recentEvents || [];
      if (allowedDomain) {
        filteredRecentEvents = filteredRecentEvents.filter(
          (e: any) => e.ticket?.domain === allowedDomain
        );
      }

      return NextResponse.json({
        stats,
        metrics: {
          avgResolutionTimeHours: avgResolutionTime,
          unassignedCount,
          pendingApprovalsCount,
          resolvedCount: stats.byStatus.RESOLVED,
          closedCount: stats.byStatus.CLOSED,
        },
        engineerWorkload: engineerWorkload.sort((a, b) => b.assignedCount - a.assignedCount),
        recentActivity: filteredRecentEvents.map((e: any) => ({
          id: e.id,
          ticketId: e.ticket?.id,
          type: e.type,
          createdAt: e.createdAt,
          ticketNumber: e.ticket?.ticketNumber,
          ticketTitle: e.ticket?.title,
          ticketDomain: e.ticket?.domain,
          creatorName: e.creator?.profile?.empName || e.creator?.email?.split('@')[0],
          creatorEmail: e.creator?.email,
          payload: e.payload,
        })),
      });
    } catch (dbError: any) {
      console.error('Database error fetching dashboard stats:', dbError);
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard statistics' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}

