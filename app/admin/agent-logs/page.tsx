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
  user?: {
    email?: string;
    profile?: { empName?: string };
  } | null;
};

export default function AgentLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [agentFilter, setAgentFilter] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (agentFilter) params.set('agent', agentFilter);
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
    } catch (error) {
      console.error('Failed to fetch agent logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [agentFilter]);

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
          <Button variant="outline" onClick={fetchLogs}>
            Refresh
          </Button>
        </CardContent>
      </Card>

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
            const userName = log.user?.profile?.empName || log.user?.email || 'Unknown';
            return (
              <Card key={log.id}>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{userName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{log.agent}</Badge>
                    <Badge variant="secondary">{log.intent}</Badge>
                    <Badge variant="outline">{log.tool}</Badge>
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
