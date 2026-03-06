'use client';

import { useEffect, useMemo, useState } from 'react';
import { BackToHome } from '@/components/ui/back-to-home';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

type SharePointSource = {
  id: string;
  name: string;
  category: string;
  site_url: string;
  library_name: string;
  folder_path: string | null;
  site_id: string | null;
  drive_id: string | null;
  enabled: boolean;
  last_synced_at: string | null;
  created_at: string;
};


const CATEGORY_OPTIONS = ['it', 'hr', 'infosec'];

function formatDate(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

async function parseApiResponse(response: Response): Promise<any> {
  const bodyText = await response.text().catch(() => '');

  if (!bodyText) {
    return {};
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const likelyHtml = bodyText.trim().startsWith('<!DOCTYPE') || bodyText.trim().startsWith('<html');

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(bodyText);
    } catch {
      throw new Error('Server returned invalid JSON.');
    }
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    if (likelyHtml) {
      throw new Error(
        response.ok
          ? 'Server returned HTML instead of JSON. Please refresh and try again.'
          : 'Server returned HTML error page (session/proxy error). Please refresh and retry.'
      );
    }

    if (!response.ok) {
      throw new Error(`Request failed (${response.status}): ${bodyText.slice(0, 220)}`);
    }

    return {};
  }
}

export default function AdminSharePointPage() {
  const [sources, setSources] = useState<SharePointSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('it');
  const [siteUrl, setSiteUrl] = useState('');
  const [libraryName, setLibraryName] = useState('');
  const [folderPath, setFolderPath] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncAllLoading, setSyncAllLoading] = useState(false);

  const [lastCreatedIds, setLastCreatedIds] = useState<{ siteId: string; driveId: string } | null>(null);
  const [rowStatus, setRowStatus] = useState<Record<string, string>>({});

  const sortedSources = useMemo(
    () => [...sources].sort((a, b) => a.name.localeCompare(b.name)),
    [sources]
  );

  const fetchSources = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/sharepoint/sources');
      const payload = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load sources');
      }

      setSources(payload.sources || []);
    } catch (fetchError: any) {
      setError(fetchError?.message || 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleAddSource = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    setError(null);
    setLastCreatedIds(null);

    try {
      setSubmitting(true);
      const response = await fetch('/api/admin/sharepoint/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          category,
          site_url: siteUrl,
          library_name: libraryName,
          folder_path: folderPath || null,
        }),
      });

      const payload = await parseApiResponse(response);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to create source');
      }

      setSources((prev) => [payload.source, ...prev]);
      setFeedback('Source added successfully.');
      setLastCreatedIds({
        siteId: payload.source?.site_id || '-',
        driveId: payload.source?.drive_id || '-',
      });

      setName('');
      setCategory('it');
      setSiteUrl('');
      setLibraryName('');
      setFolderPath('');
    } catch (submitError: any) {
      setError(submitError?.message || 'Failed to create source');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncOne = async (sourceId: string) => {
    setFeedback(null);
    setError(null);

    try {
      setSyncingId(sourceId);
      const response = await fetch(`/api/admin/sharepoint/sources/${sourceId}/sync`, {
        method: 'POST',
      });
      const payload = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to sync source');
      }

      const summary = `Synced ${payload.synced} file(s), skipped ${payload.skipped}.`;
      setRowStatus((prev) => ({ ...prev, [sourceId]: summary }));
      setFeedback(`${payload.sourceName}: ${summary}`);
      await fetchSources();
    } catch (syncError: any) {
      const message = syncError?.message || 'Failed to sync source';
      setRowStatus((prev) => ({ ...prev, [sourceId]: message }));
      setError(message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    setFeedback(null);
    setError(null);

    try {
      setSyncAllLoading(true);
      const response = await fetch('/api/admin/sharepoint/sync-all', {
        method: 'POST',
      });
      const payload = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to sync all sources');
      }

      const successCount = (payload.results || []).filter((item: any) => item.success).length;
      const failureCount = (payload.results || []).length - successCount;
      setFeedback(`Sync-all finished: ${successCount} success, ${failureCount} failed.`);
      await fetchSources();
    } catch (syncAllError: any) {
      setError(syncAllError?.message || 'Failed to sync all sources');
    } finally {
      setSyncAllLoading(false);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    setFeedback(null);
    setError(null);

    try {
      setDeletingId(sourceId);
      const response = await fetch(`/api/admin/sharepoint/sources/${sourceId}`, {
        method: 'DELETE',
      });
      const payload = await parseApiResponse(response);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete source');
      }

      setSources((prev) => prev.filter((source) => source.id !== sourceId));
      setFeedback('Source deleted.');
    } catch (deleteError: any) {
      setError(deleteError?.message || 'Failed to delete source');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <BackToHome />

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Beacon - Admin</p>
          <h1 className="text-2xl font-bold text-slate-900">SharePoint Sources</h1>
          <p className="text-sm text-slate-600">
            Register SharePoint libraries/folders and sync them into the local policy knowledge base.
          </p>
        </div>
        <Button onClick={handleSyncAll} disabled={syncAllLoading || loading}>
          {syncAllLoading ? (
            <>
              <Spinner className="h-4 w-4" />
              Syncing...
            </>
          ) : (
            'Sync All'
          )}
        </Button>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {feedback && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{feedback}</div>}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add New Source</CardTitle>
          <CardDescription>
            Site + library IDs are resolved automatically when you save.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleAddSource}>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="IT Policies" required />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">SharePoint Site URL</label>
              <Input
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://trianz365.sharepoint.com/sites/assurance"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Library Name</label>
              <Input
                value={libraryName}
                onChange={(e) => setLibraryName(e.target.value)}
                placeholder="Information Systems"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Folder Path (optional)</label>
              <Input
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="01_Procedure"
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  'Add Source'
                )}
              </Button>
              {lastCreatedIds && (
                <p className="text-xs text-slate-600">
                  Site ID: <span className="font-mono">{lastCreatedIds.siteId}</span> | Drive ID:{' '}
                  <span className="font-mono">{lastCreatedIds.driveId}</span>
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Existing Sources</CardTitle>
          <CardDescription>Sync or remove individual sources.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-600">Loading sources...</div>
          ) : sortedSources.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-600">No sources configured yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-600">
                    <th className="px-2 py-2 font-medium">Name</th>
                    <th className="px-2 py-2 font-medium">Category</th>
                    <th className="px-2 py-2 font-medium">Site URL</th>
                    <th className="px-2 py-2 font-medium">Library</th>
                    <th className="px-2 py-2 font-medium">Folder</th>
                    <th className="px-2 py-2 font-medium">Last Synced</th>
                    <th className="px-2 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSources.map((source) => (
                    <tr key={source.id} className="border-b align-top">
                      <td className="px-2 py-3">
                        <div className="font-medium text-slate-900">{source.name}</div>
                        {rowStatus[source.id] && (
                          <div className="text-xs text-slate-500">{rowStatus[source.id]}</div>
                        )}
                      </td>
                      <td className="px-2 py-3 uppercase">{source.category}</td>
                      <td className="px-2 py-3 max-w-[280px] break-all">{source.site_url}</td>
                      <td className="px-2 py-3">{source.library_name}</td>
                      <td className="px-2 py-3">{source.folder_path || '-'}</td>
                      <td className="px-2 py-3">{formatDate(source.last_synced_at)}</td>
                      <td className="px-2 py-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSyncOne(source.id)}
                            disabled={syncingId === source.id || deletingId === source.id}
                          >
                            {syncingId === source.id ? 'Syncing...' : 'Sync'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteSource(source.id)}
                            disabled={syncingId === source.id || deletingId === source.id}
                          >
                            {deletingId === source.id ? 'Deleting...' : 'Delete'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
