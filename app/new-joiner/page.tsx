'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/button';
import Textarea from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BackToHome } from '@/components/ui/back-to-home';
import { ErrorBar } from '@/components/ui/error-bar';
import { Spinner } from '@/components/ui/spinner';

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
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasUnread, setHasUnread] = useState(false);
  const prevAssistantCountRef = useRef(0);

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

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
  };

  useEffect(() => {
    const root = messagesRef.current;
    if (!root) return;
    const viewport = root.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLElement | null;
    if (!viewport) return;

    viewportRef.current = viewport;

    const onScroll = () => {
      const distanceFromBottom =
        viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight);
      const atBottom = distanceFromBottom < 80;
      setIsAtBottom(atBottom);
      if (atBottom) setHasUnread(false);
    };

    viewport.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => viewport.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const assistantCount = messages.reduce(
      (count, m) => (m.role === 'assistant' ? count + 1 : count),
      0
    );
    const prevAssistantCount = prevAssistantCountRef.current;
    const lastMessage = messages[messages.length - 1];
    const isNewAssistantMessage = assistantCount > prevAssistantCount;

    if (isAtBottom) {
      requestAnimationFrame(() => scrollToBottom('auto'));
    } else if (isNewAssistantMessage && lastMessage?.role === 'assistant') {
      setHasUnread(true);
    }

    prevAssistantCountRef.current = assistantCount;
  }, [messages, isAtBottom]);

  useEffect(() => {
    if (!isAtBottom) return;
    if (!isLoading) return;
    requestAnimationFrame(() => scrollToBottom('auto'));
  }, [isLoading, isAtBottom]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 8000);
    return () => clearTimeout(t);
  }, [error]);

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

  const uniqueSources = useMemo(() => {
    if (!sources) return [];
    return sources.filter(
      (src, index, all) =>
        all.findIndex((s) => (s.title || '').trim() === (src.title || '').trim()) === index
    );
  }, [sources]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="space-y-2">
        <BackToHome />
        <h1 className="text-2xl font-semibold text-slate-900">New Joiner Buddy</h1>
        <p className="text-sm text-slate-600">
          Get quick, policy-grounded answers for day one, IT setup, RTO, travel and expenses.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Left: chat surface */}
        <div className="bg-card rounded-3xl shadow-sm p-4 sm:p-6 flex flex-col gap-4 min-h-[560px]">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900">Quick questions</p>
            <div className="space-y-2">
              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-slate-500">Day 1</span>
                <div className="flex flex-wrap gap-2">
                  {DAY_ONE_QUESTIONS.map((q) => (
                    <Button
                      key={q}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="whitespace-nowrap text-xs rounded-full"
                      onClick={() => handleAsk(q)}
                      disabled={isLoading}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-slate-500">Access &amp; IT</span>
                <div className="flex flex-wrap gap-2">
                  {ACCESS_IT_QUESTIONS.map((q) => (
                    <Button
                      key={q}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="whitespace-nowrap text-xs rounded-full"
                      onClick={() => handleAsk(q)}
                      disabled={isLoading}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-slate-500">Policies &amp; leave</span>
                <div className="flex flex-wrap gap-2">
                  {POLICIES_QUESTIONS.map((q) => (
                    <Button
                      key={q}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="whitespace-nowrap text-xs rounded-full"
                      onClick={() => handleAsk(q)}
                      disabled={isLoading}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-slate-500">Travel &amp; expenses</span>
                <div className="flex flex-wrap gap-2">
                  {TRAVEL_EXPENSE_QUESTIONS.map((q) => (
                    <Button
                      key={q}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="whitespace-nowrap text-xs rounded-full"
                      onClick={() => handleAsk(q)}
                      disabled={isLoading}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-[11px] font-medium text-slate-500">Security &amp; Infosec</span>
                <div className="flex flex-wrap gap-2">
                  {SECURITY_QUESTIONS.map((q) => (
                    <Button
                      key={q}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="whitespace-nowrap text-xs rounded-full"
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
              <div className="flex flex-wrap gap-2 items-center pt-1">
                <span className="text-[11px] font-medium text-slate-500">Recent</span>
                {recentQuestions.map((q) => (
                  <Button
                    key={q}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="whitespace-nowrap text-xs text-slate-600 rounded-full"
                    onClick={() => handleAsk(q)}
                    disabled={isLoading}
                  >
                    {q.length > 40 ? `${q.slice(0, 37)}...` : q}
                  </Button>
                ))}
              </div>
            )}

            {messages.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-[11px] text-blue-700 hover:underline"
                  onClick={handleResetConversation}
                >
                  New conversation
                </button>
              </div>
            )}
          </div>

          <div className="relative flex-1">
            <ScrollArea ref={messagesRef} className="h-full chat-scroll">
              <div className="bg-muted rounded-2xl p-3 space-y-3">
                {messages.length === 0 && (
                  <div className="flex justify-start">
                    <div className="inline-flex max-w-md flex-col gap-1 rounded-2xl bg-card px-3 py-2 text-sm text-slate-700 shadow-sm">
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
                          : 'bg-card text-slate-900'
                      }`}
                    >
                      <span className="text-[11px] font-medium uppercase tracking-wide opacity-70">
                        {msg.role === 'user' ? 'You' : 'Buddy'}
                      </span>
                      <p>{msg.content}</p>
                      {msg.createdAt && (
                        <span className="text-[10px] text-slate-400 self-end">
                          {formatTime(msg.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-1 rounded-2xl bg-slate-100 px-3 py-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:-0.2s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:0.2s]" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {hasUnread && !isAtBottom && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="absolute bottom-3 right-3 rounded-full shadow-sm"
                onClick={() => {
                  scrollToBottom('smooth');
                  setHasUnread(false);
                }}
              >
                Jump to latest
              </Button>
            )}
          </div>

          {lastAssistantMessage && (
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex items-center justify-end gap-2">
                <span>Did this answer help?</span>
                <button
                  type="button"
                  className={`rounded-full border px-2 py-1 transition ${
                    feedback === 'up'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-border bg-card hover:border-green-400 hover:text-green-700'
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
                      : 'border-border bg-card hover:border-red-400 hover:text-red-700'
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
                    className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-[11px] font-medium text-white hover:bg-blue-700"
                  >
                    Open Service Desk for this
                  </Link>
                </div>
              )}
            </div>
          )}

          {error && <ErrorBar message={error} className="mt-2" />}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Ask a question</label>
            <div className="flex items-end gap-3">
              <Textarea
                rows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g., What should I do before my first day?"
                className="flex-1 resize-none rounded-2xl"
              />
              <Button
                className="rounded-full px-5"
                onClick={() => handleAsk()}
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    Asking...
                  </span>
                ) : (
                  'Ask'
                )}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Press Enter to send. Shift+Enter for a new line.
            </p>
          </div>
        </div>

        {/* Right: sources + checklist */}
        <div className="space-y-4">
          <div className="bg-card rounded-3xl shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Sources</h2>
            {!lastAssistantMessage && (
              <p className="text-sm text-slate-600">
                Sources will appear here after the buddy answers.
              </p>
            )}

            {lastAssistantMessage && uniqueSources.length > 0 && (
              <div className="space-y-2">
                {uniqueSources.map((src, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-border bg-background px-3 py-2 text-sm text-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-slate-900">
                        {src.title || 'Untitled'}
                        {src.section ? (
                          <span className="ml-1 text-xs font-normal text-slate-500">
                            ({src.section})
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[11px] uppercase tracking-wide text-slate-500">
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

            {lastAssistantMessage && uniqueSources.length === 0 && (
              <p className="text-sm text-slate-600">
                No sources were returned for the last answer.
              </p>
            )}
          </div>

          <div className="bg-card rounded-3xl shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Day 1 checklist (example)</h3>
            <p className="text-xs text-slate-600">
              This is a generic checklist. Exact steps can vary by team and location.
            </p>
            <ul className="text-xs text-slate-700 space-y-1 list-disc pl-4">
              <li>Confirm your reporting manager and work location.</li>
              <li>Complete HR onboarding formalities and document upload.</li>
              <li>Set up corporate email, Teams, and VPN as per IT instructions.</li>
              <li>Review RTO / work-from-home expectations with your manager.</li>
              <li>Check mandatory trainings and due dates (InfoSec, POSH, etc.).</li>
            </ul>

            <h3 className="mt-3 text-sm font-semibold text-slate-900">First-week checklist</h3>
            <ul className="text-xs text-slate-700 space-y-1 list-disc pl-4">
              <li>Understand your role, project, and key deliverables for the first 30-90 days.</li>
              <li>Clarify working hours, leave application process, and escalation paths.</li>
              <li>Meet your immediate team and key stakeholders.</li>
              <li>Bookmark key systems: HR portal, timesheet, expense tool, travel desk.</li>
              <li>Note important email IDs (HR, IT helpdesk, Travel Desk, InfoSec).</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card shadow-sm px-4 py-3 text-xs text-slate-600">
        New Joiner Buddy is intended to guide associates through their first weeks at Trianz. Answers
        come from internal policies and onboarding material and are kept conservative; for anything
        unclear or personal (payroll, contracts, performance), please confirm with your manager or HR
        at hr@trianz.com.
      </div>
    </div>
  );
}
