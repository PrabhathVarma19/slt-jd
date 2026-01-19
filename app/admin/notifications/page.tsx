'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BackToHome } from '@/components/ui/back-to-home';
import { Spinner } from '@/components/ui/spinner';

type NotificationFailure = {
  id: string;
  event: string;
  status: string;
  subject?: string;
  recipients?: string[];
  errorMessage?: string;
  attempts?: number;
  createdAt: string;
  lastAttemptAt?: string | null;
};

export default function NotificationFailuresPage() {
  const router = useRouter();
  const [failures, setFailures] = useState<NotificationFailure[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('FAILED');
  const [eventFilter, setEventFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchFailures = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '25');
      params.set('domain', 'IT');
      if (statusFilter) params.set('status', statusFilter);
      if (eventFilter) params.set('event', eventFilter);

      const res = await fetch(`/api/admin/notifications/failures?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch notification failures');
      }
      const data = await res.json();
      setFailures(data.failures || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch notification failures:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [statusFilter, eventFilter]);

  useEffect(() => {
    fetchFailures();
  }, [statusFilter, eventFilter, page]);

  const retryFailure = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/notifications/failures/${id}/retry`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Retry failed');
      }
      fetchFailures();
    } catch (error) {
      console.error('Retry failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Notification failures</h1>
          <p className="mt-1 text-sm text-gray-600">
            IT Admin + Super Admin. Track and retry failed email notifications.
          </p>
        </div>
        <BackToHome />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2">
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <select
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="FAILED">Failed</option>
            <option value="SENT">Sent</option>
          </select>
          <input
            type="text"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            placeholder="Event (e.g., ticket_status_changed)"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
          />
          <Button variant="outline" onClick={fetchFailures}>
            Refresh
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <span>
          Showing page {page} of {Math.max(1, totalPages)} ({total} failures)
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Spinner />
        </div>
      ) : failures.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-gray-600">
            No notification failures yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {failures.map((failure) => (
            <Card key={failure.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{failure.event}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(failure.createdAt).toLocaleString()}
                  </p>
                  {failure.subject && (
                    <p className="mt-1 text-xs text-gray-600">{failure.subject}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{failure.status}</Badge>
                  <Badge variant="secondary">Attempts {failure.attempts || 0}</Badge>
                  {failure.status === 'FAILED' && (
                    <Button size="sm" variant="outline" onClick={() => retryFailure(failure.id)}>
                      Retry
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-gray-700">
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500">Recipients</p>
                  <p className="mt-1">{(failure.recipients || []).join(', ') || '—'}</p>
                </div>
                {failure.errorMessage && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Error</p>
                    <p className="mt-1 text-rose-600">{failure.errorMessage}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
