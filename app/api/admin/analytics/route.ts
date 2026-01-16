import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type Status =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_ON_REQUESTER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'PENDING_APPROVAL';

const DEFAULT_SLA_MINUTES: Record<Priority, number> = {
  URGENT: 240,
  HIGH: 480,
  MEDIUM: 1440,
  LOW: 4320,
};

const STATUS_ORDER: Status[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_ON_REQUESTER',
  'RESOLVED',
  'CLOSED',
  'PENDING_APPROVAL',
];

const PRIORITY_ORDER: Priority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

const parseList = (value: string | null) =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

const parseDate = (value: string | null, endOfDay = false) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else if (value.length <= 10) {
    date.setHours(0, 0, 0, 0);
  }
  return date.toISOString();
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const toDateKey = (value: string | Date) => {
  if (typeof value === 'string' && value.length >= 10) {
    return value.slice(0, 10);
  }
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
};

const minutesBetween = (start: string, end: string) => {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;
  return Math.max(0, Math.round((endMs - startMs) / 60000));
};

const normalizeBreakdown = <T extends string>(keys: T[], counts: Record<string, number>) =>
  keys.reduce((acc, key) => {
    acc[key] = counts[key] || 0;
    return acc;
  }, {} as Record<T, number>);

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSessionRole(['ADMIN_IT', 'SUPER_ADMIN']);

    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || '30d';
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    const statusFilter = parseList(searchParams.get('status'));
    const priorityFilter = parseList(searchParams.get('priority'));
    const categoryFilter = parseList(searchParams.get('category'));
    const subcategoryFilter = parseList(searchParams.get('subcategory'));
    const engineerFilter = parseList(searchParams.get('engineerId'));
    const projectCodeFilter = parseList(searchParams.get('projectCode'));

    const now = new Date();
    let startIso = parseDate(startParam);
    let endIso = parseDate(endParam, true);

    if (!startIso || !endIso) {
      const end = now.toISOString();
      let start: Date;
      if (range === '7d') {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (range === '30d') {
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else {
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      startIso = start.toISOString();
      endIso = end;
    }

    let ticketQuery = supabaseServer
      .from('Ticket')
      .select(
        `
          id,
          ticketNumber,
          title,
          status,
          priority,
          category,
          subcategory,
          createdAt,
          resolvedAt,
          closedAt,
          domain,
          projectCode,
          projectName,
          requester:User!Ticket_requesterId_fkey (
            email,
            profile:UserProfile (
              empName
            )
          )
        `
      )
      .eq('domain', 'IT')
      .gte('createdAt', startIso)
      .lte('createdAt', endIso);

    if (statusFilter.length > 0) {
      ticketQuery = ticketQuery.in('status', statusFilter);
    }
    if (priorityFilter.length > 0) {
      ticketQuery = ticketQuery.in('priority', priorityFilter);
    }
    if (categoryFilter.length > 0) {
      ticketQuery = ticketQuery.in('category', categoryFilter);
    }
    if (subcategoryFilter.length > 0) {
      ticketQuery = ticketQuery.in('subcategory', subcategoryFilter);
    }
    if (projectCodeFilter.length > 0) {
      ticketQuery = ticketQuery.in('projectCode', projectCodeFilter);
    }

    const { data: tickets, error: ticketsError } = await ticketQuery;
    if (ticketsError) {
      throw new Error(ticketsError.message);
    }

    const ticketRows = tickets || [];
    const ticketIds = ticketRows.map((ticket) => ticket.id);

    const applyEngineerFilter = async (ids: string[]) => {
      if (engineerFilter.length === 0 || ids.length === 0) {
        return new Set(ids);
      }

      const { data: assignedTickets, error: assignmentError } = await supabaseServer
        .from('TicketAssignment')
        .select('ticketId')
        .in('engineerId', engineerFilter)
        .is('unassignedAt', null);

      if (assignmentError) {
        throw new Error(assignmentError.message);
      }

      return new Set((assignedTickets || []).map((row) => row.ticketId));
    };

    const filteredIdSet = await applyEngineerFilter(ticketIds);
    const filteredTickets = ticketRows.filter((ticket) => filteredIdSet.has(ticket.id));
    const filteredTicketIds = filteredTickets.map((ticket) => ticket.id);

    const [assignmentsResult, eventsResult, slaConfigResult, recentEventsResult] =
      filteredTicketIds.length > 0
        ? await Promise.all([
            supabaseServer
              .from('TicketAssignment')
              .select(
                `
                  ticketId,
                  assignedAt,
                  engineer:User!TicketAssignment_engineerId_fkey (
                    id,
                    email,
                    profile:UserProfile (
                      empName
                    )
                  )
                `
              )
              .in('ticketId', filteredTicketIds)
              .is('unassignedAt', null),
            supabaseServer
              .from('TicketEvent')
              .select('ticketId, type, createdAt, payload')
              .in('ticketId', filteredTicketIds)
              .in('type', ['STATUS_CHANGED', 'ASSIGNED']),
            supabaseServer.from('SlaConfig').select('*'),
            supabaseServer
              .from('TicketEvent')
              .select(
                `
                  id,
                  ticketId,
                  type,
                  createdAt,
                  payload,
                  ticket:Ticket!inner(
                    ticketNumber,
                    title
                  ),
                  creator:User!TicketEvent_createdBy_fkey(
                    email,
                    profile:UserProfile(empName)
                  )
                `
              )
              .in('ticketId', filteredTicketIds)
              .order('createdAt', { ascending: false })
              .limit(8),
          ])
        : [
            { data: [] },
            { data: [] },
            { data: [] },
            { data: [] },
          ];

    const assignments = assignmentsResult.data || [];
    const events = eventsResult.data || [];
    const slaConfigRows = slaConfigResult.data || [];
    const recentEvents = recentEventsResult.data || [];

    if (slaConfigResult?.error) {
      console.warn('SLA config lookup failed, using defaults:', slaConfigResult.error.message);
    }

    const slaTargets = { ...DEFAULT_SLA_MINUTES };
    for (const row of slaConfigRows) {
      if (row.priority && typeof row.targetMinutes === 'number') {
        slaTargets[row.priority as Priority] = row.targetMinutes;
      }
    }

    const assignmentMap = new Map<string, any>();
    for (const assignment of assignments) {
      const engineer = Array.isArray(assignment.engineer)
        ? assignment.engineer[0]
        : assignment.engineer;
      const profile = Array.isArray(engineer?.profile) ? engineer?.profile[0] : engineer?.profile;
      assignmentMap.set(assignment.ticketId, {
        id: engineer?.id || '',
        email: engineer?.email || '',
        name: profile?.empName || engineer?.email?.split('@')[0] || 'Unassigned',
        assignedAt: assignment.assignedAt,
      });
    }

    const eventMap = new Map<string, Array<any>>();
    for (const event of events) {
      if (!eventMap.has(event.ticketId)) {
        eventMap.set(event.ticketId, []);
      }
      eventMap.get(event.ticketId)?.push(event);
    }

    const statusCounts: Record<Status, number> = {
      OPEN: 0,
      IN_PROGRESS: 0,
      WAITING_ON_REQUESTER: 0,
      RESOLVED: 0,
      CLOSED: 0,
      PENDING_APPROVAL: 0,
    };
    const priorityCounts: Record<Priority, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
    };
    const categoryCounts: Record<string, number> = {};
    const subcategoryCounts: Record<string, number> = {};
    const prioritySlaBreaches: Record<Priority, number> = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      URGENT: 0,
    };
    const engineerStats = new Map<
      string,
      { name: string; email: string; assigned: number; resolved: number; breached: number; totalMinutes: number }
    >();

    let totalAckMinutes = 0;
    let ackCount = 0;
    let totalResolutionMinutes = 0;
    let resolutionCount = 0;
    let slaBreachedCount = 0;
    let slaOnTrackCount = 0;
    let unassignedCount = 0;

    const ticketRowsForExport = filteredTickets.map((ticket) => {
      const requester = Array.isArray(ticket.requester) ? ticket.requester[0] : ticket.requester;
      const requesterProfile = Array.isArray(requester?.profile)
        ? requester?.profile[0]
        : requester?.profile;
      const requesterName =
        requesterProfile?.empName || requester?.email?.split('@')[0] || 'Unknown';
      const requesterEmail = requester?.email || '';
      const assignment = assignmentMap.get(ticket.id);
      const ticketEvents = (eventMap.get(ticket.id) || []).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      const ackCandidates: string[] = [];
      for (const event of ticketEvents) {
        if (event.type === 'STATUS_CHANGED' && event.payload?.newStatus === 'IN_PROGRESS') {
          ackCandidates.push(event.createdAt);
        }
        if (event.type === 'ASSIGNED' && event.payload?.action !== 'unassigned') {
          ackCandidates.push(event.createdAt);
        }
      }
      const ackAt = ackCandidates.sort()[0];
      if (ackAt) {
        totalAckMinutes += minutesBetween(ticket.createdAt, ackAt);
        ackCount += 1;
      }

      let waitingMinutes = 0;
      const statusEvents = ticketEvents.filter((event) => event.type === 'STATUS_CHANGED');
      for (let index = 0; index < statusEvents.length; index += 1) {
        const event = statusEvents[index];
        if (event.payload?.newStatus === 'WAITING_ON_REQUESTER') {
          const start = event.createdAt;
          let end = now.toISOString();
          for (let nextIndex = index + 1; nextIndex < statusEvents.length; nextIndex += 1) {
            const nextEvent = statusEvents[nextIndex];
            if (nextEvent.payload?.newStatus !== 'WAITING_ON_REQUESTER') {
              end = nextEvent.createdAt;
              break;
            }
          }
          waitingMinutes += minutesBetween(start, end);
        }
      }

      const endTime = ticket.resolvedAt || ticket.closedAt || now.toISOString();
      const totalMinutes = minutesBetween(ticket.createdAt, endTime);
      const effectiveMinutes = Math.max(0, totalMinutes - waitingMinutes);

      if (ticket.resolvedAt || ticket.closedAt) {
        totalResolutionMinutes += effectiveMinutes;
        resolutionCount += 1;
      }

      const slaTarget = slaTargets[ticket.priority as Priority] || DEFAULT_SLA_MINUTES.MEDIUM;
      const isBreached = effectiveMinutes > slaTarget;
      if (isBreached) {
        slaBreachedCount += 1;
        prioritySlaBreaches[ticket.priority as Priority] += 1;
      } else {
        slaOnTrackCount += 1;
      }

      if (!assignment) {
        unassignedCount += 1;
      }

      statusCounts[ticket.status as Status] += 1;
      priorityCounts[ticket.priority as Priority] += 1;
      const category = (ticket.category || 'uncategorized').toString().toLowerCase();
      const subcategory = (ticket.subcategory || 'general').toString().toLowerCase();
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      subcategoryCounts[subcategory] = (subcategoryCounts[subcategory] || 0) + 1;

      if (assignment?.id) {
        const current = engineerStats.get(assignment.id) || {
          name: assignment.name,
          email: assignment.email,
          assigned: 0,
          resolved: 0,
          breached: 0,
          totalMinutes: 0,
        };
        current.assigned += 1;
        if (ticket.resolvedAt || ticket.closedAt) {
          current.resolved += 1;
          current.totalMinutes += effectiveMinutes;
        }
        if (isBreached) {
          current.breached += 1;
        }
        engineerStats.set(assignment.id, current);
      }

      return {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.category || 'uncategorized',
        subcategory: ticket.subcategory || 'general',
        createdAt: ticket.createdAt,
        resolvedAt: ticket.resolvedAt,
        closedAt: ticket.closedAt,
        projectCode: ticket.projectCode || '',
        projectName: ticket.projectName || '',
        requesterName,
        requesterEmail,
        assigneeName: assignment?.name || 'Unassigned',
        assigneeEmail: assignment?.email || '',
        slaTargetMinutes: slaTarget,
        slaElapsedMinutes: effectiveMinutes,
        slaBreached: isBreached,
      };
    });

    const avgMttaMinutes = ackCount > 0 ? Math.round(totalAckMinutes / ackCount) : 0;
    const avgMttrMinutes =
      resolutionCount > 0 ? Math.round(totalResolutionMinutes / resolutionCount) : 0;

    const recentActivity = recentEvents.map((event) => {
      const creator = Array.isArray(event.creator) ? event.creator[0] : event.creator;
      const creatorName = creator?.profile?.empName || creator?.email?.split('@')[0] || 'User';
      const ticket = Array.isArray(event.ticket) ? event.ticket[0] : event.ticket;
      return {
        id: event.id,
        type: event.type,
        createdAt: event.createdAt,
        ticketNumber: ticket?.ticketNumber || 'Unknown',
        ticketTitle: ticket?.title || '',
        creatorName,
        creatorEmail: creator?.email || '',
        payload: event.payload,
      };
    });

    const trendDays: string[] = [];
    let cursor = new Date(startIso);
    const endDate = new Date(endIso);
    while (cursor <= endDate) {
      trendDays.push(toDateKey(cursor));
      cursor = addDays(cursor, 1);
    }

    const openedByDay: Record<string, number> = {};
    const resolvedByDay: Record<string, number> = {};
    for (const ticket of filteredTickets) {
      const createdKey = toDateKey(ticket.createdAt);
      openedByDay[createdKey] = (openedByDay[createdKey] || 0) + 1;
      const resolvedAt = ticket.resolvedAt || ticket.closedAt;
      if (resolvedAt) {
        const resolvedKey = toDateKey(resolvedAt);
        resolvedByDay[resolvedKey] = (resolvedByDay[resolvedKey] || 0) + 1;
      }
    }

    const trends = trendDays.map((day) => ({
      day,
      opened: openedByDay[day] || 0,
      resolved: resolvedByDay[day] || 0,
    }));

    const durationDays = Math.max(1, trendDays.length);
    const previousEnd = startIso;
    const previousStart = addDays(new Date(startIso), -durationDays).toISOString();

    let previousQuery = supabaseServer
      .from('Ticket')
      .select('id, status, priority, createdAt, resolvedAt, closedAt')
      .eq('domain', 'IT')
      .gte('createdAt', previousStart)
      .lte('createdAt', previousEnd);

    if (statusFilter.length > 0) {
      previousQuery = previousQuery.in('status', statusFilter);
    }
    if (priorityFilter.length > 0) {
      previousQuery = previousQuery.in('priority', priorityFilter);
    }
    if (categoryFilter.length > 0) {
      previousQuery = previousQuery.in('category', categoryFilter);
    }
    if (subcategoryFilter.length > 0) {
      previousQuery = previousQuery.in('subcategory', subcategoryFilter);
    }
    if (projectCodeFilter.length > 0) {
      previousQuery = previousQuery.in('projectCode', projectCodeFilter);
    }

    const { data: previousTickets, error: previousError } = await previousQuery;
    if (previousError) {
      throw new Error(previousError.message);
    }

    const previousIds = (previousTickets || []).map((ticket) => ticket.id);
    const previousIdSet = await applyEngineerFilter(previousIds);
    const previousFiltered = (previousTickets || []).filter((ticket) => previousIdSet.has(ticket.id));

    const previousResolved = previousFiltered.filter(
      (ticket) => ticket.resolvedAt || ticket.closedAt
    ).length;

    const previousBreached = previousFiltered.filter((ticket) => {
      const target = slaTargets[ticket.priority as Priority] || DEFAULT_SLA_MINUTES.MEDIUM;
      const end = ticket.resolvedAt || ticket.closedAt || previousEnd;
      const elapsed = minutesBetween(ticket.createdAt, end);
      return elapsed > target;
    }).length;

    const comparison = {
      total: {
        current: filteredTickets.length,
        previous: previousFiltered.length,
      },
      resolved: {
        current: resolutionCount,
        previous: previousResolved,
      },
      breached: {
        current: slaBreachedCount,
        previous: previousBreached,
      },
    };

    return NextResponse.json({
      range: {
        start: startIso,
        end: endIso,
      },
      summary: {
        total: filteredTickets.length,
        open: statusCounts.OPEN + statusCounts.IN_PROGRESS + statusCounts.WAITING_ON_REQUESTER,
        backlog: statusCounts.OPEN + statusCounts.IN_PROGRESS,
        unassigned: unassignedCount,
        slaBreached: slaBreachedCount,
        slaOnTrack: slaOnTrackCount,
      },
      metrics: {
        avgMttaMinutes,
        avgMttrMinutes,
      },
      breakdowns: {
        byStatus: normalizeBreakdown(STATUS_ORDER, statusCounts),
        byPriority: normalizeBreakdown(PRIORITY_ORDER, priorityCounts),
        byCategory: categoryCounts,
        bySubcategory: subcategoryCounts,
      },
      trends,
      comparison,
      sla: {
        byPriority: PRIORITY_ORDER.map((priority) => ({
          priority,
          total: priorityCounts[priority],
          breached: prioritySlaBreaches[priority],
          targetMinutes: slaTargets[priority],
        })),
      },
      leaderboard: Array.from(engineerStats.entries())
        .map(([id, stats]) => ({
          id,
          name: stats.name,
          email: stats.email,
          assigned: stats.assigned,
          resolved: stats.resolved,
          breached: stats.breached,
          avgResolutionMinutes: stats.resolved
            ? Math.round(stats.totalMinutes / stats.resolved)
            : 0,
        }))
        .sort((a, b) => b.resolved - a.resolved)
        .slice(0, 6),
      tickets: ticketRowsForExport,
      slaConfig: slaTargets,
      recentActivity,
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}
