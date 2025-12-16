'use client';

import { useState } from 'react';
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

export default function PolicyAgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<PolicySource[]>([]);

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');

  const handleAsk = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Please enter a question.');
      return;
    }

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setIsLoading(true);
    setError(null);

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

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Ask Beacon</p>
          <h1 className="text-2xl font-semibold text-gray-900">
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
          {error && (
            <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <div className="text-sm text-gray-600">
                Start with a question like &quot;What is the return to office policy?&quot;, &quot;How do I raise a
                travel request?&quot; or &quot;Am I eligible for air travel in grade 6?&quot;. You can ask follow-up
                questions in the same thread.
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
          </div>

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
              <Button size="sm" onClick={handleAsk} disabled={isLoading || !input.trim()}>
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
    </div>
  );
}
