'use client';

import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import { WeeklyBrief } from '@/types/weekly';

type BriefSection = { title: string; body: string };
type ActionItem = { id: string; team?: string; description: string; owner?: string; due?: string; status: 'open' | 'closed' };

const sampleDigest: BriefSection[] = [
  { title: 'Top Wins', body: 'IT: Completed SSO rollout for finance apps. Infosec: Closed 3 high-risk findings.' },
  { title: 'Top Risks', body: 'Apps: Payment gateway latency risk; Infosec: phishing attempts targeting execs.' },
  { title: 'Asks / Decisions', body: 'Approve pilot budget for observability; confirm scope freeze for payroll migration.' },
];

const sampleRunOfShow: BriefSection[] = [
  { title: 'IT (5 min)', body: 'SSO rollout status; next milestone; risk/ask.' },
  { title: 'Infosec (5 min)', body: 'Phishing defense; mandatory actions; verification protocol.' },
  { title: 'Internal Apps (5 min)', body: 'Payment gateway latency mitigation; timeline.' },
];

const sampleActions: ActionItem[] = [
  { id: 'A-1', team: 'IT', description: 'Confirm SSO cutover sign-off with Finance', owner: 'Anita', due: '2025-12-15', status: 'open' },
  { id: 'A-2', team: 'Infosec', description: 'Send executive impersonation alert to all associates', owner: 'Ravi', due: '2025-12-09', status: 'open' },
  { id: 'A-3', team: 'Apps', description: 'Share latency RCA and mitigation plan', owner: 'Priya', due: '2025-12-12', status: 'closed' },
];

export default function WeeklyBriefPage() {
  const [mode, setMode] = useState<'prep' | 'publish'>('prep');
  const [weekStart, setWeekStart] = useState('');
  const [agenda, setAgenda] = useState('');
  const [rawUpdates, setRawUpdates] = useState('');
  const [lastWeekSummary] = useState('Last week: published digest/actions will appear here (placeholder).');
  const [digest, setDigest] = useState<BriefSection[] | null>(null);
  const [runOfShow, setRunOfShow] = useState<BriefSection[] | null>(null);
  const [actions, setActions] = useState<ActionItem[] | null>(null);
  const [message, setMessage] = useState<string | null>('Generation and persistence are in progress. This is a UI scaffold.');
  const [isGenerating, setIsGenerating] = useState(false);

  const generateDraft = async () => {
    if (!rawUpdates.trim()) return;
    setIsGenerating(true);
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
      const data: WeeklyBrief | { error: string } = await res.json();
      if (!res.ok || (data as any).error) {
        throw new Error((data as any).error || 'Failed to generate weekly initiatives');
      }
      const brief = data as WeeklyBrief;
      setDigest(brief.digest);
      setRunOfShow(brief.run_of_show);
      setActions(
        brief.action_register.map((a, idx) => ({
          id: a.id || `A-${idx + 1}`,
          team: a.team,
          description: a.description,
          owner: a.owner,
          due: a.due_date,
          status: a.status as 'open' | 'closed',
        }))
      );
      setMessage(mode === 'prep' ? 'Prep draft generated.' : 'Publish draft generated.');
    } catch (err: any) {
      setDigest(null);
      setRunOfShow(null);
      setActions(null);
      setMessage(err.message || 'Failed to generate.');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleAction = (id: string) => {
    if (!actions) return;
    setActions(actions.map((a) => (a.id === id ? { ...a, status: a.status === 'open' ? 'closed' : 'open' } : a)));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
        <div className="font-semibold">Under progress</div>
        <p>Weekly Brief UI scaffolded. LLM generation, persistence, and history will be wired next.</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Beacon · Weekly Initiatives</p>
          <h1 className="text-2xl font-semibold text-gray-900 mt-1">Prep and publish the weekly initiatives.</h1>
          <p className="text-sm text-gray-600">Paste updates, set the week, and generate digest/run-of-show/actions.</p>
        </div>
          <Link href="/">
            <Button variant="secondary" size="sm">Back to Home</Button>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={mode === 'prep' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMode('prep')}
          >
            Prep (before call)
          </Button>
          <Button
            variant={mode === 'publish' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setMode('publish')}
          >
            Publish (after call)
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Week start</label>
            <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Agenda (optional)</label>
            <Input
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="Timeboxes, teams, key topics..."
            />
          </div>
        </div>

        {mode === 'prep' && (
          <div className="space-y-2 rounded-md border border-gray-100 bg-gray-50 p-4">
            <div className="text-sm font-semibold text-gray-900">Last week (published)</div>
            <p className="text-sm text-gray-700">{lastWeekSummary}</p>
            <p className="text-xs text-gray-500">When wired, this will load last week’s published digest/actions to inform prep.</p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            {mode === 'prep' ? 'PM notes / prep inputs' : 'Paste consolidated updates (team emails)'}
          </label>
          <Textarea
            rows={8}
            value={rawUpdates}
            onChange={(e) => setRawUpdates(e.target.value)}
            placeholder={mode === 'prep' ? 'PM notes, agenda tweaks, reminders...' : "Paste team updates or the PM's consolidated email here..."}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={generateDraft} disabled={!rawUpdates.trim() || isGenerating}>
            {isGenerating
              ? 'Generating...'
              : mode === 'prep'
              ? 'Generate prep draft'
              : 'Generate publish draft'}
          </Button>
          <Button variant="secondary" disabled>Save/Publish (pending wiring)</Button>
        </div>

        {message && (
          <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
            {message}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Digest (prep view)</h2>
            <Button variant="secondary" size="sm" disabled={!digest}>Copy digest</Button>
          </div>
          {!digest && <p className="text-sm text-gray-600">Generate a draft to see the digest.</p>}
          {digest && digest.map((sec, idx) => (
            <div key={idx} className="rounded-md border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900">{sec.title}</h3>
              <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{sec.body}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Run of show</h2>
            <Button variant="secondary" size="sm" disabled={!runOfShow}>Copy run-of-show</Button>
          </div>
          {!runOfShow && <p className="text-sm text-gray-600">Generate a draft to see the run-of-show.</p>}
          {runOfShow && runOfShow.map((sec, idx) => (
            <div key={idx} className="rounded-md border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900">{sec.title}</h3>
              <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{sec.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Action register</h2>
          <Button variant="secondary" size="sm" disabled={!actions}>Export (pending)</Button>
        </div>
        {!actions && <p className="text-sm text-gray-600">Generate a draft to see actions.</p>}
        {actions && (
          <div className="space-y-3">
            {actions.map((action) => (
              <div key={action.id} className="rounded-md border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-gray-900">
                    {action.id} · {action.team || 'General'}
                  </div>
                  <Button
                    size="sm"
                    variant={action.status === 'open' ? 'secondary' : 'primary'}
                    onClick={() => toggleAction(action.id)}
                  >
                    {action.status === 'open' ? 'Mark Closed' : 'Reopen'}
                  </Button>
                </div>
                <p className="mt-1 text-sm text-gray-700">{action.description}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Owner: {action.owner || 'Unassigned'} · Due: {action.due || 'TBD'} · Status: {action.status}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">History</h2>
          <Button variant="secondary" size="sm" disabled>Refresh (pending)</Button>
        </div>
        <p className="text-sm text-gray-600">History listing will appear here once persistence is wired.</p>
      </div>
    </div>
  );
}
