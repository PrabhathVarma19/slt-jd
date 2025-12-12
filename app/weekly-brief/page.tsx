'use client';

import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';

export default function WeeklyBriefPage() {
  const [rawUpdates, setRawUpdates] = useState('');
  const [agenda, setAgenda] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/weekly-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_start: weekStart || undefined,
          agenda: agenda || undefined,
          raw_updates: rawUpdates,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'In progress');
      }
      setMessage('Weekly brief generated (placeholder response).');
    } catch (err: any) {
      setMessage(err.message || 'In progress');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        <div className="font-semibold">Under progress</div>
        <p>Weekly Brief is being built. Generation and history endpoints are not finalized yet.</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">CIO Weekly Brief</p>
          <h1 className="text-2xl font-semibold text-gray-900">Prep and publish the Thursday call in minutes.</h1>
          <p className="text-sm text-gray-600">
            Paste the team updates or the consolidated email to generate a digest, run-of-show, and action/risk register.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Week start (optional)</label>
            <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Agenda (optional)</label>
            <Textarea
              rows={3}
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="Timeboxes, teams, key topics..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Paste consolidated updates</label>
            <Textarea
              rows={10}
              value={rawUpdates}
              onChange={(e) => setRawUpdates(e.target.value)}
              placeholder="Paste team updates or the PM's consolidated email here..."
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleSubmit} disabled={isSubmitting || !rawUpdates.trim()}>
            {isSubmitting ? 'Submitting...' : 'Generate (in progress)'}
          </Button>
          <Link href="/">
            <Button variant="secondary">Back to Home</Button>
          </Link>
        </div>

        {message && (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
