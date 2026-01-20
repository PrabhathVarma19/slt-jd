import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { supabaseServer } from '@/lib/supabase/server';
import { runServiceDeskAgent } from '@/lib/ai/agents/service-desk-agent';
import { getAgentHistory, storeAgentMessages } from '@/lib/ai/agent-memory';
import { createAgentLog } from '@/lib/ai/agent-logs';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const normalizeTicketNumber = (input?: string | null) => {
  if (!input) return null;
  const trimmed = input.trim().toUpperCase();
  const fullMatch = trimmed.match(/^[A-Z]{2}-\d{6}$/);
  if (fullMatch) return trimmed;

  const prefixMatch = trimmed.match(/^(IT|TR)[-_ ]?(\d{1,6})$/);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    const digits = prefixMatch[2].padStart(6, '0');
    return `${prefix}-${digits}`;
  }

  const digitMatch = trimmed.match(/(\d{1,6})/);
  if (digitMatch) {
    return `IT-${digitMatch[1].padStart(6, '0')}`;
  }

  return null;
};

const buildRecentTicketsReply = (recentTickets: any[]) => {
  if (!recentTickets || recentTickets.length === 0) return null;
  const lines = recentTickets.map((ticket: any) => {
    const title = ticket.title ? ` - ${ticket.title}` : '';
    return `${ticket.ticketNumber} (${ticket.status})${title}`;
  });
  return (
    `Here are your recent tickets:\n` +
    `${lines.map((line) => `- ${line}`).join('\n')}\n\n` +
    'Which ticket should I check? Please reply with the ticket number.'
  );
};

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
        const responseMessage = data.message || 'Password reset email sent.';
        await storeAgentMessages(auth.userId, 'service-desk', [
          { role: 'assistant', content: responseMessage },
        ]);
        await createAgentLog({
          userId: auth.userId,
          agent: 'service-desk',
          input: 'confirm:password_reset',
          intent: 'password_reset',
          tool: 'password_reset',
          response: responseMessage,
          success: true,
          actorRoles: auth.roles,
        });
        return NextResponse.json({ message: responseMessage });
      }

      if (actionType === 'ticket_status') {
        const ticketNumber = normalizeTicketNumber(actionData.ticketNumber);
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
        const responseMessage = data.message || 'Ticket status retrieved.';
        await storeAgentMessages(auth.userId, 'service-desk', [
          { role: 'assistant', content: responseMessage },
        ]);
        await createAgentLog({
          userId: auth.userId,
          agent: 'service-desk',
          input: `confirm:ticket_status:${ticketNumber}`,
          intent: 'ticket_status',
          tool: 'check_ticket_status',
          toolInput: { ticketNumber },
          response: responseMessage,
          success: true,
          actorRoles: auth.roles,
        });
        return NextResponse.json({ message: responseMessage });
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
        const responseMessage = content || 'No results found.';
        await storeAgentMessages(auth.userId, 'service-desk', [
          { role: 'assistant', content: responseMessage },
        ]);
        await createAgentLog({
          userId: auth.userId,
          agent: 'service-desk',
          input: `confirm:kb_search:${query}`,
          intent: 'kb_search',
          tool: 'kb_search',
          toolInput: { query },
          response: responseMessage,
          success: true,
          actorRoles: auth.roles,
        });
        return NextResponse.json({ message: responseMessage });
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
          durationType: actionData.durationType || actionData.duration || '',
          durationUntil: actionData.durationUntil || '',
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
        const responseMessage = data.message || 'Request submitted successfully.';
        await storeAgentMessages(auth.userId, 'service-desk', [
          { role: 'assistant', content: responseMessage },
        ]);
        await createAgentLog({
          userId: auth.userId,
          agent: 'service-desk',
          input: 'confirm:create_request',
          intent: 'create_request',
          tool: 'create_ticket',
          toolInput: actionData,
          response: responseMessage,
          success: true,
          actorRoles: auth.roles,
        });
        return NextResponse.json({ message: responseMessage });
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

      const recentReply = buildRecentTicketsReply(recentTickets || []);
      if (recentReply) {
        return NextResponse.json({
          message: recentReply,
          actionType: null,
        });
      }
    }

    const storedHistory = await getAgentHistory(auth.userId, 'service-desk');
    const effectiveHistory = storedHistory.length > 0 ? storedHistory : (history as ChatMessage[]);

    const decision = await runServiceDeskAgent(message, effectiveHistory as ChatMessage[]);
    const actionType = decision.actionType === 'none' ? null : decision.actionType;
    const actionData = decision.actionData || undefined;

    await createAgentLog({
      userId: auth.userId,
      agent: 'service-desk',
      input: message,
      intent: decision.actionType || 'none',
      tool: actionType || 'none',
      toolInput: actionData,
      response: decision.response,
      success: true,
      actorRoles: auth.roles,
    });

    if (actionType === 'ticket_status' && !actionData?.ticketNumber) {
      const { data: recentTickets } = await supabaseServer
        .from('Ticket')
        .select('ticketNumber, title, status, createdAt')
        .eq('requesterId', auth.userId)
        .order('createdAt', { ascending: false })
        .limit(5);
      const recentReply = buildRecentTicketsReply(recentTickets || []);
      if (recentReply) {
        await createAgentLog({
          userId: auth.userId,
          agent: 'service-desk',
          input: message,
          intent: 'ticket_status',
          tool: 'none',
          response: recentReply,
          success: true,
          actorRoles: auth.roles,
        });

        return NextResponse.json({
          message: recentReply,
          actionType: null,
        });
      }
    }

    await storeAgentMessages(auth.userId, 'service-desk', [
      { role: 'user', content: message },
      { role: 'assistant', content: decision.response },
    ]);

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

