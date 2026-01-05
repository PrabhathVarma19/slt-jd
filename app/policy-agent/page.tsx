'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [answerStyle, setAnswerStyle] = useState<'standard' | 'how_to'>('standard');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<PolicySource[]>([]);
  const [keyRules, setKeyRules] = useState<string | null>(null);
  const [recentQuestions, setRecentQuestions] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

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
    if (!lastUserMessage || answerStyle !== 'how_to') return false;
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
    if (!lastUserMessage || answerStyle !== 'how_to') return false;
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

  useEffect(() => {
    if (!messagesRef.current) return;
    const el = messagesRef.current;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleAsk = async (questionOverride?: string) => {
    const raw = questionOverride ?? input;
    const trimmed = raw.trim();
    if (!trimmed) {
      setError('Please enter a question.');
      return;
    }

    const now = new Date().toISOString();
    const apiUserContent =
      answerStyle === 'how_to'
        ? `${trimmed}\n\nPlease answer this as a numbered step-by-step how-to, with 3–8 steps and each step on its own line.`
        : trimmed;

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
          style: answerStyle,
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
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Beacon · Ask Beacon</p>
          <h1 className="text-2xl font-semibold text-gray-900 mt-1">
            One place to ask about policies and how work gets done.
          </h1>
          <p className="text-sm text-gray-600">
            Use this conversational assistant for HR, travel, RTO, onboarding, and other internal &quot;how do I…&quot;
            questions. It answers strictly from uploaded company documents and will say if something is not covered.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-medium text-gray-700">Answer style:</span>
        <div className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-1 text-xs font-medium text-gray-700">
          <button
            type="button"
            onClick={() => setAnswerStyle('standard')}
            className={`rounded-full px-3 py-1 transition ${
              answerStyle === 'standard'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            disabled={isLoading}
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => setAnswerStyle('how_to')}
            className={`rounded-full px-3 py-1 transition ${
              answerStyle === 'how_to'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            disabled={isLoading}
          >
            How‑to steps
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm flex flex-col">
          <div className="mb-4 space-y-3">
            <label className="text-xs font-medium text-gray-700 uppercase tracking-wide">
              Quick questions
            </label>

            <div className="flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((q) => (
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
              {recentQuestions.length > 0 && (
                <>
                  <span className="mx-1 text-xs text-gray-400">•</span>
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
                      Recent: {q.length > 40 ? `${q.slice(0, 37)}...` : q}
                    </Button>
                  ))}
                </>
              )}
            </div>
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

          <div
            ref={messagesRef}
            className="chat-scroll flex-1 space-y-4 overflow-y-auto pr-1 rounded-lg bg-gray-50 p-3 max-h-[420px]"
          >
            {messages.length === 0 && (
              <div className="flex justify-start">
                <div className="inline-flex max-w-md flex-col gap-1 rounded-2xl bg-white px-3 py-2 text-sm text-gray-700 shadow-sm">
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
                      : 'bg-white text-gray-900'
                  }`}
                >
                  <span className="text-[11px] font-medium uppercase tracking-wide opacity-70">
                    {msg.role === 'user' ? 'You' : 'Beacon'}
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
            <>
              {keyRules && (
                <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                  <div className="text-[11px] font-semibold uppercase tracking-wide mb-1">
                    Key rules
                  </div>
                  <p className="whitespace-pre-wrap">{keyRules}</p>
                </div>
              )}

              <div className="mt-3 flex flex-col gap-3">
                <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
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

                {shouldShowServiceDeskCta && lastUserMessage && (
                  <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-900 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p>
                      Need IT to actually do this? Open a Service Desk request with your question
                      pre-filled.
                    </p>
                    <Link
                      href={{
                        pathname: '/service-desk',
                        query: { details: lastUserMessage.content },
                      }}
                      className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Open Service Desk
                    </Link>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
            <label className="text-sm font-medium text-gray-700">Ask a question</label>
            <Textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g., How do I submit an expense report for international travel?"
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
              After the assistant answers, you&apos;ll see which documents and sections were used here.
            </p>
          )}
          {lastAssistantMessage && sources && sources.length > 0 && (
            <div className="space-y-2">
              {groupSources(sources).map((src, idx) => (
                <div key={idx} className="rounded-md border border-gray-200 p-3 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-gray-900">{src.title}</div>
                    <span className="text-xs uppercase tracking-wide text-gray-500">
                      Source {idx + 1}
                    </span>
                  </div>
                  {(src.sections.length > 0 || src.pages.length > 0) && (
                    <p className="mt-1 text-xs text-gray-600">
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
          {lastAssistantMessage && (!sources || sources.length === 0) && (
            <p className="text-sm text-gray-600">
              No specific sources were returned for the last answer.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-[11px] text-gray-500">
        Beacon answers are grounded in internal Trianz policy and process documents only and will say
        it does not know when something is not covered. For sensitive or edge-case decisions, please
        confirm with your manager, HR, InfoSec or the relevant support team. Built for Trianz ·
        Content last updated Dec 2025.
      </div>
    </div>
  );
}
