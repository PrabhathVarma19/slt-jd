'use client';

import { useRef, useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/button';
import Textarea from '@/components/ui/textarea';

interface BeaconMessage {
  role: 'user' | 'assistant';
  content: string;
  keyRules?: string | null;
}

const QUICK_QUESTIONS = {
  travel: [
    'How do I submit travel expenses in Fusion?',
    'What is the hotel limit for Group A cities?',
    'What per diem do I get for international travel?',
  ],
  nonTravel: [
    'What expenses are reimbursable for client dinners?',
    'Can I claim local transport between home and office?',
  ],
  policy: [
    'What is Trianz India travel policy in short?',
    'What counts as non-reimbursable expenses?',
  ],
};

export default function ExpensesCoachPage() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<BeaconMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const ask = async (q?: string) => {
    const trimmed = (q ?? question).trim();
    if (!trimmed) return;

    const userMessage: BeaconMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion(q ? question : '');
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/policy-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          history: [],
          mode: 'expenses',
          style: 'how_to',
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to get answer');
      }

      const answerMessage: BeaconMessage = {
        role: 'assistant',
        content: data.answer as string,
        keyRules: (data.keyRules as string) ?? null,
      };
      setMessages((prev) => [...prev, answerMessage]);
    } catch (err: any) {
      setError(err.message || 'Failed to get answer');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetConversation = () => {
    setMessages([]);
    setQuestion('');
    setError(null);
    setIsLoading(false);
    fetch('/api/ai/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: 'expenses-coach', action: 'clear' }),
    }).catch(() => undefined);
  };

  const lastUserQuestion =
    [...messages].reverse().find((m) => m.role === 'user')?.content || '';

  const showTravelDeskCta = /travel|flight|hotel|per diem|per-diem|trip|visa/i.test(
    lastUserQuestion,
  );

  useEffect(() => {
    if (!messagesRef.current) return;
    const el = messagesRef.current;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

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
            Expenses & Fusion Coach
          </p>
          <h1 className="text-2xl font-semibold text-gray-900">
            Understand expense rules and Fusion steps.
          </h1>
          <p className="text-sm text-gray-600">
            Ask Beacon how to claim expenses, what is reimbursable, or how to submit in Fusion.
            Answers use Trianz travel and expense policies and come back as clear numbered steps.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Conversation</h2>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
          {messages.length === 0 && (
            <p className="text-sm text-gray-600">
              Ask a question below, or use a quick question from the right to see how Beacon explains
              expenses and Fusion in simple steps.
            </p>
          )}
          <div
            ref={messagesRef}
            className="space-y-3 max-h-[400px] overflow-y-auto rounded-md border border-gray-100 bg-gray-50 p-3"
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={
                  m.role === 'user'
                    ? 'ml-auto max-w-[80%] rounded-lg bg-blue-50 px-3 py-2 text-sm text-gray-900'
                    : 'mr-auto max-w-[80%] rounded-lg bg-white px-3 py-2 text-sm text-gray-900 border border-gray-100'
                }
              >
                <p className="whitespace-pre-wrap text-[13px]">{m.content}</p>
                {m.role === 'assistant' && m.keyRules && (
                  <div className="mt-2 rounded-md bg-gray-50 px-2 py-1.5 text-[11px] text-gray-700">
                    <p className="font-semibold text-gray-800">Key rules</p>
                    <p className="mt-1 whitespace-pre-wrap">{m.keyRules}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {showTravelDeskCta && (
            <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
              <p className="font-semibold">Need to raise a travel request?</p>
              <p className="mt-1">
                You can use the Travel Desk tool to format and send a formal travel request to the
                team.
              </p>
              <Link
                href="/travel-desk"
                className="mt-2 inline-flex text-xs font-medium text-blue-700 hover:underline"
              >
                Open Travel Desk
              </Link>
            </div>
          )}

          <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Ask a question
            </h3>
            <Textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="E.g., How do I submit travel expenses in Fusion? or What is my hotel limit in Mumbai?"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-gray-500">
                Beacon will answer using Trianz policies only, with steps you can follow directly in
                Fusion.
              </p>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetConversation}
                    disabled={isLoading}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    New chat
                  </Button>
                )}
                <Button onClick={() => ask()} disabled={isLoading || !question.trim()} size="sm">
                  {isLoading ? 'Answering…' : 'Ask'}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-3 text-sm text-gray-700">
            <h2 className="text-sm font-semibold text-gray-900">Quick questions</h2>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Travel expenses
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_QUESTIONS.travel.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-800 hover:border-blue-300 hover:bg-blue-50"
                    onClick={() => ask(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Other expenses
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_QUESTIONS.nonTravel.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-800 hover:border-blue-300 hover:bg-blue-50"
                    onClick={() => ask(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Policies & limits
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_QUESTIONS.policy.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-800 hover:border-blue-300 hover:bg-blue-50"
                    onClick={() => ask(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-[11px] text-gray-500">
            Beacon does not change reimbursement eligibility. It only explains the written policy and
            helps you follow the right steps in Fusion. For edge cases, confirm with your manager or
            Finance / HR.
          </div>
        </div>
      </div>
    </div>
  );
}
