import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { supabaseServer } from '@/lib/supabase/server';
import OpenAI from 'openai';

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ExtractedData {
  requestType?: string;
  system?: string;
  impact?: string;
  reason?: string;
  projectCode?: string;
  ticketNumber?: string;
  details?: string;
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

    if (!openai) {
      return NextResponse.json(
        { error: 'AI service is not configured' },
        { status: 500 }
      );
    }

    const lowerMessage = message.toLowerCase().trim();

    // Detect self-service intents
    if (lowerMessage.includes('reset') && (lowerMessage.includes('password') || lowerMessage.includes('pwd'))) {
      return NextResponse.json({
        message: 'I can help you reset your password. I\'ll send a password reset email to your registered email address. Would you like me to proceed?',
        actionType: 'password_reset',
        actionData: { requiresConfirmation: true },
        requiresConfirmation: true,
      });
    }

    const isAccountLocked =
      lowerMessage.includes('account') && (lowerMessage.includes('locked') || lowerMessage.includes('lock'));
    if (isAccountLocked) {
      return NextResponse.json({
        message: 'It looks like your account is locked. I can start a password reset. Would you like me to proceed?',
        actionType: 'password_reset',
        actionData: { requiresConfirmation: true },
        requiresConfirmation: true,
      });
    }

    // Detect ticket status check
    const ticketMatch = message.match(/(?:ticket|IT-|TR-)\s*([A-Z]{2}-\d{6})/i);
    if (ticketMatch) {
      const ticketNumber = ticketMatch[1].toUpperCase();
      return NextResponse.json({
        message: `I'll check the status of ticket ${ticketNumber} for you.`,
        actionType: 'ticket_status',
        actionData: { ticketNumber },
        requiresConfirmation: true,
      });
    }
    const wantsTicketStatus =
      lowerMessage.includes('ticket status') ||
      lowerMessage.includes('status of ticket') ||
      (lowerMessage.includes('status') && lowerMessage.includes('ticket'));
    if (wantsTicketStatus) {
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

      return NextResponse.json({
        message: 'Sure. What is the ticket number? (e.g., IT-000123)',
        actionType: null,
      });
    }

    // Detect knowledge base search intent
    if (lowerMessage.includes('how') || lowerMessage.includes('what') || lowerMessage.includes('search')) {
      return NextResponse.json({
        message: 'I can search the Knowledge Base for that. Do you want me to run a search?',
        actionType: 'kb_search',
        actionData: { query: message },
        requiresConfirmation: true,
      });
    }

    // For IT requests, use AI to extract entities
    const conversationHistory: ChatMessage[] = [
      ...history.slice(-10), // Last 10 messages for context
      { role: 'user', content: message },
    ];

    const systemPrompt = `You are Beacon, an IT Service Desk assistant for Trianz. Your role is to:
1. Help users submit IT requests through conversation
2. Extract structured information from their requests
3. Ask clarifying questions if information is missing
4. Be friendly, helpful, and concise

When a user describes an IT request, extract:
- request_type: one of "access", "hardware", "software", "subscription", "password", "other"
- system: the system/tool name (e.g., "VPN", "GitLab", "Laptop")
- impact: one of "blocker", "high", "medium", "low"
- reason: brief reason for the request

Respond naturally and conversationally. If information is missing, ask one clarifying question at a time.
Return a JSON object with keys: response, request_type, system, impact, reason.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 500 }
      );
    }

    try {
      const parsed = JSON.parse(content);
      const extractedData: ExtractedData = {
        requestType: parsed.request_type,
        system: parsed.system,
        impact: parsed.impact,
        reason: parsed.reason,
        details: message,
      };

      // Determine if we have enough info or need more
      const hasEnoughInfo = extractedData.requestType && extractedData.system && extractedData.reason;
      
      let responseMessage = parsed.response || parsed.message || 'I understand.';
      
      if (!hasEnoughInfo) {
        // Ask clarifying questions
        if (!extractedData.requestType) {
          responseMessage = 'What type of request is this? (e.g., access, hardware, software)';
        } else if (!extractedData.system) {
          responseMessage = 'Which system or tool do you need? (e.g., VPN, GitLab, Laptop)';
        } else if (!extractedData.reason) {
          responseMessage = 'What\'s the reason you need this?';
        }
      } else {
        // We have enough info, offer to create request
        responseMessage = `Got it! I'll create a request for:
- Type: ${extractedData.requestType}
- System: ${extractedData.system}
- Impact: ${extractedData.impact || 'medium'}
- Reason: ${extractedData.reason}

Would you like me to submit this request?`;
      }

      return NextResponse.json({
        message: responseMessage,
        actionType: hasEnoughInfo ? 'create_request' : null,
        extractedData: hasEnoughInfo ? extractedData : undefined,
        actionData: hasEnoughInfo ? extractedData : undefined,
        requiresConfirmation: hasEnoughInfo,
      });
    } catch (parseError) {
      // If JSON parsing fails, treat as plain text response
      return NextResponse.json({
        message: content,
        actionType: null,
      });
    }
  } catch (error: any) {
    console.error('Service Desk chat error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process message' },
      { status: 500 }
    );
  }
}

