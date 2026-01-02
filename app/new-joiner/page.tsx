'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/button';
import Textarea from '@/components/ui/textarea';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
  createdAt: string;
}

interface PolicySource {
  title?: string;
  section?: string;
  page?: number;
  link?: string | null;
}

interface PolicyAgentResponse {
  answer: string;
  sources?: PolicySource[];
}

const DAY_ONE_QUESTIONS: string[] = [
  'What should I do on my first day?',
  'What should I do before my first day?',
  'What meetings should I expect on day 1?',
];

const ACCESS_IT_QUESTIONS: string[] = [
  'How do I set up my Trianz email and VPN?',
  'How to request laptop or system access?',
  'How do I get access to project tools and portals?',
];

const POLICIES_QUESTIONS: string[] = [
  'What is the probation period for a new joiner?',
  'How many leave days do I get in a year?',
  'What is the return to office policy?',
  'Where can I find all HR policies?',
];

const TRAVEL_EXPENSE_QUESTIONS: string[] = [
  'How to submit expenses in Fusion?',
  'What travel modes are allowed for my grade?',
];

const SECURITY_QUESTIONS: string[] = [
  'What should I do if I receive a suspicious or phishing email?',
  'What are the password rules at Trianz?',
  'How should I classify client or confidential data?',
  'What is the policy on using personal devices (BYOD)?',
];

type Feedback = 'up' | 'down' | null;

export default function NewJoinerBuddyPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<PolicySource[]>([]);
  const [recentQuestions, setRecentQuestions] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [showHrLink, setShowHrLink] = useState(false);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');

  const shouldShowServiceDeskCta = (() => {
    if (!lastUserMessage) return false;
    const q = lastUserMessage.content.toLowerCase();

    const laptopKeywords = ['laptop', 'device', 'machine'];
    const accessKeywords = ['vpn', 'access', 'system access', 'portal access', 'tool access'];
    const itWords = ['email', 'outlook', 'teams', 'vpn', 'gitlab', 'jira', 'confluence', 'cursor'];

    const mentionsLaptop = laptopKeywords.some((w) => q.includes(w));
    const mentionsAccess = accessKeywords.some((w) => q.includes(w));
    const mentionsItSystem = itWords.some((w) => q.includes(w));

    return mentionsLaptop || mentionsAccess || mentionsItSystem;
  })();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('beacon_new_joiner_recent');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentQuestions(parsed.filter((q) => typeof q === 'string').slice(0, 5));
        }
      }
    } catch {
      // ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        'beacon_new_joiner_recent',
        JSON.stringify(recentQuestions.slice(0, 5))
      );
    } catch {
      // ignore localStorage errors
    }
  }, [recentQuestions]);

  const handleAsk = async (questionOverride?: string) => {
    const raw = questionOverride ?? input;
    const trimmed = raw.trim();
    if (!trimmed) {
      setError('Please enter a question.');
      return;
    }

    const now = new Date().toISOString();
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: trimmed, createdAt: now },
    ];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);
    setError(null);
    setFeedback(null);
    setShowHrLink(false);
    setRecentQuestions((prev) => {
      const withoutDup = prev.filter((q) => q !== trimmed);
      return [trimmed, ...withoutDup].slice(0, 5);
    });

    try {
      const res = await fetch('/api/policy-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          mode: 'new_joiner',
        }),
      });
      const data: PolicyAgentResponse & { error?: string } = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to get answer');
      }

      const answerText = data.answer || 'No answer generated.';
      const ts = new Date().toISOString();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: answerText, createdAt: ts },
      ]);
      setSources(data.sources || []);

      if (lastUserMessage) {
        console.log('New Joiner Buddy answer', {
          question: lastUserMessage.content,
          answerPreview: answerText.slice(0, 160),
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get answer');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) {
        handleAsk();
      }
    }
  };

  const handleFeedback = (value: Feedback) => {
    setFeedback(value);
    setShowHrLink(value === 'down');
    if (lastUserMessage && lastAssistantMessage) {
      console.log('New Joiner Buddy feedback', {
        question: lastUserMessage.content,
        answerPreview: lastAssistantMessage.content.slice(0, 160),
        feedback: value,
      });
    }
  };

  const handleResetConversation = () => {
    setMessages([]);
    setFeedback(null);
    setShowHrLink(false);
    setError(null);
    setIsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <Link
          href="/"
          className="inline-flex items-center text-xs font-medium text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Beacon · New Joiner Buddy
          </p>
          <h1 className="text-2xl font-semibold text-gray-900 mt-1">
            Get quick answers for your first weeks at Trianz.
          </h1>
          <p className="text-sm text-gray-600">
            Ask about day-one tasks, IT setup, RTO expectations, travel and expenses. Answers are
            grounded in the same policies powering Ask Beacon and will say when you should contact
            HR, IT or your manager.
          </p>
          <p className="text-xs text-gray-500">
            Use this for: 1) Day 1 and Week 1 questions, 2) basic HR / RTO / leave queries, 3) how
            to request laptop, VPN and submit expenses.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col">
          <div className="mb-4 space-y-3">
            <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">
              Quick questions
            </label>

            <div className="space-y-2">
              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-gray-500">Day 1</span>
                <div className="flex flex-wrap gap-2">
                  {DAY_ONE_QUESTIONS.map((q) => (
                    <Button
                      key={q}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="whitespace-nowrap text-xs"
                      onClick={() => handleAsk(q)}
                      disabled={isLoading}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-gray-500">Access &amp; IT</span>
                <div className="flex flex-wrap gap-2">
                  {ACCESS_IT_QUESTIONS.map((q) => (
                    <Button
                      key={q}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="whitespace-nowrap text-xs"
                      onClick={() => handleAsk(q)}
                      disabled={isLoading}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-gray-500">Policies &amp; leave</span>
                <div className="flex flex-wrap gap-2">
                  {POLICIES_QUESTIONS.map((q) => (
                    <Button
                      key={q}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="whitespace-nowrap text-xs"
                      onClick={() => handleAsk(q)}
                      disabled={isLoading}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-gray-500">Travel &amp; expenses</span>
                <div className="flex flex-wrap gap-2">
                  {TRAVEL_EXPENSE_QUESTIONS.map((q) => (
                    <Button
                      key={q}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="whitespace-nowrap text-xs"
                      onClick={() => handleAsk(q)}
                      disabled={isLoading}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-gray-500">Security &amp; Infosec</span>
                <div className="flex flex-wrap gap-2">
                  {SECURITY_QUESTIONS.map((q) => (
                    <Button
                      key={q}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="whitespace-nowrap text-xs"
                      onClick={() => handleAsk(q)}
                      disabled={isLoading}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {recentQuestions.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[11px] font-medium text-gray-500">Recent</span>
                {recentQuestions.map((q) => (
                  <Button
                    key={q}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="whitespace-nowrap text-xs text-gray-600"
                    onClick={() => handleAsk(q)}
                    disabled={isLoading}
                  >
                    {q.length > 40 ? `${q.slice(0, 37)}...` : q}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {messages.length > 0 && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="text-[11px] text-blue-700 hover:underline"
                onClick={handleResetConversation}
              >
                New conversation
              </button>
            </div>
          )}

          {error && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="chat-scroll flex-1 space-y-4 overflow-y-auto pr-1 rounded-lg bg-gray-50 p-3 max-h-[420px]">
            {messages.length === 0 && (
              <div className="flex justify-start">
                <div className="inline-flex max-w-md flex-col gap-1 rounded-2xl bg-white px-3 py-2 text-sm text-gray-700 shadow-sm">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-blue-600">
                    Buddy
                  </span>
                  <p>
                    Try asking &quot;What should I do on my first day?&quot; or
                    &quot;How do I request a laptop and VPN access?&quot;. You can ask follow-up questions
                    in the same thread.
                  </p>
                </div>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`inline-flex max-w-md flex-col gap-1 rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-900'
                  }`}
                >
                  <span className="text-[11px] font-medium uppercase tracking-wide opacity-70">
                    {msg.role === 'user' ? 'You' : 'Buddy'}
                  </span>
                  <p>{msg.content}</p>
                  {msg.createdAt && (
                    <span className="text-[10px] text-gray-300 self-end">
                      {formatTime(msg.createdAt)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-1 rounded-2xl bg-gray-100 px-3 py-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-500 animate-bounce [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-300 animate-bounce [animation-delay:0.2s]" />
                </div>
              </div>
            )}
          </div>

            {lastAssistantMessage && (
              <div className="mt-3 space-y-2 text-xs text-gray-500">
                <div className="flex items-center justify-end gap-2">
                  <span>Did this answer help?</span>
                  <button
                    type="button"
                    className={`rounded-full border px-2 py-1 transition ${
                      feedback === 'up'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-white hover:border-green-400 hover:text-green-700'
                    }`}
                    onClick={() => handleFeedback('up')}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={`rounded-full border px-2 py-1 transition ${
                      feedback === 'down'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 bg-white hover:border-red-400 hover:text-red-700'
                    }`}
                    onClick={() => handleFeedback('down')}
                  >
                    No
                  </button>
                </div>

                {showHrLink && lastUserMessage && (
                  <div className="flex justify-end">
                    <a
                      href={`mailto:hr@trianz.com?subject=Question%20about%20policy&body=${encodeURIComponent(
                        lastUserMessage.content
                      )}`}
                      className="text-[11px] text-blue-700 hover:underline"
                    >
                      Email HR this question
                    </a>
                  </div>
                )}

                {shouldShowServiceDeskCta && lastUserMessage && (
                  <div className="flex justify-end">
                    <Link
                      href={{
                        pathname: '/service-desk',
                        query: { details: lastUserMessage.content },
                      }}
                      className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-blue-700"
                    >
                      Open Service Desk for this
                    </Link>
                  </div>
                )}
              </div>
            )}

          <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
            <label className="text-sm font-medium text-gray-700">Ask a question</label>
            <Textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., What should I do before my first day?"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Press Enter to send. Shift+Enter for a new line.
              </span>
              <Button size="sm" onClick={() => handleAsk()} disabled={isLoading || !input.trim()}>
                {isLoading ? 'Answering...' : 'Ask'}
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Sources</h2>
          {!lastAssistantMessage && (
            <p className="text-sm text-gray-600">
              After the buddy answers, you&apos;ll see which documents and sections were used here.
            </p>
          )}
          {lastAssistantMessage && sources && sources.length > 0 && (
            <div className="space-y-2">
              {sources
                .filter(
                  (src, index, all) =>
                    all.findIndex((s) => (s.title || '').trim() === (src.title || '').trim()) === index
                )
                .map((src, idx) => (
                  <div key={idx} className="rounded-md border border-gray-200 p-3 text-sm text-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900">
                        {src.title || 'Untitled'}
                        {src.section ? (
                          <span className="ml-1 text-xs font-normal text-gray-500">({src.section})</span>
                        ) : null}
                      </div>
                      <span className="text-xs uppercase tracking-wide text-gray-500">
                        Source {idx + 1}
                      </span>
                    </div>
                    {src.link && (
                      <a
                        className="mt-2 inline-flex text-xs text-blue-700 hover:underline"
                        href={src.link}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open document
                      </a>
                    )}
                  </div>
                ))}
            </div>
          )}
          {lastAssistantMessage && (!sources || sources.length === 0) && (
            <p className="text-sm text-gray-600">
              No specific sources were returned for the last answer.
            </p>
          )}

          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Day 1 checklist (example)</h3>
            <p className="text-xs text-gray-600">
              This is a generic checklist. Exact steps can vary by team and location.
            </p>
            <ul className="text-xs text-gray-700 space-y-1 list-disc pl-4">
              <li>Confirm your reporting manager and work location.</li>
              <li>Complete HR onboarding formalities and document upload.</li>
              <li>Set up corporate email, Teams, and VPN as per IT instructions.</li>
              <li>Review RTO / work-from-home expectations with your manager.</li>
              <li>Check mandatory trainings and due dates (InfoSec, POSH, etc.).</li>
            </ul>

            <h3 className="mt-3 text-sm font-semibold text-gray-900">First-week checklist</h3>
            <ul className="text-xs text-gray-700 space-y-1 list-disc pl-4">
              <li>Understand your role, project, and key deliverables for the first 30–90 days.</li>
              <li>Clarify working hours, leave application process, and escalation paths.</li>
              <li>Meet your immediate team and key stakeholders.</li>
              <li>Bookmark key systems: HR portal, timesheet, expense tool, travel desk.</li>
              <li>Note important email IDs (HR, IT helpdesk, Travel Desk, InfoSec).</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-[11px] text-gray-500">
        New Joiner Buddy is intended to guide associates through their first weeks at Trianz. Answers
        come from internal policies and onboarding material and are kept conservative; for anything
        unclear or personal (payroll, contracts, performance), please confirm with your manager or HR
        at hr@trianz.com. Built for Trianz · Content last updated Dec 2025.
      </div>
    </div>
  );
}
