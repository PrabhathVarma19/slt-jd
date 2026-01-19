import { supabaseServer } from '@/lib/supabase/server';
import { sendMailViaGraph } from '@/lib/graph';
import { createTicketEvent } from '@/lib/tickets/ticket-utils';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

const DEFAULT_SLA_MINUTES: Record<Priority, number> = {
  URGENT: 240,
  HIGH: 480,
  MEDIUM: 1440,
  LOW: 4320,
};

const WARNING_THRESHOLD = 0.8;
const REMINDER_DAYS = [3, 5];
const AUTO_CLOSE_DAYS = 7;

const toMinutes = (ms: number) => Math.max(0, Math.round(ms / 60000));

const getProfile = (value: any) => (Array.isArray(value) ? value[0] : value);

const uniqueEmails = (emails: Array<string | undefined | null>) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const email of emails) {
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(email);
  }
  return result;
};

const computeWaitingMinutes = (events: any[], nowIso: string) => {
  const statusEvents = events
    .filter((event) => event.type === 'STATUS_CHANGED')
    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  let waitingMinutes = 0;
  for (let index = 0; index < statusEvents.length; index += 1) {
    const event = statusEvents[index];
    if (event.payload?.newStatus === 'WAITING_ON_REQUESTER') {
      const start = event.createdAt;
      let end = nowIso;
      for (let nextIndex = index + 1; nextIndex < statusEvents.length; nextIndex += 1) {
        const nextEvent = statusEvents[nextIndex];
        if (nextEvent.payload?.newStatus !== 'WAITING_ON_REQUESTER') {
          end = nextEvent.createdAt;
          break;
        }
      }
      waitingMinutes += toMinutes(new Date(end).getTime() - new Date(start).getTime());
    }
  }

  return waitingMinutes;
};

export async function runItSlaJobs(actorId: string) {
  const now = new Date();
  const nowIso = now.toISOString();

  const itDeskEmail = process.env.IT_SERVICEDESK_EMAIL || '';

  const { data: slaConfig } = await supabaseServer.from('SlaConfig').select('*');
  const slaTargets = { ...DEFAULT_SLA_MINUTES };
  for (const row of slaConfig || []) {
    if (row.priority && typeof row.targetMinutes === 'number') {
      slaTargets[row.priority as Priority] = row.targetMinutes;
    }
  }

  const { data: tickets, error: ticketError } = await supabaseServer
    .from('Ticket')
    .select(
      `
      id,
      ticketNumber,
      title,
      status,
      priority,
      createdAt,
      resolvedAt,
      requester:User!Ticket_requesterId_fkey (
        email,
        profile:UserProfile (empName)
      ),
      assignments:TicketAssignment!TicketAssignment_ticketId_fkey (
        id,
        unassignedAt,
        engineer:User!TicketAssignment_engineerId_fkey (
          email,
          profile:UserProfile (empName)
        )
      )
    `
    )
    .eq('domain', 'IT');

  if (ticketError) {
    throw new Error(ticketError.message);
  }

  const ticketRows = tickets || [];
  const ticketIds = ticketRows.map((ticket) => ticket.id);

  const { data: events } = ticketIds.length
    ? await supabaseServer
        .from('TicketEvent')
        .select('ticketId, type, createdAt, payload')
        .in('ticketId', ticketIds)
        .in('type', [
          'STATUS_CHANGED',
          'SLA_WARNING',
          'SLA_BREACH',
          'AUTO_CLOSE_REMINDER',
        ])
    : { data: [] };

  const eventMap = new Map<string, any[]>();
  for (const event of events || []) {
    if (!eventMap.has(event.ticketId)) {
      eventMap.set(event.ticketId, []);
    }
    eventMap.get(event.ticketId)?.push(event);
  }

  let warningsSent = 0;
  let breachesSent = 0;
  let remindersSent = 0;
  let autoClosed = 0;

  for (const ticket of ticketRows) {
    const eventsForTicket = eventMap.get(ticket.id) || [];
    const requester = Array.isArray(ticket.requester) ? ticket.requester[0] : ticket.requester;
    const requesterProfile = getProfile(requester?.profile);
    const requesterEmail = requester?.email || '';
    const requesterName = requesterProfile?.empName || requesterEmail.split('@')[0] || 'Requester';

    const assignments = Array.isArray(ticket.assignments) ? ticket.assignments : [];
    const activeAssignment = assignments.find((row) => row?.unassignedAt == null);
    const engineer = activeAssignment?.engineer
      ? Array.isArray(activeAssignment.engineer)
        ? activeAssignment.engineer[0]
        : activeAssignment.engineer
      : null;
    const assigneeEmail = engineer?.email || '';

    const hasEvent = (type: string, predicate?: (payload: any) => boolean) =>
      eventsForTicket.some(
        (event) => event.type === type && (!predicate || predicate(event.payload))
      );

    if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
      const waitingMinutes = computeWaitingMinutes(eventsForTicket, nowIso);
      const elapsedMinutes = toMinutes(now.getTime() - new Date(ticket.createdAt).getTime());
      const effectiveMinutes = Math.max(0, elapsedMinutes - waitingMinutes);
      const targetMinutes = slaTargets[ticket.priority as Priority] || DEFAULT_SLA_MINUTES.MEDIUM;
      const warnAt = targetMinutes * WARNING_THRESHOLD;

      if (effectiveMinutes >= targetMinutes && !hasEvent('SLA_BREACH')) {
        const recipients = uniqueEmails([assigneeEmail, itDeskEmail]);
        if (recipients.length > 0) {
          await sendMailViaGraph({
            to: recipients,
            subject: `[Beacon] ${ticket.ticketNumber} SLA breached`,
            htmlBody: `<p>SLA breached for <strong>${ticket.ticketNumber}</strong> (${ticket.title}).</p>
<p>Elapsed: ${effectiveMinutes} mins • Target: ${targetMinutes} mins</p>`,
            textBody: `SLA breached for ${ticket.ticketNumber} (${ticket.title}).\nElapsed: ${effectiveMinutes} mins • Target: ${targetMinutes} mins`,
          });
        }

        await createTicketEvent(ticket.id, 'SLA_BREACH', actorId, {
          elapsedMinutes: effectiveMinutes,
          targetMinutes,
        });
        breachesSent += 1;
      } else if (
        effectiveMinutes >= warnAt &&
        effectiveMinutes < targetMinutes &&
        !hasEvent('SLA_WARNING')
      ) {
        const recipients = uniqueEmails([assigneeEmail, itDeskEmail]);
        if (recipients.length > 0) {
          await sendMailViaGraph({
            to: recipients,
            subject: `[Beacon] ${ticket.ticketNumber} SLA warning`,
            htmlBody: `<p>SLA is nearing breach for <strong>${ticket.ticketNumber}</strong> (${ticket.title}).</p>
<p>Elapsed: ${effectiveMinutes} mins • Target: ${targetMinutes} mins</p>`,
            textBody: `SLA is nearing breach for ${ticket.ticketNumber} (${ticket.title}).\nElapsed: ${effectiveMinutes} mins • Target: ${targetMinutes} mins`,
          });
        }

        await createTicketEvent(ticket.id, 'SLA_WARNING', actorId, {
          elapsedMinutes: effectiveMinutes,
          targetMinutes,
        });
        warningsSent += 1;
      }
    }

    if (ticket.status === 'RESOLVED' && ticket.resolvedAt) {
      const resolvedAt = new Date(ticket.resolvedAt);
      const resolvedDays = Math.floor((now.getTime() - resolvedAt.getTime()) / (24 * 60 * 60 * 1000));

      for (const day of REMINDER_DAYS) {
        if (resolvedDays >= day && !hasEvent('AUTO_CLOSE_REMINDER', (payload) => payload?.day === day)) {
          if (requesterEmail) {
            await sendMailViaGraph({
              to: [requesterEmail],
              subject: `[Beacon] ${ticket.ticketNumber} pending confirmation`,
              htmlBody: `<p>Your ticket <strong>${ticket.ticketNumber}</strong> was marked resolved.</p>
<p>Please confirm or reopen if you still need help.</p>`,
              textBody: `Your ticket ${ticket.ticketNumber} was marked resolved.\nPlease confirm or reopen if you still need help.`,
            });
          }

          await createTicketEvent(ticket.id, 'AUTO_CLOSE_REMINDER', actorId, {
            day,
          });
          remindersSent += 1;
        }
      }

      if (resolvedDays >= AUTO_CLOSE_DAYS && ticket.status === 'RESOLVED') {
        const { error: updateError } = await supabaseServer
          .from('Ticket')
          .update({
            status: 'CLOSED',
            closedAt: nowIso,
          })
          .eq('id', ticket.id);

        if (!updateError) {
          await createTicketEvent(ticket.id, 'AUTO_CLOSED', actorId, {
            autoClosed: true,
          });

          if (requesterEmail) {
            await sendMailViaGraph({
              to: [requesterEmail],
              subject: `[Beacon] ${ticket.ticketNumber} closed`,
              htmlBody: `<p>Your ticket <strong>${ticket.ticketNumber}</strong> was closed after ${AUTO_CLOSE_DAYS} days.</p>`,
              textBody: `Your ticket ${ticket.ticketNumber} was closed after ${AUTO_CLOSE_DAYS} days.`,
            });
          }

          autoClosed += 1;
        }
      }
    }
  }

  return {
    warningsSent,
    breachesSent,
    remindersSent,
    autoClosed,
    totalTickets: ticketRows.length,
  };
}
