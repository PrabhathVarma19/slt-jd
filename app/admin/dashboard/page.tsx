'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BackToHome } from '@/components/ui/back-to-home';
import { Spinner } from '@/components/ui/spinner';
import {
  Ticket,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  TrendingUp,
  Activity,
  Shield,
  UserCheck,
  XCircle,
  ArrowRight,
} from 'lucide-react';

interface DashboardStats {
  total: number;
  byStatus: {
    OPEN: number;
    IN_PROGRESS: number;
    WAITING_ON_REQUESTER: number;
    RESOLVED: number;
    CLOSED: number;
    PENDING_APPROVAL: number;
  };
  byPriority: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    URGENT: number;
  };
  byType: {
    IT: number;
    TRAVEL: number;
  };
  byDomain: {
    IT: number;
    TRAVEL: number;
  };
}

interface DashboardMetrics {
  avgResolutionTimeHours: number;
  unassignedCount: number;
  pendingApprovalsCount: number;
  resolvedCount: number;
  closedCount: number;
}

interface EngineerWorkload {
  engineerId: string;
  engineerEmail: string;
  engineerName?: string;
  assignedCount: number;
}

interface RecentActivity {
  id: string;
  ticketId: string;
  type: string;
  createdAt: string;
  ticketNumber: string;
  ticketTitle: string;
  ticketDomain: string;
  creatorName: string;
  creatorEmail: string;
  payload: any;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [engineerWorkload, setEngineerWorkload] = useState<EngineerWorkload[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [domainFilter, setDomainFilter] = useState<string>('');
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    // Fetch user roles to determine if super admin
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.roles) {
          const roles = data.user.roles || [];
          setUserRoles(roles);
          setIsSuperAdmin(roles.includes('SUPER_ADMIN'));
        }
      })
      .catch(() => {
        // Ignore errors
      });
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [domainFilter]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (domainFilter) params.append('domain', domainFilter);

      const res = await fetch(`/api/dashboard/stats?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch dashboard data');
      }
      const data = await res.json();
      setStats(data.stats);
      setMetrics(data.metrics);
      setEngineerWorkload(data.engineerWorkload || []);
      setRecentActivity(data.recentActivity || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'CREATED':
        return <Ticket className="h-4 w-4 text-blue-600" />;
      case 'ASSIGNED':
        return <UserCheck className="h-4 w-4 text-green-600" />;
      case 'STATUS_CHANGED':
        return <ArrowRight className="h-4 w-4 text-yellow-600" />;
      case 'NOTE_ADDED':
        return <Activity className="h-4 w-4 text-gray-600" />;
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getEventDescription = (activity: RecentActivity) => {
    switch (activity.type) {
      case 'CREATED':
        return `Ticket ${activity.ticketNumber} created`;
      case 'ASSIGNED':
        return `Ticket ${activity.ticketNumber} assigned`;
      case 'STATUS_CHANGED':
        return `Status changed for ${activity.ticketNumber}`;
      case 'NOTE_ADDED':
        return `Note added to ${activity.ticketNumber}`;
      case 'APPROVED':
        return `Approval for ${activity.ticketNumber}`;
      case 'REJECTED':
        return `Rejection for ${activity.ticketNumber}`;
      default:
        return `Activity on ${activity.ticketNumber}`;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Spinner className="mx-auto mb-4" />
          <p className="text-sm text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats || !metrics) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-gray-600">Failed to load dashboard data</p>
        </div>
      </div>
    );
  }

  const activeTickets = stats.byStatus.OPEN + stats.byStatus.IN_PROGRESS + stats.byStatus.WAITING_ON_REQUESTER;
  const completedTickets = stats.byStatus.RESOLVED + stats.byStatus.CLOSED;
  const completionRate = stats.total > 0 ? Math.round((completedTickets / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Overview of ticket system performance and metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          {isSuperAdmin ? (
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="">All Domains</option>
              <option value="IT">IT</option>
              <option value="TRAVEL">Travel</option>
            </select>
          ) : (
            <Badge variant="outline" className="px-3 py-1">
              {userRoles.includes('ADMIN_IT') ? 'IT Domain' : 'Travel Domain'}
            </Badge>
          )}
          <BackToHome />
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tickets</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <Ticket className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Tickets</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{activeTickets}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{completedTickets}</p>
                <p className="text-xs text-gray-500 mt-1">{completionRate}% completion rate</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Unassigned</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.unassignedCount}</p>
              </div>
              <Users className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Resolution Time</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {metrics.avgResolutionTimeHours > 0
                    ? `${metrics.avgResolutionTimeHours}h`
                    : 'N/A'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {metrics.pendingApprovalsCount}
                </p>
              </div>
              <Shield className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Resolved Today</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.byStatus.RESOLVED}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tickets by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-20 justify-center">
                      {status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-8 text-right">
                      {count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tickets by Priority */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.byPriority).map(([priority, count]) => {
                const colors: Record<string, string> = {
                  LOW: 'bg-gray-600',
                  MEDIUM: 'bg-blue-600',
                  HIGH: 'bg-orange-600',
                  URGENT: 'bg-red-600',
                };
                return (
                  <div key={priority} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-20 justify-center">
                        {priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`${colors[priority]} h-2 rounded-full`}
                          style={{
                            width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 w-8 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engineer Workload */}
      {engineerWorkload.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Engineer Workload</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {engineerWorkload.map((engineer) => (
                <div key={engineer.engineerId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">
                        {engineer.engineerName || engineer.engineerEmail.split('@')[0]}
                      </p>
                      <p className="text-xs text-gray-500">{engineer.engineerEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-1 max-w-xs">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full"
                        style={{
                          width: `${
                            engineerWorkload.length > 0
                              ? (engineer.assignedCount /
                                  Math.max(...engineerWorkload.map((e) => e.assignedCount))) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-8 text-right">
                      {engineer.assignedCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">{getEventIcon(activity.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {getEventDescription(activity)}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          by {activity.creatorName} • {formatDate(activity.createdAt)}
                        </p>
                        {activity.type === 'NOTE_ADDED' && activity.payload?.note && (
                          <div className="mt-2 rounded bg-gray-50 p-2">
                            <p className="text-xs text-gray-700">{activity.payload.note}</p>
                          </div>
                        )}
                      </div>
                      <a
                        href={`/tickets/${activity.ticketId}`}
                        className="text-xs text-blue-600 hover:underline flex-shrink-0"
                      >
                        View Ticket
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

