import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [approvalsResult, ticketsResult] = await Promise.all([
      supabaseServer
        .from('TicketApproval')
        .select('id', { count: 'exact', head: true })
        .eq('approverEmail', session.email)
        .eq('state', 'PENDING'),
      supabaseServer
        .from('Ticket')
        .select('id,ticketNumber,status,title,createdAt', { count: 'exact' })
        .eq('requesterId', session.userId)
        .in('status', ['OPEN', 'IN_PROGRESS'])
        .order('createdAt', { ascending: false })
        .limit(5),
    ]);

    if (approvalsResult.error) {
      throw new Error(approvalsResult.error.message);
    }
    if (ticketsResult.error) {
      throw new Error(ticketsResult.error.message);
    }

    const activeTickets = (ticketsResult.data || []).map((ticket: any) => ({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      title: ticket.title,
      createdAt: ticket.createdAt,
    }));

    return NextResponse.json({
      pendingApprovals: approvalsResult.count || 0,
      activeTickets,
    });
  } catch (error: any) {
    console.error('Notifications count API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
