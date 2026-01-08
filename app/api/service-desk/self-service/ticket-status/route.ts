import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(req.url);
    const ticketNumber = searchParams.get('ticketNumber');

    if (!ticketNumber) {
      return NextResponse.json(
        { error: 'Ticket number is required' },
        { status: 400 }
      );
    }

    // Fetch ticket from database
    const { data: ticket, error } = await supabaseServer
      .from('Ticket')
      .select(`
        *,
        requester:User!Ticket_requesterId_fkey (
          id,
          email
        )
      `)
      .eq('ticketNumber', ticketNumber.toUpperCase())
      .single();

    if (error || !ticket) {
      return NextResponse.json({
        message: `Ticket ${ticketNumber} not found. Please check the ticket number and try again.`,
        found: false,
      });
    }

    // Check if user has permission to view this ticket
    const requester = Array.isArray(ticket.requester) ? ticket.requester[0] : ticket.requester;
    const isRequester = requester?.email === auth.email;
    
    // Check if user is admin or assigned engineer
    const isAdmin = auth.roles?.some((r: string) => 
      ['ADMIN_IT', 'ADMIN_TRAVEL', 'SUPER_ADMIN'].includes(r)
    );

    if (!isRequester && !isAdmin) {
      return NextResponse.json({
        message: 'You don\'t have permission to view this ticket.',
        found: false,
      });
    }

    const statusMessages: Record<string, string> = {
      OPEN: 'Your ticket is open and waiting to be assigned to an engineer.',
      IN_PROGRESS: 'An engineer is actively working on your ticket.',
      WAITING_ON_REQUESTER: 'The engineer needs more information from you. Please check for updates.',
      RESOLVED: 'Your ticket has been resolved. Please verify if everything is working.',
      CLOSED: 'This ticket has been closed.',
      PENDING_APPROVAL: 'Your request is pending approval.',
    };

    return NextResponse.json({
      message: `Ticket ${ticketNumber} Status: ${ticket.status.replace(/_/g, ' ')}. ${statusMessages[ticket.status] || ''}`,
      found: true,
      ticket: {
        number: ticket.ticketNumber,
        status: ticket.status,
        title: ticket.title,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Ticket status check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check ticket status' },
      { status: 500 }
    );
  }
}

