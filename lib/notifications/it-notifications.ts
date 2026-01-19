import { supabaseServer } from '@/lib/supabase/server';
import { sendMailViaGraph } from '@/lib/graph';
import { logNotificationFailure } from '@/lib/notifications/notification-failures';

export type ItNotificationEvent =
  | 'ticket_created'
  | 'ticket_assigned'
  | 'ticket_status_changed'
  | 'ticket_priority_changed'
  | 'ticket_note_added'
  | 'ticket_reopened';

export type ItNotificationPayload = {
  oldStatus?: string;
  newStatus?: string;
  oldPriority?: string;
  newPriority?: string;
  note?: string;
  fromRequester?: boolean;
};

type NotificationContext = {
  ticketId: string;
  actorId: string;
  event: ItNotificationEvent;
  payload?: ItNotificationPayload;
};

const getProfile = (value: any) => (Array.isArray(value) ? value[0] : value);

const displayName = (profile: any, email?: string) =>
  profile?.empName || email?.split('@')[0] || 'User';

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

export async function sendItNotification({
  ticketId,
  actorId,
  event,
  payload,
}: NotificationContext): Promise<void> {
  try {
    const { data: ticket, error } = await supabaseServer
      .from('Ticket')
      .select(
        `
        id,
        ticketNumber,
        title,
        status,
        priority,
        domain,
        requester:User!Ticket_requesterId_fkey (
          id,
          email,
          profile:UserProfile (empName)
        ),
        assignments:TicketAssignment!TicketAssignment_ticketId_fkey (
          id,
          engineerId,
          unassignedAt,
          engineer:User!TicketAssignment_engineerId_fkey (
            id,
            email,
            profile:UserProfile (empName)
          )
        )
      `
      )
      .eq('id', ticketId)
      .maybeSingle();

    if (error || !ticket || ticket.domain !== 'IT') {
      return;
    }

    const requester = Array.isArray(ticket.requester) ? ticket.requester[0] : ticket.requester;
    const requesterProfile = getProfile(requester?.profile);
    const requesterEmail = requester?.email || '';
    const requesterName = displayName(requesterProfile, requesterEmail);

    const assignments = Array.isArray(ticket.assignments) ? ticket.assignments : [];
    const activeAssignment = assignments.find((row) => row?.unassignedAt == null);
    const engineer = activeAssignment?.engineer
      ? Array.isArray(activeAssignment.engineer)
        ? activeAssignment.engineer[0]
        : activeAssignment.engineer
      : null;
    const engineerProfile = getProfile(engineer?.profile);
    const assigneeEmail = engineer?.email || '';
    const assigneeName = displayName(engineerProfile, assigneeEmail);

    const { data: actor } = await supabaseServer
      .from('User')
      .select(
        `
        email,
        profile:UserProfile (empName)
      `
      )
      .eq('id', actorId)
      .maybeSingle();

    const actorProfile = getProfile(actor?.profile);
    const actorEmail = actor?.email || '';
    const actorName = displayName(actorProfile, actorEmail);

    const ticketNumber = ticket.ticketNumber || 'IT ticket';
    const ticketTitle = ticket.title || 'IT request';
    const itDeskEmail = process.env.IT_SERVICEDESK_EMAIL || '';

    let to: string[] = [];
    let subject = `[Beacon] ${ticketNumber} update`;
    let htmlBody = '';
    let textBody = '';

    switch (event) {
      case 'ticket_created': {
        to = uniqueEmails([itDeskEmail, requesterEmail]);
        subject = `[Beacon] ${ticketNumber} created`;
        htmlBody = `<p>A new IT request has been created.</p>
<p><strong>${ticketNumber}</strong> - ${ticketTitle}</p>
<p>Requester: ${requesterName} (${requesterEmail})</p>`;
        textBody = `A new IT request has been created.\n${ticketNumber} - ${ticketTitle}\nRequester: ${requesterName} (${requesterEmail})`;
        break;
      }
      case 'ticket_assigned': {
        to = uniqueEmails([assigneeEmail]);
        subject = `[Beacon] ${ticketNumber} assigned to you`;
        htmlBody = `<p>You have been assigned a new IT ticket.</p>
<p><strong>${ticketNumber}</strong> - ${ticketTitle}</p>
<p>Requester: ${requesterName} (${requesterEmail})</p>`;
        textBody = `You have been assigned a new IT ticket.\n${ticketNumber} - ${ticketTitle}\nRequester: ${requesterName} (${requesterEmail})`;
        break;
      }
      case 'ticket_status_changed': {
        const newStatus = payload?.newStatus || ticket.status || 'updated';
        to = uniqueEmails([requesterEmail, assigneeEmail]);
        subject = `[Beacon] ${ticketNumber} status ${newStatus}`;
        htmlBody = `<p>Status update from ${actorName}.</p>
<p><strong>${ticketNumber}</strong> - ${ticketTitle}</p>
<p>New status: <strong>${newStatus}</strong></p>`;
        textBody = `Status update from ${actorName}.\n${ticketNumber} - ${ticketTitle}\nNew status: ${newStatus}`;
        break;
      }
      case 'ticket_priority_changed': {
        const newPriority = payload?.newPriority || ticket.priority || 'updated';
        to = uniqueEmails([assigneeEmail, itDeskEmail]);
        subject = `[Beacon] ${ticketNumber} priority ${newPriority}`;
        htmlBody = `<p>Priority updated by ${actorName}.</p>
<p><strong>${ticketNumber}</strong> - ${ticketTitle}</p>
<p>New priority: <strong>${newPriority}</strong></p>`;
        textBody = `Priority updated by ${actorName}.\n${ticketNumber} - ${ticketTitle}\nNew priority: ${newPriority}`;
        break;
      }
      case 'ticket_note_added': {
        const note = payload?.note || '';
        const isRequester = payload?.fromRequester === true;
        to = uniqueEmails([isRequester ? assigneeEmail : requesterEmail]);
        subject = `[Beacon] ${ticketNumber} new note`;
        htmlBody = `<p>${actorName} added a note.</p>
<p><strong>${ticketNumber}</strong> - ${ticketTitle}</p>
<p>${note ? `<strong>Note:</strong> ${note}` : ''}</p>`;
        textBody = `${actorName} added a note.\n${ticketNumber} - ${ticketTitle}\n${note ? `Note: ${note}` : ''}`;
        break;
      }
      case 'ticket_reopened': {
        to = uniqueEmails([assigneeEmail, itDeskEmail]);
        subject = `[Beacon] ${ticketNumber} reopened`;
        htmlBody = `<p>${actorName} reopened this ticket.</p>
<p><strong>${ticketNumber}</strong> - ${ticketTitle}</p>`;
        textBody = `${actorName} reopened this ticket.\n${ticketNumber} - ${ticketTitle}`;
        break;
      }
      default:
        return;
    }

    if (to.length === 0) {
      return;
    }

    try {
      await sendMailViaGraph({
        to,
        subject,
        htmlBody,
        textBody,
      });
    } catch (error: any) {
      await logNotificationFailure({
        channel: 'EMAIL',
        domain: 'IT',
        event,
        ticketId,
        actorId,
        recipients: to,
        subject,
        htmlBody,
        textBody,
        errorMessage: error?.message || 'Failed to send email',
        metadata: {
          payload,
          requesterEmail,
          assigneeEmail,
        },
      });
      throw error;
    }
  } catch (error) {
    console.error('IT notification failed:', error);
  }
}

