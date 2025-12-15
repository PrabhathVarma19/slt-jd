'use client';

import { useState } from 'react';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';

interface PolicyAnswer {
  answer: string;
  sources?: Array<{
    title?: string;
    section?: string;
    page?: number;
    snippet?: string;
    link?: string;
  }>;
}

export default function PolicyAgentPage() {
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [accessLevel, setAccessLevel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<PolicyAnswer | null>(null);

  const ask = async () => {
    if (!question.trim()) {
      setError('Please enter a question.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResponse(null);
    try {
      const res = await fetch('/api/policy-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          filters: {
            category: category || undefined,
            effective_date: effectiveDate || undefined,
            access_level: accessLevel || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to get answer');
      }
      setResponse(data);
    } catch (err: any) {
      setError(err.message || 'Failed to get answer');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Policy Agent</p>
          <h1 className="text-2xl font-semibold text-gray-900">Ask questions grounded in company policies.</h1>
          <p className="text-sm text-gray-600">Retrieval and citations will be wired once ingestion is ready.</p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Question</label>
          <Textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g., What is the data retention policy for customer PII?"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Category (optional)</label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., InfoSec, HR, IT"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Effective date (optional)</label>
            <Input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Access level (optional)</label>
            <Input
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value)}
              placeholder="e.g., internal, restricted"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={ask} disabled={isLoading || !question.trim()}>
            {isLoading ? 'Asking...' : 'Ask'}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Answer</h2>
        {!response && <p className="text-sm text-gray-600">Ask a question to see the answer and citations.</p>}
        {response && (
          <div className="space-y-3">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{response.answer}</p>
            {response.sources && response.sources.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900">Sources</p>
                <div className="space-y-2">
                  {response.sources.map((src, idx) => (
                    <div key={idx} className="rounded-md border border-gray-200 p-3 text-sm text-gray-700">
                      <div className="font-medium text-gray-900">
                        {src.title || 'Untitled'} {src.section ? `· ${src.section}` : ''}{' '}
                        {src.page ? `(p. ${src.page})` : ''}
                      </div>
                      {src.snippet && <p className="mt-1 text-gray-700 whitespace-pre-wrap">{src.snippet}</p>}
                      {src.link && (
                        <a className="text-blue-700 hover:underline" href={src.link} target="_blank" rel="noreferrer">
                          Open document
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
