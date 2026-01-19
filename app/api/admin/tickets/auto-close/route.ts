import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';
import { createTicketEvent } from '@/lib/tickets/ticket-utils';

const AUTO_CLOSE_DAYS = 7;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireSessionRole(['ADMIN_IT', 'SUPER_ADMIN']);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - AUTO_CLOSE_DAYS);

    const { data: tickets, error } = await supabaseServer
      .from('Ticket')
      .select('id, status, resolvedAt')
      .eq('domain', 'IT')
      .eq('status', 'RESOLVED')
      .lte('resolvedAt', cutoff.toISOString());

    if (error) {
      throw new Error(error.message);
    }

    const ticketsToClose = tickets || [];
    let closedCount = 0;

    for (const ticket of ticketsToClose) {
      const { error: updateError } = await supabaseServer
        .from('Ticket')
        .update({
          status: 'CLOSED',
          closedAt: new Date().toISOString(),
        })
        .eq('id', ticket.id);

      if (updateError) {
        console.error('Auto-close update failed:', updateError.message);
        continue;
      }

      await createTicketEvent(ticket.id, 'STATUS_CHANGED', auth.userId, {
        oldStatus: 'RESOLVED',
        newStatus: 'CLOSED',
        autoClosed: true,
      });

      closedCount += 1;
    }

    return NextResponse.json({
      success: true,
      closedCount,
      autoCloseDays: AUTO_CLOSE_DAYS,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to auto-close tickets' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}
