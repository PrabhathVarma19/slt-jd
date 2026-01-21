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
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showWorkloadModal, setShowWorkloadModal] = useState(false);
  const [showFailuresModal, setShowFailuresModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [ticketModalFilters, setTicketModalFilters] = useState({
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
  const [activityModalFilters, setActivityModalFilters] = useState({
    range: '30d',
    start: '',
    end: '',
    type: '',
    user: '',
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
  const activityTypeOptions = useMemo(() => {
    const types = analytics ? analytics.recentActivity.map((item) => item.type) : [];
    return Array.from(new Set(types)).sort();
  }, [analytics]);
  const activityUserOptions = useMemo(() => {
    const users = analytics
      ? analytics.recentActivity.map((item) => item.creatorName || item.creatorEmail)
      : [];
    return Array.from(new Set(users.filter(Boolean))).sort();
  }, [analytics]);
  const engineerEmailById = useMemo(() => {
    const map = new Map<string, string>();
    engineers.forEach((engineer) => {
      if (engineer.id && engineer.email) {
        map.set(engineer.id, engineer.email.toLowerCase());
      }
    });
    return map;
  }, [engineers]);

  const resolveRange = (range: string, start: string, end: string) => {
    const now = new Date();
    const endDate = range === 'custom' && end ? new Date(end) : now;
    const startDate =
      range === 'custom' && start
        ? new Date(start)
        : new Date(now.getTime() - (range === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000);
    endDate.setHours(23, 59, 59, 999);
    startDate.setHours(0, 0, 0, 0);
    return { startDate, endDate };
  };

  const filteredLedgerTickets = useMemo(() => {
    if (!analytics) return [];
    const { range, start, end, status, priority, category, subcategory, engineerId, projectCode } =
      ticketModalFilters;
    const { startDate, endDate } = resolveRange(range, start, end);
    const engineerEmail = engineerId ? engineerEmailById.get(engineerId) : '';
    return analytics.tickets.filter((ticket) => {
      const createdAt = new Date(ticket.createdAt);
      if (createdAt < startDate || createdAt > endDate) return false;
      if (status && ticket.status !== status) return false;
      if (priority && ticket.priority !== priority) return false;
      if (category && ticket.category !== category) return false;
      if (subcategory && ticket.subcategory !== subcategory) return false;
      if (projectCode && !ticket.projectCode?.toLowerCase().includes(projectCode.toLowerCase()))
        return false;
      if (
        engineerEmail &&
        ticket.assigneeEmail &&
        ticket.assigneeEmail.toLowerCase() !== engineerEmail
      )
        return false;
      return true;
    });
  }, [analytics, engineerEmailById, ticketModalFilters]);

  const filteredActivity = useMemo(() => {
    if (!analytics) return [];
    const { range, start, end, type, user } = activityModalFilters;
    const { startDate, endDate } = resolveRange(range, start, end);
    return analytics.recentActivity.filter((activity) => {
      const createdAt = new Date(activity.createdAt);
      if (createdAt < startDate || createdAt > endDate) return false;
      if (type && activity.type !== type) return false;
      if (user) {
        const target = user.toLowerCase();
        const name = (activity.creatorName || '').toLowerCase();
        const email = (activity.creatorEmail || '').toLowerCase();
        if (!name.includes(target) && !email.includes(target)) return false;
      }
      return true;
    });
  }, [analytics, activityModalFilters]);

  const ledgerPreview = analytics ? analytics.tickets.slice(0, 6) : [];
  const recentActivityPreview = analytics ? analytics.recentActivity.slice(0, 6) : [];
  const leaderboardPreview = analytics ? analytics.leaderboard.slice(0, 6) : [];
  const workloadPreview = analytics ? analytics.engineerWorkload.slice(0, 6) : [];
  const failuresPreview = analytics ? analytics.topAgentFailures.slice(0, 6) : [];
  const categoryPreview = analytics
    ? Object.entries(analytics.breakdowns.byCategory)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
    : [];
  const categoryList = analytics
    ? Object.entries(analytics.breakdowns.byCategory).sort((a, b) => b[1] - a[1])
    : [];

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
          <h1 className="mt-2 text-3xl font-semibold text-gray-900">Operational Insights</h1>
          <p className="mt-1 text-sm text-gray-600">
            Deep dives into quality, workload, and SLA drivers for IT support.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full bg-slate-100 p-1">
            <Button asChild size="sm" variant="ghost" className="rounded-full">
              <Link href="/admin/dashboard">Overview</Link>
            </Button>
            <Button asChild size="sm" variant="secondary" className="rounded-full">
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
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="animate-in fade-in slide-in-from-bottom-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <RefreshCw className="h-4 w-4 text-rose-600" />
                  Quality rates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white/70 p-3">
                  <div>
                    <p className="text-xs text-gray-500">Reopen rate</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900">
                      {analytics.metrics.reopenRatePercent}%
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {analytics.metrics.reopenCount} reopened
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white/70 p-3">
                  <div>
                    <p className="text-xs text-gray-500">First-contact resolution</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900">
                      {analytics.metrics.fcrRatePercent}%
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {analytics.metrics.fcrCount} closed
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-in fade-in slide-in-from-bottom-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Gauge className="h-4 w-4 text-amber-600" />
                  Backlog aging
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(analytics.backlogAging).map(([bucket, count]) => (
                  <div key={bucket} className="flex items-center justify-between text-sm text-gray-700">
                    <span className="text-xs text-gray-500">{bucket} days</span>
                    <span className="font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="animate-in fade-in slide-in-from-bottom-2">
              <CardHeader>
                <CardTitle className="text-lg">Momentum</CardTitle>
                <p className="text-sm text-gray-600">Current range vs previous period.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white/70 p-4">
                  <div>
                    <p className="text-xs text-gray-500">Tickets created</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900">
                      {analytics.comparison.total.current}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-blue-600">
                    {deltaLabel(
                      analytics.comparison.total.current,
                      analytics.comparison.total.previous
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white/70 p-4">
                  <div>
                    <p className="text-xs text-gray-500">Tickets resolved</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900">
                      {analytics.comparison.resolved.current}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">
                    {deltaLabel(
                      analytics.comparison.resolved.current,
                      analytics.comparison.resolved.previous
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white/70 p-4">
                  <div>
                    <p className="text-xs text-gray-500">SLA breaches</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900">
                      {analytics.comparison.breached.current}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-rose-600">
                    {deltaLabel(
                      analytics.comparison.breached.current,
                      analytics.comparison.breached.previous
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="animate-in fade-in slide-in-from-bottom-2 lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="h-4 w-4 text-blue-600" />
                  MTTA / MTTR
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-gray-100 bg-white/70 p-4">
                  <p className="text-xs text-gray-500">Mean time to acknowledge</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-900">
                    {formatDuration(analytics.metrics.avgMttaMinutes)}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-100 bg-white/70 p-4">
                  <p className="text-xs text-gray-500">Mean time to resolve</p>
                  <p className="mt-2 text-2xl font-semibold text-gray-900">
                    {formatDuration(analytics.metrics.avgMttrMinutes)}
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  SLA clock pauses when tickets are waiting on requester.
                </div>
              </CardContent>
            </Card>
            <Card className="animate-in fade-in slide-in-from-bottom-2 lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Tickets by status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(analytics.breakdowns.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between gap-3">
                    <Badge variant="outline" className="min-w-[140px] justify-center bg-white/70">
                      {STATUS_LABELS[status as Status]}
                    </Badge>
                    <div className="flex flex-1 items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-blue-600"
                          style={{
                            width: analytics.summary.total
                              ? `${(count / analytics.summary.total) * 100}%`
                              : '0%',
                          }}
                        />
                      </div>
                      <span className="w-10 text-right text-sm font-semibold text-gray-900">{count}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="animate-in fade-in slide-in-from-bottom-2">
              <CardHeader>
                <CardTitle className="text-lg">Tickets by priority</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(analytics.breakdowns.byPriority).map(([priority, count]) => (
                  <div key={priority} className="flex items-center justify-between gap-3">
                    <Badge variant="outline" className="min-w-[100px] justify-center bg-white/70">
                      {PRIORITY_LABELS[priority as Priority]}
                    </Badge>
                    <div className="flex flex-1 items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-indigo-600"
                          style={{
                            width: analytics.summary.total
                              ? `${(count / analytics.summary.total) * 100}%`
                              : '0%',
                          }}
                        />
                      </div>
                      <span className="w-10 text-right text-sm font-semibold text-gray-900">{count}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="animate-in fade-in slide-in-from-bottom-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Top categories</CardTitle>
                {categoryList.length > categoryPreview.length && (
                  <Button variant="outline" onClick={() => setShowCategoriesModal(true)}>
                    View all
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryPreview.map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between gap-3">
                      <Badge variant="outline" className="min-w-[140px] justify-center bg-white/70">
                        {category}
                      </Badge>
                      <div className="flex flex-1 items-center gap-3">
                        <div className="h-2 flex-1 rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full bg-emerald-600"
                            style={{
                              width: analytics.summary.total
                                ? `${(count / analytics.summary.total) * 100}%`
                                : '0%',
                            }}
                          />
                        </div>
                        <span className="w-10 text-right text-sm font-semibold text-gray-900">{count}</span>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="animate-in fade-in slide-in-from-bottom-2">
              <CardHeader>
                <CardTitle className="text-lg">SLA health by priority</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.sla.byPriority.map((row) => {
                  const rate = row.total ? Math.round((row.breached / row.total) * 100) : 0;
                  return (
                    <div key={row.priority} className="rounded-xl border border-gray-100 bg-white/70 p-3">
                      <div className="flex items-center justify-between text-sm text-gray-700">
                        <span className="font-medium">{PRIORITY_LABELS[row.priority]}</span>
                        <span className="text-xs text-gray-500">{formatDuration(row.targetMinutes)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full bg-rose-500"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-600">{rate}%</span>
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500">
                        {row.breached} breaches out of {row.total}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="animate-in fade-in slide-in-from-bottom-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Engineer leaderboard</CardTitle>
                  <p className="text-sm text-gray-600">Top performers in this range.</p>
                </div>
                {analytics.leaderboard.length > leaderboardPreview.length && (
                  <Button variant="outline" onClick={() => setShowLeaderboardModal(true)}>
                    View all
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.leaderboard.length === 0 ? (
                  <p className="text-sm text-gray-500">No assignments yet.</p>
                ) : (
                  leaderboardPreview.map((engineer) => (
                    <div
                      key={engineer.id}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-white/70 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{engineer.name}</p>
                        <p className="text-xs text-gray-500">{engineer.email}</p>
                      </div>
                      <div className="text-right text-xs text-gray-600">
                        <p>{engineer.resolved} resolved</p>
                        <p>{formatDuration(engineer.avgResolutionMinutes)} avg</p>
                        <p className="text-rose-600">{engineer.breached} breached</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="animate-in fade-in slide-in-from-bottom-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Top failing intents/tools</CardTitle>
                  <p className="text-sm text-gray-600">Based on agent rollups in range.</p>
                </div>
                {analytics.topAgentFailures.length > failuresPreview.length && (
                  <Button variant="outline" onClick={() => setShowFailuresModal(true)}>
                    View all
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.topAgentFailures.length === 0 ? (
                  <p className="text-sm text-gray-500">No failures recorded.</p>
                ) : (
                  failuresPreview.map((row) => (
                    <div
                      key={`${row.agent}-${row.intent}-${row.tool}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white/70 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {row.agent} · {row.intent || 'unknown'} · {row.tool || 'unknown'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {row.failures} failures out of {row.total}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-rose-50 text-rose-700">
                        {row.failureRate}%
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="animate-in fade-in slide-in-from-bottom-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Engineer workload</CardTitle>
                  <p className="text-sm text-gray-600">Open vs resolved in range.</p>
                </div>
                {analytics.engineerWorkload.length > workloadPreview.length && (
                  <Button variant="outline" onClick={() => setShowWorkloadModal(true)}>
                    View all
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {analytics.engineerWorkload.length === 0 ? (
                  <p className="text-sm text-gray-500">No assignments yet.</p>
                ) : (
                  workloadPreview.map((engineer) => (
                    <div
                      key={engineer.id}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-white/70 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{engineer.name}</p>
                        <p className="text-xs text-gray-500">{engineer.email}</p>
                      </div>
                      <div className="text-right text-xs text-gray-600">
                        <p>{engineer.open} open</p>
                        <p>{engineer.resolved} resolved</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="animate-in fade-in slide-in-from-bottom-2 lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Ticket ledger</CardTitle>
                  <p className="text-sm text-gray-600">Current view of IT tickets and SLA health.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setShowTicketModal(true)}>
                    View all
                  </Button>
                  <Button variant="outline" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-xs uppercase text-gray-500">
                      <tr>
                        <th className="py-2 pr-4">Ticket</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Priority</th>
                        <th className="py-2 pr-4">Requester</th>
                        <th className="py-2 pr-4">Assignee</th>
                        <th className="py-2 pr-4">SLA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {ledgerPreview.map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-white/70">
                          <td className="py-3 pr-4">
                            <p className="font-semibold text-gray-900">{ticket.ticketNumber}</p>
                            <p className="text-xs text-gray-500">{ticket.title}</p>
                          </td>
                          <td className="py-3 pr-4 text-sm text-gray-700">
                            {STATUS_LABELS[ticket.status]}
                          </td>
                          <td className="py-3 pr-4 text-sm text-gray-700">
                            {PRIORITY_LABELS[ticket.priority]}
                          </td>
                          <td className="py-3 pr-4 text-sm text-gray-700">
                            {ticket.requesterName}
                            <p className="text-xs text-gray-400">{ticket.requesterEmail}</p>
                          </td>
                          <td className="py-3 pr-4 text-sm text-gray-700">{ticket.assigneeName}</td>
                          <td className="py-3 pr-4 text-sm">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                ticket.slaBreached
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {formatDuration(ticket.slaElapsedMinutes)} /{' '}
                              {formatDuration(ticket.slaTargetMinutes)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-in fade-in slide-in-from-bottom-2">
              <CardHeader>
                <CardTitle className="text-lg">SLA controls</CardTitle>
                <p className="text-sm text-gray-600">
                  Update SLA targets (minutes). Changes apply instantly to analytics.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {slaDraft && (
                  <>
                    {Object.entries(PRIORITY_LABELS).map(([priority, label]) => (
                      <label key={priority} className="flex items-center justify-between gap-3 text-sm text-gray-600">
                        <span>{label}</span>
                        <input
                          type="number"
                          min={30}
                          className="w-28 rounded-md border border-gray-200 bg-white/70 px-2 py-1 text-sm text-gray-900"
                          value={slaDraft[priority as Priority]}
                          onChange={(e) =>
                            setSlaDraft({
                              ...slaDraft,
                              [priority]: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    ))}
                  </>
                )}
                <Button onClick={handleSlaSave} disabled={savingSla} className="w-full">
                  {savingSla ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Saving...
                    </>
                  ) : (
                    'Save SLA Targets'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAutoClose}
                  disabled={autoClosing}
                  className="w-full"
                >
                  {autoClosing ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Auto-closing...
                    </>
                  ) : (
                    'Run Auto-Close (7 days)'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRunSlaJob}
                  disabled={runningSlaJob}
                  className="w-full"
                >
                  {runningSlaJob ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Running SLA job...
                    </>
                  ) : (
                    'Run SLA Notifications'
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="animate-in fade-in slide-in-from-bottom-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent activity</CardTitle>
              <Button variant="outline" onClick={() => setShowActivityModal(true)}>
                View all
              </Button>
            </CardHeader>
            <CardContent>
              {recentActivityPreview.length === 0 ? (
                <p className="text-sm text-gray-500">No recent activity.</p>
              ) : (
                <div className="space-y-3">
                  {recentActivityPreview.map((activity) => (
                    <div key={activity.id} className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {activity.ticketNumber}{' '}
                          {activity.ticketTitle ? `- ${activity.ticketTitle}` : ''}
                        </p>
                        <p className="text-xs text-gray-500">
                          {activity.type} ? {activity.creatorName}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(activity.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {showTicketModal && analytics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-sm text-gray-500">Ticket ledger</p>
                <h2 className="text-lg font-semibold text-gray-900">All tickets</h2>
              </div>
              <Button variant="outline" onClick={() => setShowTicketModal(false)}>
                Close
              </Button>
            </div>
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                <label className="space-y-1 text-sm text-gray-600">
                  Date range
                  <select
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                    value={ticketModalFilters.range}
                    onChange={(e) =>
                      setTicketModalFilters({ ...ticketModalFilters, range: e.target.value })
                    }
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                {ticketModalFilters.range === 'custom' && (
                  <>
                    <label className="space-y-1 text-sm text-gray-600">
                      Start date
                      <input
                        type="date"
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                        value={ticketModalFilters.start}
                        onChange={(e) =>
                          setTicketModalFilters({ ...ticketModalFilters, start: e.target.value })
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm text-gray-600">
                      End date
                      <input
                        type="date"
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                        value={ticketModalFilters.end}
                        onChange={(e) =>
                          setTicketModalFilters({ ...ticketModalFilters, end: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
                <label className="space-y-1 text-sm text-gray-600">
                  Status
                  <select
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                    value={ticketModalFilters.status}
                    onChange={(e) =>
                      setTicketModalFilters({ ...ticketModalFilters, status: e.target.value })
                    }
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
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                    value={ticketModalFilters.priority}
                    onChange={(e) =>
                      setTicketModalFilters({ ...ticketModalFilters, priority: e.target.value })
                    }
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
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                    value={ticketModalFilters.category}
                    onChange={(e) =>
                      setTicketModalFilters({ ...ticketModalFilters, category: e.target.value })
                    }
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
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                    value={ticketModalFilters.subcategory}
                    onChange={(e) =>
                      setTicketModalFilters({ ...ticketModalFilters, subcategory: e.target.value })
                    }
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
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                    value={ticketModalFilters.engineerId}
                    onChange={(e) =>
                      setTicketModalFilters({ ...ticketModalFilters, engineerId: e.target.value })
                    }
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
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                    value={ticketModalFilters.projectCode}
                    onChange={(e) =>
                      setTicketModalFilters({ ...ticketModalFilters, projectCode: e.target.value })
                    }
                    placeholder="IT-Project-01"
                  />
                </label>
              </div>
            </div>
            <div className="flex-1 overflow-auto px-6 py-4">
              <div className="mb-3 text-sm text-gray-500">
                Showing {filteredLedgerTickets.length} tickets
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-gray-500">
                    <tr>
                      <th className="py-2 pr-4">Ticket</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Priority</th>
                      <th className="py-2 pr-4">Requester</th>
                      <th className="py-2 pr-4">Assignee</th>
                      <th className="py-2 pr-4">SLA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLedgerTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-white/70">
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-gray-900">{ticket.ticketNumber}</p>
                          <p className="text-xs text-gray-500">{ticket.title}</p>
                        </td>
                        <td className="py-3 pr-4 text-sm text-gray-700">
                          {STATUS_LABELS[ticket.status]}
                        </td>
                        <td className="py-3 pr-4 text-sm text-gray-700">
                          {PRIORITY_LABELS[ticket.priority]}
                        </td>
                        <td className="py-3 pr-4 text-sm text-gray-700">
                          {ticket.requesterName}
                          <p className="text-xs text-gray-400">{ticket.requesterEmail}</p>
                        </td>
                        <td className="py-3 pr-4 text-sm text-gray-700">{ticket.assigneeName}</td>
                        <td className="py-3 pr-4 text-sm">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${
                              ticket.slaBreached
                                ? 'bg-red-100 text-red-700'
                                : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {formatDuration(ticket.slaElapsedMinutes)} /{' '}
                            {formatDuration(ticket.slaTargetMinutes)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {showActivityModal && analytics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-sm text-gray-500">Recent activity</p>
                <h2 className="text-lg font-semibold text-gray-900">All activity</h2>
              </div>
              <Button variant="outline" onClick={() => setShowActivityModal(false)}>
                Close
              </Button>
            </div>
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1 text-sm text-gray-600">
                  Date range
                  <select
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                    value={activityModalFilters.range}
                    onChange={(e) =>
                      setActivityModalFilters({ ...activityModalFilters, range: e.target.value })
                    }
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                {activityModalFilters.range === 'custom' && (
                  <>
                    <label className="space-y-1 text-sm text-gray-600">
                      Start date
                      <input
                        type="date"
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                        value={activityModalFilters.start}
                        onChange={(e) =>
                          setActivityModalFilters({ ...activityModalFilters, start: e.target.value })
                        }
                      />
                    </label>
                    <label className="space-y-1 text-sm text-gray-600">
                      End date
                      <input
                        type="date"
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                        value={activityModalFilters.end}
                        onChange={(e) =>
                          setActivityModalFilters({ ...activityModalFilters, end: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
                <label className="space-y-1 text-sm text-gray-600">
                  Activity type
                  <select
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                    value={activityModalFilters.type}
                    onChange={(e) =>
                      setActivityModalFilters({ ...activityModalFilters, type: e.target.value })
                    }
                  >
                    <option value="">All types</option>
                    {activityTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-gray-600">
                  User
                  <select
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                    value={activityModalFilters.user}
                    onChange={(e) =>
                      setActivityModalFilters({ ...activityModalFilters, user: e.target.value })
                    }
                  >
                    <option value="">All users</option>
                    {activityUserOptions.map((user) => (
                      <option key={user} value={user}>
                        {user}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="flex-1 overflow-auto px-6 py-4">
              <div className="mb-3 text-sm text-gray-500">
                Showing {filteredActivity.length} activities
              </div>
              {filteredActivity.length === 0 ? (
                <p className="text-sm text-gray-500">No activity in this range.</p>
              ) : (
                <div className="space-y-3">
                  {filteredActivity.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 bg-white/70 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {activity.ticketNumber}{' '}
                          {activity.ticketTitle ? `- ${activity.ticketTitle}` : ''}
                        </p>
                        <p className="text-xs text-gray-500">
                          {activity.type} · {activity.creatorName || activity.creatorEmail}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(activity.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showLeaderboardModal && analytics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-sm text-gray-500">Engineer leaderboard</p>
                <h2 className="text-lg font-semibold text-gray-900">All performers</h2>
              </div>
              <Button variant="outline" onClick={() => setShowLeaderboardModal(false)}>
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-auto px-6 py-4">
              {analytics.leaderboard.length === 0 ? (
                <p className="text-sm text-gray-500">No assignments yet.</p>
              ) : (
                <div className="space-y-3">
                  {analytics.leaderboard.map((engineer) => (
                    <div
                      key={engineer.id}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-white/70 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{engineer.name}</p>
                        <p className="text-xs text-gray-500">{engineer.email}</p>
                      </div>
                      <div className="text-right text-xs text-gray-600">
                        <p>{engineer.resolved} resolved</p>
                        <p>{formatDuration(engineer.avgResolutionMinutes)} avg</p>
                        <p className="text-rose-600">{engineer.breached} breached</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showFailuresModal && analytics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-sm text-gray-500">Agent reliability</p>
                <h2 className="text-lg font-semibold text-gray-900">All failures</h2>
              </div>
              <Button variant="outline" onClick={() => setShowFailuresModal(false)}>
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-auto px-6 py-4">
              {analytics.topAgentFailures.length === 0 ? (
                <p className="text-sm text-gray-500">No failures recorded.</p>
              ) : (
                <div className="space-y-3">
                  {analytics.topAgentFailures.map((row) => (
                    <div
                      key={`${row.agent}-${row.intent}-${row.tool}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white/70 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {row.agent} · {row.intent || 'unknown'} · {row.tool || 'unknown'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {row.failures} failures out of {row.total}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-rose-50 text-rose-700">
                        {row.failureRate}%
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showWorkloadModal && analytics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-sm text-gray-500">Engineer workload</p>
                <h2 className="text-lg font-semibold text-gray-900">Open vs resolved</h2>
              </div>
              <Button variant="outline" onClick={() => setShowWorkloadModal(false)}>
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-auto px-6 py-4">
              {analytics.engineerWorkload.length === 0 ? (
                <p className="text-sm text-gray-500">No assignments yet.</p>
              ) : (
                <div className="space-y-3">
                  {analytics.engineerWorkload.map((engineer) => (
                    <div
                      key={engineer.id}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-white/70 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{engineer.name}</p>
                        <p className="text-xs text-gray-500">{engineer.email}</p>
                      </div>
                      <div className="text-right text-xs text-gray-600">
                        <p>{engineer.open} open</p>
                        <p>{engineer.resolved} resolved</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCategoriesModal && analytics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-sm text-gray-500">Categories</p>
                <h2 className="text-lg font-semibold text-gray-900">All categories</h2>
              </div>
              <Button variant="outline" onClick={() => setShowCategoriesModal(false)}>
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-auto px-6 py-4">
              {categoryList.length === 0 ? (
                <p className="text-sm text-gray-500">No categories found.</p>
              ) : (
                <div className="space-y-3">
                  {categoryList.map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between gap-3">
                      <Badge variant="outline" className="min-w-[160px] justify-center bg-white/70">
                        {category}
                      </Badge>
                      <div className="flex flex-1 items-center gap-3">
                        <div className="h-2 flex-1 rounded-full bg-gray-100">
                          <div
                            className="h-2 rounded-full bg-emerald-600"
                            style={{
                              width: analytics.summary.total
                                ? `${(count / analytics.summary.total) * 100}%`
                                : '0%',
                            }}
                          />
                        </div>
                        <span className="w-10 text-right text-sm font-semibold text-gray-900">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
