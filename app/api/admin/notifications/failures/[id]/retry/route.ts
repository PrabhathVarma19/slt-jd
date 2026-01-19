import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';
import { sendMailViaGraph } from '@/lib/graph';
import {
  markNotificationSuccess,
  updateNotificationFailure,
} from '@/lib/notifications/notification-failures';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSessionRole(['ADMIN_IT', 'SUPER_ADMIN']);
    const { id } = params;

    const { data, error } = await supabaseServer
      .from('NotificationFailure')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
    }

    const recipients: string[] = Array.isArray(data.recipients)
      ? data.recipients
      : [];

    if (recipients.length === 0 || !data.subject) {
      return NextResponse.json({ error: 'Notification payload missing.' }, { status: 400 });
    }

    const attempts = (data.attempts || 0) + 1;

    try {
      await sendMailViaGraph({
        to: recipients,
        subject: data.subject,
        htmlBody: data.htmlBody || '',
        textBody: data.textBody || '',
      });
      await markNotificationSuccess(id, attempts);
      return NextResponse.json({ status: 'sent', attempts });
    } catch (sendError: any) {
      const message = sendError?.message || 'Retry failed';
      await updateNotificationFailure(id, attempts, message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to retry notification' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}
