import { supabaseServer } from '@/lib/supabase/server';

export type NotificationFailureEntry = {
  channel: 'EMAIL';
  domain: 'IT' | 'TRAVEL' | 'GENERAL';
  event: string;
  ticketId?: string;
  actorId?: string;
  recipients: string[];
  subject: string;
  htmlBody: string;
  textBody: string;
  errorMessage: string;
  metadata?: Record<string, any> | null;
};

export async function logNotificationFailure(entry: NotificationFailureEntry) {
  try {
    await supabaseServer.from('NotificationFailure').insert({
      channel: entry.channel,
      domain: entry.domain,
      event: entry.event,
      ticketId: entry.ticketId,
      actorId: entry.actorId,
      recipients: entry.recipients,
      subject: entry.subject,
      htmlBody: entry.htmlBody,
      textBody: entry.textBody,
      errorMessage: entry.errorMessage,
      metadata: entry.metadata ?? {},
      status: 'FAILED',
      attempts: 1,
      lastAttemptAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log notification failure:', error);
  }
}

export async function markNotificationSuccess(id: string, attempts: number) {
  try {
    await supabaseServer
      .from('NotificationFailure')
      .update({
        status: 'SENT',
        attempts,
        lastAttemptAt: new Date().toISOString(),
        errorMessage: null,
      })
      .eq('id', id);
  } catch (error) {
    console.error('Failed to update notification status:', error);
  }
}

export async function updateNotificationFailure(id: string, attempts: number, errorMessage: string) {
  try {
    await supabaseServer
      .from('NotificationFailure')
      .update({
        status: 'FAILED',
        attempts,
        lastAttemptAt: new Date().toISOString(),
        errorMessage,
      })
      .eq('id', id);
  } catch (error) {
    console.error('Failed to update notification failure:', error);
  }
}
