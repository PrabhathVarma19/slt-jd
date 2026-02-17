'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BackToHome } from '@/components/ui/back-to-home';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type MetricsResponse = {
  periodDays: number;
  generatedAt: string;
  summary: {
    totalRuns: number;
    avgCompletionMs: number | null;
  };
  byIntent: Record<string, number>;
  approval: Record<string, number>;
  status: Record<string, number>;
  topMissingFields: Array<{ field: string; count: number }>;
  topErrors: Array<{ message: string; count: number }>;
};

function formatMs(ms: number | null) {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms} ms`;
  const seconds = Math.round(ms / 100) / 10;
  return `${seconds}s`;
}

export default function HomeMetricsPage() {
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/home/metrics?days=${days}`);
        const data = await res.json();
        if (!res.ok || data?.error) {
          throw new Error(data?.error || 'Failed to load metrics');
        }
        setMetrics(data);
      } catch (err: any) {
        setError(err?.message || 'Failed to load metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [days]);

  const topIntents = useMemo(() => {
    const entries = Object.entries(metrics?.byIntent || {});
    return entries.sort((a, b) => b[1] - a[1]);
  }, [metrics]);

  return (
    <div className="space-y-6">
      <BackToHome />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Home Command Metrics</h1>
          <p className="text-sm text-slate-600">
            Super Admin view of home-orchestrator usage and reliability.
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 60].map((d) => (
            <Button
              key={d}
              variant={days === d ? 'default' : 'outline'}
              onClick={() => setDays(d)}
              size="sm"
            >
              {d}d
            </Button>
          ))}
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/dashboard">Open Dashboard</Link>
          </Button>
        </div>
      </div>

      {loading && (
        <Card>
          <CardContent className="py-8 text-sm text-slate-600">Loading metrics...</CardContent>
        </Card>
      )}

      {error && !loading && (
        <Card>
          <CardContent className="py-8 text-sm text-red-600">{error}</CardContent>
        </Card>
      )}

      {!loading && !error && metrics && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600">Total Runs</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{metrics.summary.totalRuns}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600">Avg Completion</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatMs(metrics.summary.avgCompletionMs)}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600">Approvals</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-700 space-y-1">
                <p>Approved: {metrics.approval.APPROVED || 0}</p>
                <p>Rejected: {metrics.approval.REJECTED || 0}</p>
                <p>Pending: {metrics.approval.PENDING || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600">Run Status</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-700 space-y-1">
                <p>Completed: {metrics.status.COMPLETED || 0}</p>
                <p>Failed: {metrics.status.FAILED || 0}</p>
                <p>Cancelled: {metrics.status.CANCELLED || 0}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Intent Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {topIntents.map(([intent, count]) => (
                  <div key={intent} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                    <span className="font-medium text-slate-700">{intent}</span>
                    <span className="text-slate-900">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Missing Fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {metrics.topMissingFields.length === 0 ? (
                  <p className="text-slate-500">No missing field events in this window.</p>
                ) : (
                  metrics.topMissingFields.map((item) => (
                    <div
                      key={item.field}
                      className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
                    >
                      <span className="font-medium text-slate-700">{item.field}</span>
                      <span className="text-slate-900">{item.count}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Errors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {metrics.topErrors.length === 0 ? (
                <p className="text-slate-500">No run errors in this window.</p>
              ) : (
                metrics.topErrors.map((item) => (
                  <div key={item.message} className="rounded-md bg-rose-50 px-3 py-2 text-rose-900">
                    <p className="font-medium">{item.message}</p>
                    <p className="text-xs opacity-80">Count: {item.count}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
