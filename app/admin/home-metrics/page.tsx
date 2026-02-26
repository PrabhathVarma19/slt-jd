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
    completedRuns: number;
    failedRuns: number;
    waitingApprovalRuns: number;
    activeUsers: number;
    completionRatePercent: number;
    failureRatePercent: number;
    avgCompletionMs: number | null;
  };
  byIntent: Record<string, number>;
  topTools: Array<{ tool: string; count: number }>;
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

  const avgRunsPerDay = useMemo(() => {
    if (!metrics?.summary?.totalRuns || !metrics?.periodDays) return 0;
    return Math.round((metrics.summary.totalRuns / metrics.periodDays) * 10) / 10;
  }, [metrics]);

  return (
    <div className="space-y-6">
      <BackToHome />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Beacon - Admin</p>
          <h1 className="text-2xl font-bold text-slate-900">Beacon at a glance</h1>
          <p className="text-sm text-slate-600">
            Adoption and reliability snapshot for Beacon usage.
          </p>
          {metrics?.generatedAt && (
            <p className="mt-1 text-xs text-slate-500">
              Last updated: {new Date(metrics.generatedAt).toLocaleString()}
            </p>
          )}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600">Home Commands Run</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{metrics.summary.totalRuns}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600">Active Users</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {metrics.summary.activeUsers}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600">Requests Processed</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {metrics.summary.completedRuns}
              </CardContent>
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
                <CardTitle className="text-sm text-slate-600">Failure Rate</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {metrics.summary.failureRatePercent}%
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-600">Commands / Day</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{avgRunsPerDay}</CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Tools Used</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {metrics.topTools.length === 0 ? (
                  <p className="text-slate-500">No tool calls in this window.</p>
                ) : (
                  metrics.topTools.map((item) => (
                    <div key={item.tool} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                      <span className="font-medium text-slate-700">{item.tool}</span>
                      <span className="text-slate-900">{item.count}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

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
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Approvals</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-700 space-y-2">
                <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                  <span>Approved</span>
                  <span className="font-semibold">{metrics.approval.APPROVED || 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                  <span>Rejected</span>
                  <span className="font-semibold">{metrics.approval.REJECTED || 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                  <span>Pending</span>
                  <span className="font-semibold">{metrics.approval.PENDING || 0}</span>
                </div>
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
