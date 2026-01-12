import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { supabaseServer } from '@/lib/supabase/server';
import { runServiceDeskAgent } from '@/lib/ai/agents/service-desk-agent';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const body = await req.json();
    const { message, history = [], confirmAction } = body;

    if (confirmAction) {
      const origin = new URL(req.url).origin;
      const cookie = req.headers.get('cookie') || '';
      const actionType = confirmAction?.type as string | undefined;
      const actionData = confirmAction?.data || {};

      if (!actionType) {
        return NextResponse.json({ error: 'Missing confirmation action type' }, { status: 400 });
      }

      if (actionType === 'password_reset') {
        const res = await fetch(`${origin}/api/service-desk/self-service/password-reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          return NextResponse.json({ error: data.error || 'Failed to reset password' }, { status: 500 });
        }
        return NextResponse.json({ message: data.message || 'Password reset email sent.' });
      }

      if (actionType === 'ticket_status') {
        const ticketNumber = actionData.ticketNumber;
        if (!ticketNumber) {
          return NextResponse.json({ error: 'Ticket number is required' }, { status: 400 });
        }
        const res = await fetch(
          `${origin}/api/service-desk/self-service/ticket-status?ticketNumber=${encodeURIComponent(ticketNumber)}`,
          { headers: { cookie } }
        );
        const data = await res.json();
        if (!res.ok || data.error) {
          return NextResponse.json({ error: data.error || 'Failed to check ticket status' }, { status: 500 });
        }
        return NextResponse.json({ message: data.message || 'Ticket status retrieved.' });
      }

      if (actionType === 'kb_search') {
        const query = actionData.query;
        if (!query) {
          return NextResponse.json({ error: 'Query is required' }, { status: 400 });
        }
        const res = await fetch(`${origin}/api/service-desk/kb/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify({ query }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          return NextResponse.json({ error: data.error || 'Failed to search knowledge base' }, { status: 500 });
        }
        const resultLines = (data.results || []).map((result: any) => {
          const section = result.section ? ` - ${result.section}` : '';
          return `- ${result.title}${section}\n${result.snippet}`;
        });
        const content = [data.message, ...resultLines].filter(Boolean).join('\n\n');
        return NextResponse.json({ message: content || 'No results found.' });
      }

      if (actionType === 'create_request') {
        const { data: profileData } = await supabaseServer
          .from('UserProfile')
          .select(
            'empName, employeeId, gradeCode, location, projectCode, projectName, supervisorEmail'
          )
          .eq('userId', auth.userId)
          .maybeSingle();

        if (!profileData?.employeeId) {
          return NextResponse.json(
            { error: 'Employee profile is missing. Please contact IT support.' },
            { status: 400 }
          );
        }

        const payload = {
          name: profileData.empName || auth.email,
          employeeId: profileData.employeeId,
          email: auth.email,
          grade: profileData.gradeCode || '',
          location: profileData.location || '',
          requestType: actionData.requestType || 'other',
          system: actionData.system || 'General',
          impact: actionData.impact || 'medium',
          reason: actionData.reason || 'Not specified',
          details: actionData.details || 'No additional details provided.',
          projectCode: profileData.projectCode || '',
          projectName: profileData.projectName || '',
          managerEmail: profileData.supervisorEmail || '',
        };

        const res = await fetch(`${origin}/api/service-desk/it`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          return NextResponse.json({ error: data.error || 'Failed to submit request' }, { status: 500 });
        }
        return NextResponse.json({ message: data.message || 'Request submitted successfully.' });
      }

      return NextResponse.json({ error: 'Unsupported confirmation action' }, { status: 400 });
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const lowerMessage = message.toLowerCase().trim();
    const ticketMatch = message.match(/(?:ticket|IT-|TR-)\s*([A-Z]{2}-\d{6})/i);
    const wantsTicketStatus =
      lowerMessage.includes('ticket status') ||
      lowerMessage.includes('status of ticket') ||
      (lowerMessage.includes('status') && lowerMessage.includes('ticket'));

    if (wantsTicketStatus && !ticketMatch) {
      const { data: recentTickets, error: recentError } = await supabaseServer
        .from('Ticket')
        .select('ticketNumber, title, status, createdAt')
        .eq('requesterId', auth.userId)
        .order('createdAt', { ascending: false })
        .limit(5);

      if (recentError) {
        console.error('Failed to load recent tickets:', recentError);
      }

      if (recentTickets && recentTickets.length > 0) {
        const lines = recentTickets.map((ticket: any) => {
          const title = ticket.title ? ` - ${ticket.title}` : '';
          return `${ticket.ticketNumber} (${ticket.status})${title}`;
        });
        return NextResponse.json({
          message:
            `Here are your recent tickets:\n` +
            `${lines.map((line) => `- ${line}`).join('\n')}\n\n` +
            'Which ticket should I check? Please reply with the ticket number.',
          actionType: null,
        });
      }
    }

    const decision = await runServiceDeskAgent(message, history as ChatMessage[]);
    const actionType = decision.actionType === 'none' ? null : decision.actionType;
    const actionData = decision.actionData || undefined;

    return NextResponse.json({
      message: decision.response,
      actionType,
      actionData,
      requiresConfirmation: decision.requiresConfirmation,
    });
  } catch (error: any) {
    console.error('Service Desk chat error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process message' },
      { status: 500 }
    );
  }
}

