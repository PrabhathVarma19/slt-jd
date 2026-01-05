import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

export async function POST(req: NextRequest) {
  if (!openai) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not configured for classification.' },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const details = (body?.details || '').toString().trim();

    if (!details) {
      return NextResponse.json(
        { error: 'Missing details for classification.' },
        { status: 400 }
      );
    }

    // First, try a very fast keyword-based classification for common requests.
    const lower = details.toLowerCase();

    type QuickResult = {
      requestType: string;
      system: string;
      impact: string;
      reason: string;
    };

    const quickRules: Array<{ keywords: string[]; requestType: string; system: string }> = [
      // Subscriptions / licenses – handle these first so "X subscription" lands in Subscription
      { keywords: ['license', 'licence', 'subscription'], requestType: 'subscription', system: 'Subscription' },
      // Access to named systems
      { keywords: ['vpn'], requestType: 'access', system: 'VPN' },
      { keywords: ['cursor'], requestType: 'access', system: 'Cursor' },
      { keywords: ['gitlab'], requestType: 'access', system: 'GitLab' },
      { keywords: ['jira'], requestType: 'access', system: 'Jira' },
      { keywords: ['confluence'], requestType: 'access', system: 'Confluence' },
      { keywords: ['erp'], requestType: 'access', system: 'ERP' },
      { keywords: ['outlook', 'email'], requestType: 'access', system: 'Email' },
      { keywords: ['teams'], requestType: 'access', system: 'Teams' },
      // Hardware / devices
      { keywords: ['laptop', 'notebook'], requestType: 'hardware', system: 'Laptop' },
      { keywords: ['desktop'], requestType: 'hardware', system: 'Desktop' },
      { keywords: ['monitor', 'screen'], requestType: 'hardware', system: 'Monitor' },
      { keywords: ['docking station', 'dock'], requestType: 'hardware', system: 'Dock' },
      { keywords: ['keyboard', 'mouse', 'headset'], requestType: 'hardware', system: 'Peripherals' },
      // Software / installs
      { keywords: ['install', 'installation'], requestType: 'software', system: 'Software' },
      // Password / account
      { keywords: ['reset password', 'forgot password', 'password reset'], requestType: 'password', system: 'Account' },
    ];

    const pickQuickRule = (): QuickResult | null => {
      for (const rule of quickRules) {
        if (rule.keywords.some((k) => lower.includes(k))) {
          // Very lightweight impact heuristic
          let impact: 'blocker' | 'high' | 'medium' | 'low' = 'medium';
          if (
            lower.includes('cannot work') ||
            lower.includes("can't work") ||
            lower.includes('blocked') ||
            lower.includes('prod down') ||
            lower.includes('production down')
          ) {
            impact = 'blocker';
          } else if (
            lower.includes('urgent') ||
            lower.includes('asap') ||
            lower.includes('immediately') ||
            lower.includes('today')
          ) {
            impact = 'high';
          }

          // Reason: short summary using first sentence / 140 chars
          const firstSentenceMatch = details.split(/[\r\n\.]/)[0]?.trim() || details;
          const reason =
            firstSentenceMatch.length > 140
              ? `${firstSentenceMatch.slice(0, 137)}...`
              : firstSentenceMatch;

          return {
            requestType: rule.requestType,
            system: rule.system,
            impact,
            reason,
          };
        }
      }
      return null;
    };

    const quick = pickQuickRule();
    if (quick) {
      return NextResponse.json({
        requestType: quick.requestType,
        system: quick.system,
        environment: 'NA',
        accessType: 'Standard user',
        impact: quick.impact,
        reason: quick.reason,
      });
    }

    const prompt = `You are an internal IT service-desk assistant.
Given the free-text description of an IT request below, classify it and propose structured fields.

Return a JSON object with these keys:
- request_type: one of "access", "hardware", "software", "subscription", "password", "other"
- system: short system or application name (e.g. "VPN", "GitLab", "ERP").
  If the description clearly mentions a tool or product name (for example "Cursor", "Jira", "Salesforce"),
  return that exact name even if you do not recognise it. Use "General" only if there is no specific tool mentioned.
- environment: one of "Prod", "UAT", "Dev", "NA" (if not applicable)
- access_level: short label such as "View only", "Standard user", "Admin" (or "NA" if not relevant)
- impact: one of "blocker", "high", "medium", "low"
- reason: one sentence reason or use case summarising why this is needed.

Description:
${details}

Respond with JSON only, no explanation.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You classify IT service requests into structured fields and respond with JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'No classification returned from model.' },
        { status: 502 }
      );
    }

    const jsonText = content.trim().replace(/^```json\s*/i, '').replace(/```$/i, '');
    const parsed = JSON.parse(jsonText);

    return NextResponse.json({
      requestType: parsed.request_type || null,
      system: parsed.system || null,
      environment: parsed.environment || null,
      accessType: parsed.access_level || null,
      impact: parsed.impact || null,
      reason: parsed.reason || null,
    });
  } catch (error: any) {
    console.error('IT classification error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to classify IT request' },
      { status: 500 }
    );
  }
}
