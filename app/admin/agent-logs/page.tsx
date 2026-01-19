'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BackToHome } from '@/components/ui/back-to-home';
import { Spinner } from '@/components/ui/spinner';

type AgentLog = {
  id: string;
  agent: string;
  input: string;
  intent: string;
  tool: string;
  toolInput?: Record<string, any> | null;
  response: string;
  success: boolean;
  createdAt: string;
  metadata?: { actorRoles?: string[] } | null;
  user?: {
    email?: string;
    profile?: { empName?: string };
    roles?: Array<{
      revokedAt?: string | null;
      role?: { type?: string; name?: string } | null;
    }>;
  } | null;
};

export default function AgentLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentFilter, setAgentFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [intentFilter, setIntentFilter] = useState('');
  const [toolFilter, setToolFilter] = useState('');
  const [successFilter, setSuccessFilter] = useState('');
  const [rangeFilter, setRangeFilter] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [retentionDays, setRetentionDays] = useState(90);
  const [rollupDays, setRollupDays] = useState(30);
  const [retentionStatus, setRetentionStatus] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (agentFilter) params.set('agent', agentFilter);
      if (emailFilter) params.set('email', emailFilter);
      if (intentFilter) params.set('intent', intentFilter);
      if (toolFilter) params.set('tool', toolFilter);
      if (successFilter) params.set('success', successFilter);
      if (searchTerm) params.set('q', searchTerm);
      params.set('range', rangeFilter);
      params.set('page', page.toString());
      params.set('limit', limit.toString());
      if (rangeFilter === 'custom') {
        if (startDate) params.set('start', startDate);
        if (endDate) params.set('end', endDate);
      }
      const res = await fetch(`/api/admin/agent-logs?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch logs');
      }
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch agent logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [agentFilter, emailFilter, intentFilter, toolFilter, successFilter, rangeFilter, startDate, endDate, searchTerm]);

  useEffect(() => {
    fetchLogs();
  }, [agentFilter, emailFilter, intentFilter, toolFilter, successFilter, rangeFilter, startDate, endDate, searchTerm, page]);

  const isSuperAdmin = (log: AgentLog) =>
    log.user?.roles?.some(
      (role) => role.role?.type === 'SUPER_ADMIN' && role.revokedAt == null
    );

  const handleExport = () => {
    if (!logs.length) return;
    const header = ['Timestamp', 'User', 'Email', 'Agent', 'Intent', 'Tool', 'Success', 'Input', 'Response'];
    const rows = logs.map((log) => {
      const email = log.user?.email || '';
      const userName =
        log.user?.profile?.empName || (isSuperAdmin(log) ? 'Super Admin' : email) || 'Unknown';
      return [
        new Date(log.createdAt).toISOString(),
        `"${userName.replace(/"/g, '""')}"`,
        email,
        log.agent,
        log.intent,
        log.tool,
        log.success ? 'Yes' : 'No',
        `"${log.input.replace(/"/g, '""')}"`,
        `"${log.response.replace(/"/g, '""')}"`,
      ];
    });

    const csv = [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `agent-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Agent Logs</h1>
          <p className="mt-1 text-sm text-gray-600">
            Super Admin only. Review agent decisions, tools, and responses.
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
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
          >
            <option value="">All agents</option>
            <option value="service-desk">Service Desk</option>
            <option value="policy-agent">Ask Beacon</option>
            <option value="new-joiner">New Joiner</option>
            <option value="expenses-coach">Expenses Coach</option>
          </select>
          <select
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            value={rangeFilter}
            onChange={(e) => setRangeFilter(e.target.value)}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom</option>
          </select>
          {rangeFilter === 'custom' && (
            <>
              <input
                type="date"
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <input
                type="date"
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </>
          )}
          <input
            type="text"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            placeholder="Filter by email"
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
          />
          <input
            type="text"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            placeholder="Intent"
            value={intentFilter}
            onChange={(e) => setIntentFilter(e.target.value)}
          />
          <input
            type="text"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            placeholder="Tool"
            value={toolFilter}
            onChange={(e) => setToolFilter(e.target.value)}
          />
          <input
            type="text"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            placeholder="Search input/response"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            value={successFilter}
            onChange={(e) => setSuccessFilter(e.target.value)}
          >
            <option value="">All outcomes</option>
            <option value="true">Success</option>
            <option value="false">Failed</option>
          </select>
          <Button variant="outline" onClick={fetchLogs}>
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={!logs.length}>
            Export CSV
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2">
          <CardTitle className="text-lg">Retention tools</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Days</label>
            <input
              type="number"
              min={7}
              max={365}
              className="w-24 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm"
              value={retentionDays}
              onChange={(e) => setRetentionDays(Number(e.target.value) || 90)}
            />
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              setRetentionStatus('Archiving logs...');
              const res = await fetch(
                `/api/admin/agent-logs/archive?days=${retentionDays}`,
                { method: 'POST' }
              );
              const data = await res.json();
              setRetentionStatus(
                res.ok
                  ? `Archived ${data.archived} logs (cutoff ${data.cutoff.slice(0, 10)})`
                  : data.error || 'Archive failed'
              );
            }}
          >
            Archive {retentionDays}d+
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              setRetentionStatus('Purging logs...');
              const res = await fetch(
                `/api/admin/agent-logs/cleanup?days=${retentionDays}&requireArchive=true`,
                { method: 'POST' }
              );
              const data = await res.json();
              setRetentionStatus(
                res.ok
                  ? `Purged ${data.deleted} logs (cutoff ${data.cutoff.slice(0, 10)})`
                  : data.error || 'Purge failed'
              );
            }}
          >
            Purge {retentionDays}d+
          </Button>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Rollup days</label>
            <input
              type="number"
              min={1}
              max={365}
              className="w-24 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm"
              value={rollupDays}
              onChange={(e) => setRollupDays(Number(e.target.value) || 30)}
            />
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              setRetentionStatus('Rolling up metrics...');
              const res = await fetch(
                `/api/admin/agent-logs/rollup?days=${rollupDays}`,
                { method: 'POST' }
              );
              const data = await res.json();
              setRetentionStatus(
                res.ok
                  ? `Rolled up ${data.rolledUp} rows (last ${data.days} days)`
                  : data.error || 'Rollup failed'
              );
            }}
          >
            Roll up metrics
          </Button>
          {retentionStatus && <span className="text-xs text-gray-500">{retentionStatus}</span>}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
        <span>
          Showing page {page} of {Math.max(1, totalPages)} ({total} logs)
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
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-gray-600">
            No agent logs yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => {
            const userName =
              log.user?.profile?.empName ||
              (isSuperAdmin(log) ? 'Super Admin' : log.user?.email) ||
              'Unknown';
            const actorRoles = log.metadata?.actorRoles || [];
            return (
              <Card key={log.id}>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{userName}</p>
                    {log.user?.email && (
                      <p className="text-xs text-gray-500">{log.user.email}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{log.agent}</Badge>
                    <Badge variant="secondary">{log.intent}</Badge>
                    <Badge variant="outline">{log.tool}</Badge>
                    {actorRoles.map((role) => (
                      <Badge key={role} variant="outline">
                        {role}
                      </Badge>
                    ))}
                    <Badge
                      variant="outline"
                      className={
                        log.success
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-rose-200 bg-rose-50 text-rose-700'
                      }
                    >
                      {log.success ? 'Success' : 'Failed'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-gray-700">
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">User input</p>
                    <p className="mt-1 whitespace-pre-wrap">{log.input}</p>
                  </div>
                  {log.toolInput && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-gray-500">Tool input</p>
                      <pre className="mt-1 whitespace-pre-wrap rounded-md bg-gray-50 p-2 text-xs">
                        {JSON.stringify(log.toolInput, null, 2)}
                      </pre>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Agent response</p>
                    <p className="mt-1 whitespace-pre-wrap">{log.response}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
