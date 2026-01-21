'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BackToHome } from '@/components/ui/back-to-home';
import { Spinner } from '@/components/ui/spinner';
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  Filter,
  Gauge,
  RefreshCw,
  Users,
} from 'lucide-react';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type Status =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_ON_REQUESTER'
  | 'RESOLVED'
  | 'CLOSED'
  | 'PENDING_APPROVAL';

interface AnalyticsResponse {
  range: { start: string; end: string };
  summary: {
    total: number;
    open: number;
    backlog: number;
    unassigned: number;
    slaBreached: number;
    slaOnTrack: number;
  };
  metrics: {
    avgMttaMinutes: number;
    avgMttrMinutes: number;
    reopenRatePercent: number;
    fcrRatePercent: number;
    reopenCount: number;
    fcrCount: number;
  };
  breakdowns: {
    byStatus: Record<Status, number>;
    byPriority: Record<Priority, number>;
    byCategory: Record<string, number>;
    bySubcategory: Record<string, number>;
  };
  trends: Array<{ day: string; opened: number; resolved: number }>;
  trendsSlaBreaches: Array<{ day: string; breached: number }>;
  trendsMtta: Array<{ day: string; minutes: number }>;
  trendsMttr: Array<{ day: string; minutes: number }>;
  backlogAging: Record<string, number>;
  topAgentFailures: Array<{
    agent: string;
    intent: string | null;
    tool: string | null;
    total: number;
    failures: number;
    failureRate: number;
  }>;
  comparison: {
    total: { current: number; previous: number };
    resolved: { current: number; previous: number };
    breached: { current: number; previous: number };
  };
  sla: {
    byPriority: Array<{
      priority: Priority;
      total: number;
      breached: number;
      targetMinutes: number;
    }>;
  };
  leaderboard: Array<{
    id: string;
    name: string;
    email: string;
    assigned: number;
    resolved: number;
    breached: number;
    avgResolutionMinutes: number;
  }>;
  engineerWorkload: Array<{
    id: string;
    name: string;
    email: string;
    open: number;
    resolved: number;
  }>;
  tickets: Array<{
    id: string;
    ticketNumber: string;
    title: string;
    status: Status;
    priority: Priority;
    category: string;
    subcategory: string;
    createdAt: string;
    resolvedAt?: string;
    closedAt?: string;
    projectCode?: string;
    projectName?: string;
    requesterName: string;
    requesterEmail: string;
    assigneeName: string;
    assigneeEmail: string;
    slaTargetMinutes: number;
    slaElapsedMinutes: number;
    slaBreached: boolean;
  }>;
  slaConfig: Record<Priority, number>;
  recentActivity: Array<{
    id: string;
    type: string;
    createdAt: string;
    ticketNumber: string;
    ticketTitle: string;
    creatorName: string;
    creatorEmail: string;
    payload?: any;
  }>;
}

interface Engineer {
  id: string;
  email: string;
  name?: string;
}

const STATUS_LABELS: Record<Status, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  WAITING_ON_REQUESTER: 'Waiting on Requester',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  PENDING_APPROVAL: 'Pending Approval',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  URGENT: 'Urgent',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

const formatDuration = (minutes: number) => {
  if (!minutes) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const deltaLabel = (current: number, previous: number) => {
  if (previous === 0) {
    return current === 0 ? '0%' : 'New';
  }
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change > 0 ? '+' : ''}${change}%`;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [slaDraft, setSlaDraft] = useState<Record<Priority, number> | null>(null);
  const [savingSla, setSavingSla] = useState(false);
  const [autoClosing, setAutoClosing] = useState(false);
  const [runningSlaJob, setRunningSlaJob] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [filters, setFilters] = useState({
    range: '30d',
    start: '',
    end: '',
    status: '',
    priority: '',
    category: '',
    subcategory: '',
    engineerId: '',
    projectCode: '',
  });

  useEffect(() => {
    const fetchEngineers = async () => {
      try {
        const res = await fetch('/api/admin/engineers');
        if (res.ok) {
          const data = await res.json();
          setEngineers(
            (data.engineers || []).map((engineer: any) => ({
              id: engineer.id,
              email: engineer.email,
              name: engineer.profile?.empName || engineer.email?.split('@')[0],
            }))
          );
        }
      } catch (err) {
        console.error('Failed to fetch engineers:', err);
      }
    };

    const fetchSlaConfig = async () => {
      try {
        const res = await fetch('/api/admin/sla-config');
        if (res.ok) {
          const data = await res.json();
          setSlaDraft(data.config);
        }
      } catch (err) {
        console.error('Failed to fetch SLA config:', err);
      }
    };

    fetchEngineers();
    fetchSlaConfig();
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.set('range', filters.range);
        if (filters.range === 'custom') {
          if (filters.start) params.set('start', filters.start);
          if (filters.end) params.set('end', filters.end);
        }
        if (filters.status) params.set('status', filters.status);
        if (filters.priority) params.set('priority', filters.priority);
        if (filters.category) params.set('category', filters.category);
        if (filters.subcategory) params.set('subcategory', filters.subcategory);
        if (filters.engineerId) params.set('engineerId', filters.engineerId);
        if (filters.projectCode) params.set('projectCode', filters.projectCode);

        const res = await fetch(`/api/admin/analytics?${params.toString()}`);
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            router.push('/login');
            return;
          }
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch analytics');
        }
        const data = await res.json();
        setAnalytics(data);
        if (!slaDraft) {
          setSlaDraft(data.slaConfig);
        }
      } catch (err: any) {
        console.error('Analytics fetch failed:', err);
        setError(err.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [
    filters.range,
    filters.start,
    filters.end,
    filters.status,
    filters.priority,
    filters.category,
    filters.subcategory,
    filters.engineerId,
    filters.projectCode,
    router,
    refreshToken,
  ]);

  const categoryOptions = useMemo(() => {
    const categories = analytics ? Object.keys(analytics.breakdowns.byCategory) : [];
    return categories.sort();
  }, [analytics]);

  const subcategoryOptions = useMemo(() => {
    const subcategories = analytics ? Object.keys(analytics.breakdowns.bySubcategory) : [];
    return subcategories.sort();
  }, [analytics]);

  const handleExport = () => {
    if (!analytics) return;
    const header = [
      'Ticket Number',
      'Title',
      'Status',
      'Priority',
      'Category',
      'Subcategory',
      'Created At',
      'Resolved At',
      'Requester',
      'Requester Email',
      'Assignee',
      'Assignee Email',
      'SLA Target (min)',
      'SLA Elapsed (min)',
      'SLA Breached',
      'Project Code',
      'Project Name',
    ];

    const rows = analytics.tickets.map((ticket) => [
      ticket.ticketNumber,
      `"${ticket.title.replace(/"/g, '""')}"`,
      ticket.status,
      ticket.priority,
      ticket.category,
      ticket.subcategory,
      ticket.createdAt,
      ticket.resolvedAt || ticket.closedAt || '',
      ticket.requesterName,
      ticket.requesterEmail,
      ticket.assigneeName,
      ticket.assigneeEmail,
      ticket.slaTargetMinutes,
      ticket.slaElapsedMinutes,
      ticket.slaBreached ? 'Yes' : 'No',
      ticket.projectCode || '',
      ticket.projectName || '',
    ]);

    const csv = [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `it-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const handleSlaSave = async () => {
    if (!slaDraft) return;
    try {
      setSavingSla(true);
      const res = await fetch('/api/admin/sla-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slaDraft),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update SLA config');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update SLA config');
    } finally {
      setSavingSla(false);
    }
  };

  const handleAutoClose = async () => {
    try {
      setAutoClosing(true);
      const res = await fetch('/api/admin/tickets/auto-close', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Auto-close failed');
      }
    } catch (err: any) {
      alert(err.message || 'Auto-close failed');
    } finally {
      setAutoClosing(false);
    }
  };

  const handleRunSlaJob = async () => {
    try {
      setRunningSlaJob(true);
      const res = await fetch('/api/admin/notifications/run-sla', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'SLA job failed');
      }
    } catch (err: any) {
      alert(err.message || 'SLA job failed');
    } finally {
      setRunningSlaJob(false);
    }
  };

  if (loading && !analytics) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Spinner className="mx-auto mb-4" />
          <p className="text-sm text-gray-600">Loading IT analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics && error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-gray-600">{error}</p>
          <Button onClick={() => router.refresh()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const trendMax = analytics
    ? Math.max(1, ...analytics.trends.map((point) => Math.max(point.opened, point.resolved)))
    : 1;
  const slaTrendMax = analytics
    ? Math.max(1, ...analytics.trendsSlaBreaches.map((point) => point.breached))
    : 1;
  const mttaTrendMax = analytics
    ? Math.max(1, ...analytics.trendsMtta.map((point) => Number(point.minutes || 0)))
    : 1;
  const mttrTrendMax = analytics
    ? Math.max(1, ...analytics.trendsMttr.map((point) => Number(point.minutes || 0)))
    : 1;
  const chartHeight = 176;
  const compactChartHeight = 128;
  const hasMttaTrendData = analytics
    ? analytics.trendsMtta.some((point) => point.minutes > 0) ||
      analytics.trendsMttr.some((point) => point.minutes > 0)
    : false;
  const hasSlaTrendData = analytics
    ? analytics.trendsSlaBreaches.some((point) => point.breached > 0)
    : false;
  const labelStride = analytics ? Math.max(1, Math.ceil(analytics.trends.length / 12)) : 1;
  const labelStrideWide = analytics ? Math.max(1, Math.ceil(analytics.trends.length / 10)) : 1;
  const labelStrideCompact = analytics ? Math.max(1, Math.ceil(analytics.trends.length / 6)) : 1;
  const hasTrendData = analytics
    ? analytics.trends.some((point) => point.opened > 0 || point.resolved > 0)
    : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Badge variant="outline" className="bg-white/80">
              IT Admin Analytics
            </Badge>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {analytics ? formatDate(analytics.range.start) : ''} -{' '}
              {analytics ? formatDate(analytics.range.end) : ''}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold text-gray-900">Service Desk Performance</h1>
          <p className="mt-1 text-sm text-gray-600">
            SLA health, request volume, and operational load for IT support.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full bg-slate-100 p-1">
            <Button asChild size="sm" variant="secondary" className="rounded-full">
              <Link href="/admin/dashboard">Overview</Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className="rounded-full">
              <Link href="/admin/dashboard/insights">Insights</Link>
            </Button>
          </div>
          <Button variant="outline" onClick={() => setRefreshToken((value) => value + 1)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <BackToHome />
        </div>
      </div>

      <Card className="animate-in fade-in slide-in-from-bottom-2">
        <CardHeader className="flex flex-col gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-4 w-4 text-blue-600" />
            Filters
          </CardTitle>
          <p className="text-sm text-gray-600">
            Adjust the date range and slice by priority, status, or owner.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            <label className="space-y-1 text-sm text-gray-600">
              Date range
              <select
                className="w-full rounded-md border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-900"
                value={filters.range}
                onChange={(e) => setFilters({ ...filters, range: e.target.value })}
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            {filters.range === 'custom' && (
              <>
                <label className="space-y-1 text-sm text-gray-600">
                  Start date
                  <input
                    type="date"
                    className="w-full rounded-md border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-900"
                    value={filters.start}
                    onChange={(e) => setFilters({ ...filters, start: e.target.value })}
                  />
                </label>
                <label className="space-y-1 text-sm text-gray-600">
                  End date
                  <input
                    type="date"
                    className="w-full rounded-md border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-900"
                    value={filters.end}
                    onChange={(e) => setFilters({ ...filters, end: e.target.value })}
                  />
                </label>
              </>
            )}
            <label className="space-y-1 text-sm text-gray-600">
              Status
              <select
                className="w-full rounded-md border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-900"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All statuses</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-gray-600">
              Priority
              <select
                className="w-full rounded-md border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-900"
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              >
                <option value="">All priorities</option>
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-gray-600">
              Category
              <select
                className="w-full rounded-md border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-900"
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              >
                <option value="">All categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-gray-600">
              Subcategory
              <select
                className="w-full rounded-md border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-900"
                value={filters.subcategory}
                onChange={(e) => setFilters({ ...filters, subcategory: e.target.value })}
              >
                <option value="">All subcategories</option>
                {subcategoryOptions.map((subcategory) => (
                  <option key={subcategory} value={subcategory}>
                    {subcategory}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-gray-600">
              Engineer
              <select
                className="w-full rounded-md border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-900"
                value={filters.engineerId}
                onChange={(e) => setFilters({ ...filters, engineerId: e.target.value })}
              >
                <option value="">All engineers</option>
                {engineers.map((engineer) => (
                  <option key={engineer.id} value={engineer.id}>
                    {engineer.name || engineer.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-gray-600">
              Project code
              <input
                type="text"
                className="w-full rounded-md border border-gray-200 bg-white/70 px-3 py-2 text-sm text-gray-900"
                value={filters.projectCode}
                onChange={(e) => setFilters({ ...filters, projectCode: e.target.value })}
                placeholder="IT-Project-01"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {analytics && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="animate-in fade-in slide-in-from-bottom-2">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total tickets</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">{analytics.summary.total}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="animate-in fade-in slide-in-from-bottom-2">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Open backlog</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">{analytics.summary.backlog}</p>
                  </div>
                  <Users className="h-8 w-8 text-indigo-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="animate-in fade-in slide-in-from-bottom-2">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">SLA breached</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">{analytics.summary.slaBreached}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="animate-in fade-in slide-in-from-bottom-2">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Unassigned</p>
                    <p className="mt-1 text-2xl font-semibold text-gray-900">{analytics.summary.unassigned}</p>
                  </div>
                  <Gauge className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

            <Card className="animate-in fade-in slide-in-from-bottom-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-4 w-4 text-blue-600" />
                  MTTA / MTTR trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasMttaTrendData ? (
                  <>
                    <div className="flex h-32 items-end gap-2">
                      {analytics.trendsMtta.map((point, index) => {
                        const mttaMinutes = Number(point.minutes || 0);
                        const mttrMinutes = Number(analytics.trendsMttr[index]?.minutes || 0);
                        const mttaHeight =
                          mttaMinutes > 0 && Number.isFinite(mttaMinutes)
                            ? Math.max(6, (mttaMinutes / mttaTrendMax) * compactChartHeight)
                            : 0;
                        const mttrHeight =
                          mttrMinutes > 0 && Number.isFinite(mttrMinutes)
                            ? Math.max(6, (mttrMinutes / mttrTrendMax) * compactChartHeight)
                            : 0;
                        return (
                          <div key={point.day} className="flex flex-1 flex-col items-center">
                            <div className="flex w-full items-end gap-1" style={{ height: `${compactChartHeight}px` }}>
                              <div
                                className="w-1/2 rounded-t bg-sky-500/80"
                                style={{ height: `${mttaHeight}px` }}
                                title={`MTTA: ${point.minutes}m`}
                              />
                              <div
                                className="w-1/2 rounded-t bg-indigo-500/80"
                                style={{ height: `${mttrHeight}px` }}
                                title={`MTTR: ${analytics.trendsMttr[index]?.minutes || 0}m`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div
                      className="mt-2 grid text-[10px] text-gray-500 tabular-nums leading-none"
                      style={{ gridTemplateColumns: `repeat(${analytics.trendsMtta.length}, minmax(0, 1fr))` }}
                    >
                      {analytics.trendsMtta.map((point, index) => (
                        <span
                          key={point.day}
                          className={`whitespace-nowrap text-center ${
                            index % labelStrideCompact === 0 ? 'text-gray-500' : 'text-transparent'
                          }`}
                        >
                          {point.day.slice(5).replace('-', '/')}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex h-32 items-center justify-center text-xs text-gray-500">
                    No MTTA / MTTR events in this range yet.
                  </div>
                )}
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-sky-500/80" />
                    MTTA
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-indigo-500/80" />
                    MTTR
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-in fade-in slide-in-from-bottom-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  SLA breach trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasSlaTrendData ? (
                  <>
                    <div className="flex h-32 items-end gap-2">
                      {analytics.trendsSlaBreaches.map((point) => {
                        const breachCount = Number(point.breached || 0);
                        const height =
                          breachCount > 0 && Number.isFinite(breachCount)
                            ? Math.max(6, (breachCount / slaTrendMax) * compactChartHeight)
                            : 0;
                        return (
                          <div key={point.day} className="flex flex-1 flex-col items-center">
                            <div className="flex w-full items-end" style={{ height: `${compactChartHeight}px` }}>
                              <div
                                className="w-full rounded-t bg-rose-500/80"
                                style={{ height: `${height}px` }}
                                title={`Breached: ${point.breached}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div
                      className="mt-2 grid text-[10px] text-gray-500 tabular-nums leading-none"
                      style={{ gridTemplateColumns: `repeat(${analytics.trendsSlaBreaches.length}, minmax(0, 1fr))` }}
                    >
                      {analytics.trendsSlaBreaches.map((point, index) => (
                        <span
                          key={point.day}
                          className={`whitespace-nowrap text-center ${
                            index % labelStrideCompact === 0 ? 'text-gray-500' : 'text-transparent'
                          }`}
                        >
                          {point.day.slice(5).replace('-', '/')}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex h-32 items-center justify-center text-xs text-gray-500">
                    No SLA breaches in this range.
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          <div className="grid gap-4">
            <Card className="animate-in fade-in slide-in-from-bottom-2">
              <CardHeader>
                <CardTitle className="text-lg">Ticket flow</CardTitle>
                <p className="text-sm text-gray-600">Daily opened vs resolved.</p>
              </CardHeader>
              <CardContent>
                {hasTrendData ? (
                  <div className="w-full overflow-hidden">
                    <div className="flex h-44 items-end gap-2">
                      {analytics.trends.map((point) => {
                        const openedHeight =
                          point.opened > 0
                            ? Math.max(6, (point.opened / trendMax) * chartHeight)
                            : 0;
                        const resolvedHeight =
                          point.resolved > 0
                            ? Math.max(6, (point.resolved / trendMax) * chartHeight)
                            : 0;
                        return (
                          <div key={point.day} className="flex flex-1 flex-col items-center">
                            <div className="flex w-full items-end gap-1" style={{ height: `${chartHeight}px` }}>
                              <div
                                className="w-1/2 rounded-t bg-blue-500/80"
                                style={{ height: `${openedHeight}px` }}
                                title={`Opened: ${point.opened}`}
                              />
                              <div
                                className="w-1/2 rounded-t bg-emerald-500/80"
                                style={{ height: `${resolvedHeight}px` }}
                                title={`Resolved: ${point.resolved}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                      <div
                        className="mt-2 grid text-[10px] text-gray-500 tabular-nums leading-none"
                        style={{ gridTemplateColumns: `repeat(${analytics.trends.length}, minmax(0, 1fr))` }}
                      >
                        {analytics.trends.map((point, index) => (
                          <span
                            key={point.day}
                            className={`whitespace-nowrap text-center ${
                              index % labelStrideWide === 0 ? 'text-gray-500' : 'text-transparent'
                            }`}
                          >
                            {point.day.slice(5).replace('-', '/')}
                          </span>
                        ))}
                      </div>
                  </div>
                ) : (
                  <div className="flex h-44 items-center justify-center text-sm text-gray-500">
                    No ticket activity in this range yet.
                  </div>
                )}
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-blue-500/80" />
                    Opened
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
                    Resolved
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

        </>
      )}
    </div>
  );
}
