'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/button';
import Textarea from '@/components/ui/textarea';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
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

const QUICK_QUESTIONS: string[] = [
  'What should I do on my first day?',
  'How do I set up my Trianz email and VPN?',
  'How to request laptop or system access?',
  'How to submit expenses in Fusion?',
  'What is the return to office policy?',
  'What travel modes are allowed for my grade?',
  'What is the probation period for a new joiner?',
  'How many leave days do I get in a year?',
  'Who do I contact for HR queries?',
  'Where can I find all HR policies?',
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

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');

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

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);
    setError(null);
    setFeedback(null);
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
        }),
      });
      const data: PolicyAgentResponse & { error?: string } = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to get answer');
      }

      const answerText = data.answer || 'No answer generated.';
      setMessages((prev) => [...prev, { role: 'assistant', content: answerText }]);
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
    if (lastUserMessage && lastAssistantMessage) {
      console.log('New Joiner Buddy feedback', {
        question: lastUserMessage.content,
        answerPreview: lastAssistantMessage.content.slice(0, 160),
        feedback: value,
      });
    }
  };

  return (
    <div className="space-y-6">
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

          {error && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <div className="text-sm text-gray-600">
                Try asking &quot;What should I do on my first day?&quot; or &quot;How do I request a
                laptop and VPN access?&quot;. You can ask follow-up questions in the same thread.
              </div>
            )}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-full rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {msg.content}
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
        </div>
      </div>
    </div>
  );
}
