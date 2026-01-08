'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
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
  keyRules?: string | null;
  sources?: PolicySource[];
}

function groupSources(sources: PolicySource[]) {
  const map = new Map<
    string,
    { title: string; sections: string[]; pages: number[]; link: string | null }
  >();

  for (const src of sources) {
    const title = (src.title || 'Untitled').trim();
    if (!map.has(title)) {
      map.set(title, { title, sections: [], pages: [], link: src.link ?? null });
    }
    const entry = map.get(title)!;
    if (src.section) {
      const s = src.section.trim();
      if (s && !entry.sections.includes(s)) entry.sections.push(s);
    }
    if (typeof src.page === 'number' && !entry.pages.includes(src.page)) {
      entry.pages.push(src.page);
    }
    if (!entry.link && src.link) {
      entry.link = src.link;
    }
  }

  return Array.from(map.values());
}

const QUICK_QUESTIONS: string[] = [
  'What is the return to office policy?',
  'How many days do I need to be in office?',
  'Can I request an exception to the RTO policy?',
  'What travel modes are allowed for my grade?',
  'How do I raise a travel request?',
  'What are the hotel limits for my grade and city?',
  'How to submit expenses in Fusion?',
  'What is the per diem for international travel?',
  'How many leave days do I get in a year?',
  'What is the probation period for new joiners?',
  'Whom should I contact for travel or accommodation queries?',
  // Security & Infosec
  'What should I do if I get a phishing or suspicious email?',
  'What are the password rules at Trianz?',
  'How should I classify client or confidential data?',
  'What is the policy on using personal devices (BYOD)?',
];

type Feedback = 'up' | 'down' | null;

export default function PolicyAgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<PolicySource[]>([]);
  const [keyRules, setKeyRules] = useState<string | null>(null);
  const [recentQuestions, setRecentQuestions] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
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
    // Simple keyword heuristic for IT / access type questions
    return (
      q.includes('vpn') ||
      q.includes('access') ||
      q.includes('laptop') ||
      q.includes('system access') ||
      q.includes('cursor') ||
      q.includes('gitlab') ||
      q.includes('jira') ||
      q.includes('confluence') ||
      q.includes('password') ||
      q.includes('software install')
    );
  })();

  const shouldShowTravelDeskCta = (() => {
    if (!lastUserMessage) return false;
    const q = lastUserMessage.content.toLowerCase();
    return (
      q.includes('travel') ||
      q.includes('trip') ||
      q.includes('flight') ||
      q.includes('ticket') ||
      q.includes('hotel') ||
      q.includes('per diem') ||
      q.includes('per-diem') ||
      q.includes('expense') ||
      q.includes('fusion') ||
      q.includes('travel desk')
    );
  })();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('beacon_recent_questions');
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
      window.localStorage.setItem('beacon_recent_questions', JSON.stringify(recentQuestions.slice(0, 5)));
    } catch {
      // ignore localStorage errors
    }
  }, [recentQuestions]);

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
  };

  // Attach scroll listener to the Radix viewport so we can implement "near bottom" logic.
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

  // Auto-scroll only when the user is near the bottom; otherwise, show "Jump to latest".
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
    const apiUserContent = trimmed;

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: trimmed, createdAt: now },
    ];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);
    setError(null);
    setFeedback(null);
    setKeyRules(null);
    setRecentQuestions((prev) => {
      const withoutDup = prev.filter((q) => q !== trimmed);
      return [trimmed, ...withoutDup].slice(0, 5);
    });

    try {
      const res = await fetch('/api/policy-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages,
            { role: 'user', content: apiUserContent, createdAt: now },
          ],
          mode: 'default',
          style: 'standard',
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
      setKeyRules((data as any).keyRules || null);

      if (lastUserMessage) {
        console.log('Ask Beacon answer', {
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
    if (lastUserMessage && lastAssistantMessage) {
      console.log('Ask Beacon feedback', {
        question: lastUserMessage.content,
        answerPreview: lastAssistantMessage.content.slice(0, 160),
        feedback: value,
      });
    }
  };

  const handleResetConversation = () => {
    setMessages([]);
    setSources([]);
    setKeyRules(null);
    setFeedback(null);
    setError(null);
    setIsLoading(false);
  };

  const sourcesGrouped = useMemo(() => groupSources(sources || []), [sources]);

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-4 space-y-3">
      <div className="grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-1">
        <BackToHome label="" className="mt-1 text-xs" />
        <h1 className="text-2xl font-semibold text-slate-900">Ask Beacon</h1>
        <p className="col-start-2 text-sm text-slate-600">
          Ask policy and &quot;how do I...&quot; questions. Answers are grounded in internal Trianz policies with citations.
          </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:h-[calc(100vh-150px)] min-h-[620px]">
        {/* Left: chat surface */}
        <div className="bg-card rounded-3xl shadow-sm p-4 sm:p-6 flex flex-col gap-4 h-[75vh] min-h-[620px] md:h-full md:min-h-0">
          {/* Grey chat surface (messages + composer) */}
          <div className="flex flex-col flex-1 min-h-0 rounded-2xl bg-muted p-3">
            {messages.length === 0 && (
              <p className="text-xs text-slate-600 mb-2">
                Ask your own question, or pick a suggested one on the right.
              </p>
          )}
            <div className="relative flex-1 min-h-0">
              <ScrollArea ref={messagesRef} className="h-full chat-scroll">
                <div className="space-y-3">
            {messages.length === 0 && (
              <div className="flex justify-start">
                    <div className="inline-flex max-w-md flex-col gap-1 rounded-2xl bg-card px-3 py-2 text-sm text-slate-700 shadow-sm">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-blue-600">
                    Beacon
                  </span>
                  <p>
                    Start with a question like &quot;What is the return to office policy?&quot;, &quot;How do
                    I raise a travel request?&quot; or &quot;Am I eligible for air travel in grade 6?&quot;. You
                    can ask follow-up questions in the same thread.
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
                    {msg.role === 'user' ? 'You' : 'Beacon'}
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

            {error && <ErrorBar message={error} className="mt-3" />}

            <div className="mt-3 space-y-2">
              <div className="flex items-end gap-3">
            <Textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
                  placeholder="e.g., What are the password rules? How many days do I need to be in office?"
                  className="flex-1 resize-none rounded-2xl bg-card"
                />

                <div className="flex flex-col items-center gap-2">
                  {/* reserved space so layout doesn't jump */}
                  <div className={messages.length === 0 ? 'opacity-0 pointer-events-none' : ''}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleResetConversation}
                      disabled={messages.length === 0 || isLoading}
                      className="h-8 w-8 rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50"
                      aria-label="New conversation"
                      title="New conversation"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>

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
              </div>
              <p className="text-xs text-slate-500">
                Press Enter to send. Shift+Enter for a new line.
              </p>
            </div>
          </div>
        </div>

        {/* Right: sidebar */}
        <div className="h-[75vh] min-h-[620px] md:h-full md:min-h-0 md:sticky md:top-24 flex flex-col gap-4 min-h-0">
          <div className="bg-card rounded-3xl shadow-sm p-4 space-y-3 flex flex-col min-h-0 max-h-[320px]">
            <h2 className="text-sm font-semibold text-slate-900">Suggested questions</h2>
            <ScrollArea className="flex-1 min-h-0 pr-2">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {QUICK_QUESTIONS.map((q) => (
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
                {recentQuestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Recent
                    </p>
                    <div className="flex flex-wrap gap-2">
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
                          {q.length > 44 ? `${q.slice(0, 41)}...` : q}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="bg-card rounded-3xl shadow-sm p-4 space-y-3 flex flex-col min-h-0 flex-1 overflow-hidden">
            <h2 className="text-sm font-semibold text-slate-900">Sources</h2>

          {!lastAssistantMessage && (
              <p className="text-sm text-slate-600">
                Sources will appear here after Beacon answers.
            </p>
          )}

            <ScrollArea className="flex-1 min-h-0 pr-2">
              {lastAssistantMessage && sourcesGrouped.length > 0 && (
                <div
                  className={`space-y-2 ${
                    lastAssistantMessage && lastUserMessage && (shouldShowServiceDeskCta || shouldShowTravelDeskCta)
                      ? 'pb-28'
                      : ''
                  }`}
                >
                  {sourcesGrouped.map((src, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-border bg-background px-3 py-2 text-sm text-slate-700"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-slate-900">{src.title}</div>
                        <span className="text-[11px] uppercase tracking-wide text-slate-500">
                      Source {idx + 1}
                    </span>
                  </div>
                  {(src.sections.length > 0 || src.pages.length > 0) && (
                        <p className="mt-1 text-xs text-slate-600">
                      {src.sections.length > 0 && (
                        <span>Sections: {src.sections.join(', ')}.</span>
                      )}{' '}
                      {src.pages.length > 0 && (
                        <span>Pages: {src.pages.join(', ')}.</span>
                      )}
                    </p>
                  )}
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

              {lastAssistantMessage && sourcesGrouped.length === 0 && (
                <p
                  className={`text-sm text-slate-600 ${
                    lastAssistantMessage && lastUserMessage && (shouldShowServiceDeskCta || shouldShowTravelDeskCta)
                      ? 'pb-28'
                      : ''
                  }`}
                >
                  No sources were returned for the last answer.
            </p>
          )}
            </ScrollArea>

            {lastAssistantMessage &&
              lastUserMessage &&
              (shouldShowServiceDeskCta || shouldShowTravelDeskCta) && (
                <div className="pt-2 border-t border-border space-y-2 shrink-0">
                  {shouldShowServiceDeskCta && (
                    <div className="flex items-center justify-between gap-2 rounded-2xl bg-blue-50 px-3 py-2 text-xs text-blue-900">
                      <span className="leading-snug">Open Service Desk with this question pre-filled.</span>
                      <Link
                        href={{
                          pathname: '/service-desk',
                          query: { details: lastUserMessage.content },
                        }}
                        className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Service Desk
                      </Link>
                    </div>
                  )}

                  {shouldShowTravelDeskCta && (
                    <div className="flex items-center justify-between gap-2 rounded-2xl bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
                      <span className="leading-snug">Open Travel Desk with this question pre-filled.</span>
                      <Link
                        href={{
                          pathname: '/travel-desk',
                          query: { details: lastUserMessage.content },
                        }}
                        className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700"
                      >
                        Travel Desk
                      </Link>
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card shadow-sm px-4 py-3 text-xs text-slate-600">
        Beacon answers are grounded in internal Trianz policy and process documents only and will say
        it does not know when something is not covered. For sensitive or edge-case decisions, please
        confirm with your manager, HR, InfoSec or the relevant support team.
      </div>
    </div>
  );
}
