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

const daysBetween = (start: string, end: string) => {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;
  return Math.max(0, Math.floor((endMs - startMs) / (24 * 60 * 60 * 1000)));
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

    if (range === 'custom' && (!startParam || !endParam)) {
      return NextResponse.json(
        { error: 'Custom range requires start and end dates.' },
        { status: 400 }
      );
    }

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

    const resolutionAtMap = new Map<string, string>();
    for (const [ticketId, ticketEvents] of eventMap.entries()) {
      const resolutionEvent = ticketEvents
        .filter(
          (event) =>
            event.type === 'STATUS_CHANGED' &&
            (event.payload?.newStatus === 'RESOLVED' || event.payload?.newStatus === 'CLOSED')
        )
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
      if (resolutionEvent?.createdAt) {
        resolutionAtMap.set(ticketId, resolutionEvent.createdAt);
      }
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
    const backlogAging: Record<string, number> = {
      '0-2': 0,
      '3-7': 0,
      '8-14': 0,
      '15+': 0,
    };
    const engineerStats = new Map<
      string,
      {
        name: string;
        email: string;
        assigned: number;
        resolved: number;
        breached: number;
        open: number;
        totalMinutes: number;
      }
    >();

    let totalAckMinutes = 0;
    let ackCount = 0;
    let totalResolutionMinutes = 0;
    let resolutionCount = 0;
    let slaBreachedCount = 0;
    let slaOnTrackCount = 0;
    let unassignedCount = 0;
    let reopenedCount = 0;
    let fcrCount = 0;
    const mttaByDay: Record<string, { total: number; count: number }> = {};
    const mttrByDay: Record<string, { total: number; count: number }> = {};
    const slaBreachesByDay: Record<string, number> = {};

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
      const assignmentEvents = ticketEvents.filter(
        (event) => event.type === 'ASSIGNED' && event.payload?.action !== 'unassigned'
      );
      const statusEvents = ticketEvents.filter((event) => event.type === 'STATUS_CHANGED');
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
        const ackDay = toDateKey(ticket.createdAt);
        if (!mttaByDay[ackDay]) {
          mttaByDay[ackDay] = { total: 0, count: 0 };
        }
        mttaByDay[ackDay].total += minutesBetween(ticket.createdAt, ackAt);
        mttaByDay[ackDay].count += 1;
      }

      let waitingMinutes = 0;
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

      const resolutionAt =
        resolutionAtMap.get(ticket.id) || ticket.resolvedAt || ticket.closedAt || null;
      const endTime = resolutionAt || now.toISOString();
      const totalMinutes = minutesBetween(ticket.createdAt, endTime);
      const effectiveMinutes = Math.max(0, totalMinutes - waitingMinutes);

      if (resolutionAt) {
        totalResolutionMinutes += effectiveMinutes;
        resolutionCount += 1;
        const resolveDay = toDateKey(resolutionAt);
        if (!mttrByDay[resolveDay]) {
          mttrByDay[resolveDay] = { total: 0, count: 0 };
        }
        mttrByDay[resolveDay].total += effectiveMinutes;
        mttrByDay[resolveDay].count += 1;
      }

      const slaTarget = slaTargets[ticket.priority as Priority] || DEFAULT_SLA_MINUTES.MEDIUM;
      const isBreached = effectiveMinutes > slaTarget;
      if (isBreached) {
        slaBreachedCount += 1;
        prioritySlaBreaches[ticket.priority as Priority] += 1;
        const breachDay = toDateKey(ticket.createdAt);
        slaBreachesByDay[breachDay] = (slaBreachesByDay[breachDay] || 0) + 1;
      } else {
        slaOnTrackCount += 1;
      }

      if (!assignment) {
        unassignedCount += 1;
      }

      if (!resolutionAt) {
        const ageDays = daysBetween(ticket.createdAt, now.toISOString());
        if (ageDays <= 2) {
          backlogAging['0-2'] += 1;
        } else if (ageDays <= 7) {
          backlogAging['3-7'] += 1;
        } else if (ageDays <= 14) {
          backlogAging['8-14'] += 1;
        } else {
          backlogAging['15+'] += 1;
        }
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
          open: 0,
          totalMinutes: 0,
        };
        current.assigned += 1;
        if (resolutionAt) {
          current.resolved += 1;
          current.totalMinutes += effectiveMinutes;
        } else {
          current.open += 1;
        }
        if (isBreached) {
          current.breached += 1;
        }
        engineerStats.set(assignment.id, current);
      }

      const reopened = statusEvents.some(
        (event) =>
          event.payload?.newStatus === 'OPEN' &&
          ['RESOLVED', 'CLOSED'].includes(event.payload?.oldStatus)
      );
      if (reopened) {
        reopenedCount += 1;
      }
      const waitingOnRequester = statusEvents.some(
        (event) => event.payload?.newStatus === 'WAITING_ON_REQUESTER'
      );
      if (resolutionAt && !reopened && !waitingOnRequester && assignmentEvents.length <= 1) {
        fcrCount += 1;
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
        resolvedAt: resolutionAt || ticket.resolvedAt,
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
    const reopenRatePercent =
      resolutionCount > 0 ? Math.round((reopenedCount / resolutionCount) * 100) : 0;
    const fcrRatePercent =
      resolutionCount > 0 ? Math.round((fcrCount / resolutionCount) * 100) : 0;

    const recentActivity = recentEvents.map((event) => {
      const creator = Array.isArray(event.creator) ? event.creator[0] : event.creator;
      const creatorProfile = Array.isArray(creator?.profile)
        ? creator?.profile[0]
        : creator?.profile;
      const creatorName = creatorProfile?.empName || creator?.email?.split('@')[0] || 'User';
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
      const resolvedAt =
        resolutionAtMap.get(ticket.id) || ticket.resolvedAt || ticket.closedAt || null;
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

    const slaBreachTrend = trendDays.map((day) => ({
      day,
      breached: slaBreachesByDay[day] || 0,
    }));

    const mttaTrend = trendDays.map((day) => ({
      day,
      minutes: mttaByDay[day] ? Math.round(mttaByDay[day].total / mttaByDay[day].count) : 0,
    }));

    const mttrTrend = trendDays.map((day) => ({
      day,
      minutes: mttrByDay[day] ? Math.round(mttrByDay[day].total / mttrByDay[day].count) : 0,
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

    let previousResolutionMap = new Map<string, string>();
    if (previousFiltered.length > 0) {
      const { data: previousEvents, error: previousEventsError } = await supabaseServer
        .from('TicketEvent')
        .select('ticketId, createdAt, payload')
        .in('ticketId', previousFiltered.map((ticket) => ticket.id))
        .eq('type', 'STATUS_CHANGED');
      if (previousEventsError) {
        throw new Error(previousEventsError.message);
      }
      for (const event of previousEvents || []) {
        if (event.payload?.newStatus !== 'RESOLVED' && event.payload?.newStatus !== 'CLOSED') {
          continue;
        }
        const existing = previousResolutionMap.get(event.ticketId);
        if (!existing || new Date(event.createdAt) < new Date(existing)) {
          previousResolutionMap.set(event.ticketId, event.createdAt);
        }
      }
    }

    const previousResolved = previousFiltered.filter((ticket) => {
      return (
        previousResolutionMap.has(ticket.id) || ticket.resolvedAt || ticket.closedAt
      );
    }).length;

    const previousBreached = previousFiltered.filter((ticket) => {
      const target = slaTargets[ticket.priority as Priority] || DEFAULT_SLA_MINUTES.MEDIUM;
      const end =
        previousResolutionMap.get(ticket.id) || ticket.resolvedAt || ticket.closedAt || previousEnd;
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

    let topAgentFailures: Array<{
      agent: string;
      intent: string | null;
      tool: string | null;
      total: number;
      failures: number;
      failureRate: number;
    }> = [];

    const startDay = startIso.slice(0, 10);
    const endDay = endIso.slice(0, 10);
    const { data: rollups, error: rollupError } = await supabaseServer
      .from('AgentLogMetricsDaily')
      .select('day, agent, intent, tool, successCount, failureCount, totalCount')
      .gte('day', startDay)
      .lte('day', endDay);

    if (rollupError) {
      console.warn('Agent rollup fetch failed:', rollupError.message);
    } else {
      const aggregate = new Map<
        string,
        { agent: string; intent: string | null; tool: string | null; total: number; failures: number }
      >();
      for (const row of rollups || []) {
        const key = `${row.agent}|${row.intent || ''}|${row.tool || ''}`;
        const current = aggregate.get(key) || {
          agent: row.agent,
          intent: row.intent || null,
          tool: row.tool || null,
          total: 0,
          failures: 0,
        };
        current.total += row.totalCount || 0;
        current.failures += row.failureCount || 0;
        aggregate.set(key, current);
      }
      topAgentFailures = Array.from(aggregate.values())
        .map((row) => ({
          agent: row.agent,
          intent: row.intent,
          tool: row.tool,
          total: row.total,
          failures: row.failures,
          failureRate: row.total ? Math.round((row.failures / row.total) * 100) : 0,
        }))
        .sort((a, b) => b.failureRate - a.failureRate || b.failures - a.failures)
        .slice(0, 6);
    }

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
        reopenRatePercent,
        fcrRatePercent,
        reopenCount: reopenedCount,
        fcrCount,
      },
      breakdowns: {
        byStatus: normalizeBreakdown(STATUS_ORDER, statusCounts),
        byPriority: normalizeBreakdown(PRIORITY_ORDER, priorityCounts),
        byCategory: categoryCounts,
        bySubcategory: subcategoryCounts,
      },
      trends,
      trendsSlaBreaches: slaBreachTrend,
      trendsMtta: mttaTrend,
      trendsMttr: mttrTrend,
      backlogAging,
      topAgentFailures,
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
      engineerWorkload: Array.from(engineerStats.entries())
        .map(([id, stats]) => ({
          id,
          name: stats.name,
          email: stats.email,
          open: stats.open,
          resolved: stats.resolved,
        }))
        .sort((a, b) => b.open - a.open)
        .slice(0, 8),
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
