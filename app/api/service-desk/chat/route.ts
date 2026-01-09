import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
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
    await requireAuth();
    const body = await req.json();
    const { message, history = [] } = body;

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

    if (lowerMessage.includes('unlock') && (lowerMessage.includes('account') || lowerMessage.includes('locked'))) {
      return NextResponse.json({
        message: 'I can help unlock your account. Please confirm your email address and I\'ll unlock it for you.',
        actionType: 'account_unlock',
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

