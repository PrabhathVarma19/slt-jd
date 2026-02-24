'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import {
  WeeklyAction,
  WeeklyBrief,
  WeeklyBriefHistoryItem,
  WeeklyBriefMode,
  WeeklyBriefSection,
  WeeklyBriefStatus,
} from '@/types/weekly';

type SaveResponse = { item: WeeklyBriefHistoryItem };

type HistoryResponse = { items: WeeklyBriefHistoryItem[]; error?: string };

export default function WeeklyBriefPage() {
  const [mode, setMode] = useState<WeeklyBriefMode>('prep');
  const [weekStart, setWeekStart] = useState('');
  const [agenda, setAgenda] = useState('');
  const [rawUpdates, setRawUpdates] = useState('');
  const [digest, setDigest] = useState<WeeklyBriefSection[] | null>(null);
  const [runOfShow, setRunOfShow] = useState<WeeklyBriefSection[] | null>(null);
  const [actions, setActions] = useState<WeeklyAction[] | null>(null);
  const [historyItems, setHistoryItems] = useState<WeeklyBriefHistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const selectedHistoryItem = useMemo(
    () => historyItems.find((item) => item.id === selectedHistoryId) || null,
    [historyItems, selectedHistoryId]
  );

  const lastPublished = useMemo(
    () => historyItems.find((item) => item.status === 'published') || null,
    [historyItems]
  );

  const lastWeekSummary = useMemo(() => {
    if (!lastPublished) return 'No published weekly brief yet.';
    const firstDigest = lastPublished.digest[0]?.body || 'No digest summary.';
    const trimmed = firstDigest.length > 150 ? `${firstDigest.slice(0, 147)}...` : firstDigest;
    return `Week of ${lastPublished.weekStart}: ${trimmed}`;
  }, [lastPublished]);

  const canSave =
    !isSaving &&
    !isGenerating &&
    !!rawUpdates.trim() &&
    ((digest?.length || 0) > 0 || (runOfShow?.length || 0) > 0 || (actions?.length || 0) > 0);

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/weekly-brief', { cache: 'no-store' });
      const data = (await res.json()) as HistoryResponse;
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to load history');
      }
      setHistoryItems(data.items || []);
    } catch (err: any) {
      setMessage(err.message || 'Failed to load history.');
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const upsertHistoryItem = (item: WeeklyBriefHistoryItem) => {
    setHistoryItems((prev) => {
      const next = [item, ...prev.filter((existing) => existing.id !== item.id)];
      return next.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
  };

  const hydrateFromHistory = (item: WeeklyBriefHistoryItem) => {
    setSelectedHistoryId(item.id);
    setMode(item.mode);
    setWeekStart(item.weekStart || '');
    setAgenda(item.agenda || '');
    setRawUpdates(item.rawUpdates || '');
    setDigest(item.digest || []);
    setRunOfShow(item.runOfShow || []);
    setActions(item.actions || []);
    setMessage(`Loaded ${item.status} brief from ${new Date(item.updatedAt).toLocaleString()}.`);
  };

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
        throw new Error((data as any).error || 'Failed to generate weekly brief');
      }

      const brief = data as WeeklyBrief;
      setSelectedHistoryId(null);
      setDigest(brief.digest || []);
      setRunOfShow(brief.run_of_show || []);
      setActions(
        (brief.action_register || []).map((a, idx) => ({
          id: a.id || `A-${idx + 1}`,
          team: a.team,
          description: a.description,
          owner: a.owner,
          due_date: a.due_date,
          status: a.status === 'closed' ? 'closed' : 'open',
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

  const saveBrief = async (status: WeeklyBriefStatus) => {
    if (!canSave) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/weekly-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          save: true,
          id: selectedHistoryId || undefined,
          mode,
          status,
          week_start: weekStart || undefined,
          agenda,
          raw_updates: rawUpdates,
          digest: digest || [],
          run_of_show: runOfShow || [],
          action_register: actions || [],
        }),
      });

      const data = (await res.json()) as SaveResponse & { error?: string };
      if (!res.ok || data.error || !data.item) {
        throw new Error(data.error || 'Failed to save weekly brief');
      }

      upsertHistoryItem(data.item);
      setSelectedHistoryId(data.item.id);
      setMessage(status === 'published' ? 'Weekly brief published.' : 'Weekly brief saved as draft.');
    } catch (err: any) {
      setMessage(err.message || 'Failed to save weekly brief.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAction = (id: string) => {
    if (!actions) return;
    setActions(
      actions.map((a) => (a.id === id ? { ...a, status: a.status === 'open' ? 'closed' : 'open' } : a))
    );
  };

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <Link
          href="/"
          className="inline-flex items-center text-xs font-medium text-blue-700 hover:underline"
        >
          ? Back to Home
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Beacon � Weekly Initiatives</p>
            <h1 className="text-2xl font-semibold text-gray-900 mt-1">Prep and publish the weekly initiatives.</h1>
            <p className="text-sm text-gray-600">Paste updates, set the week, generate the draft, then save or publish.</p>
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
          {selectedHistoryItem && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
              {selectedHistoryItem.status.toUpperCase()} � last updated{' '}
              {new Date(selectedHistoryItem.updatedAt).toLocaleDateString()}
            </span>
          )}
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
            <div className="text-sm font-semibold text-gray-900">Last published week</div>
            <p className="text-sm text-gray-700">{lastWeekSummary}</p>
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

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={generateDraft} disabled={!rawUpdates.trim() || isGenerating || isSaving}>
            {isGenerating
              ? 'Generating...'
              : mode === 'prep'
              ? 'Generate prep draft'
              : 'Generate publish draft'}
          </Button>
          <Button variant="secondary" onClick={() => saveBrief('draft')} disabled={!canSave}>
            {isSaving ? 'Saving...' : 'Save Draft'}
          </Button>
          <Button onClick={() => saveBrief('published')} disabled={!canSave}>
            {isSaving ? 'Publishing...' : 'Mark Published'}
          </Button>
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
        </div>
        {!actions && <p className="text-sm text-gray-600">Generate a draft to see actions.</p>}
        {actions && (
          <div className="space-y-3">
            {actions.map((action) => (
              <div key={action.id} className="rounded-md border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-gray-900">
                    {action.id} � {action.team || 'General'}
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
                  Owner: {action.owner || 'Unassigned'} � Due: {action.due_date || 'TBD'} � Status: {action.status}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">History</h2>
          <Button variant="secondary" size="sm" onClick={loadHistory}>Refresh</Button>
        </div>
        {historyItems.length === 0 ? (
          <p className="text-sm text-gray-600">No saved briefs yet.</p>
        ) : (
          <div className="space-y-2">
            {historyItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => hydrateFromHistory(item)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                  selectedHistoryId === item.id
                    ? 'border-blue-300 bg-blue-50 text-blue-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {item.weekStart} � {item.mode.toUpperCase()} � {item.status.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(item.updatedAt).toLocaleString()}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
