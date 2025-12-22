'use client';

import { useEffect, useState } from 'react';
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
          messages: nextMessages,
          mode: 'default',
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

          <div className="chat-scroll flex-1 space-y-4 overflow-y-auto pr-1 rounded-lg bg-gray-50 p-3 max-h-[420px]">
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

              <div className="mt-3 flex items-center justify-end gap-2 text-xs text-gray-500">
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
