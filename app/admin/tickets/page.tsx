'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/button';
import { BackToHome } from '@/components/ui/back-to-home';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/lib/hooks/useToast';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_REQUESTER' | 'RESOLVED' | 'CLOSED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type TicketType = 'IT' | 'TRAVEL';

interface Ticket {
  id: string;
  ticketNumber: string;
  type: TicketType;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  domain: string;
  createdAt: string;
  requester: {
    id: string;
    email: string;
    profile?: {
      empName?: string;
      employeeId?: number;
    };
  };
  assignments: Array<{
    id: string;
    engineer: {
      id: string;
      email: string;
      profile?: {
        empName?: string;
      };
    };
  }>;
}

interface Engineer {
  id: string;
  email: string;
  profile?: {
    empName?: string;
    employeeId?: number;
  };
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  WAITING_ON_REQUESTER: 'bg-orange-100 text-orange-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
};

export default function AdminTicketsPage() {
  const router = useRouter();
  const { showToast, ToastContainer } = useToast();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  // Filters
  const [domainFilter, setDomainFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [assignEngineerId, setAssignEngineerId] = useState<string>('');

  useEffect(() => {
    fetchTickets();
  }, [domainFilter, statusFilter]);

  useEffect(() => {
    fetchEngineers();
  }, [domainFilter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (domainFilter) params.append('domain', domainFilter);
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`/api/admin/tickets?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          showToast('Access denied. Admin role required.', 'error');
          router.push('/');
          return;
        }
        throw new Error('Failed to fetch tickets');
      }

      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (error: any) {
      console.error('Error fetching tickets:', error);
      showToast('Failed to load tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchEngineers = async () => {
    try {
      const params = new URLSearchParams();
      if (domainFilter) params.append('domain', domainFilter);

      const res = await fetch(`/api/admin/engineers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEngineers(data.engineers || []);
      }
    } catch (error) {
      console.error('Error fetching engineers:', error);
    }
  };

  const updateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    try {
      setUpdating(ticketId);
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        throw new Error('Failed to update ticket');
      }

      showToast('Ticket status updated', 'success');
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(null);
      }
    } catch (error: any) {
      console.error('Error updating ticket:', error);
      showToast('Failed to update ticket', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const assignEngineer = async (ticketId: string) => {
    if (!assignEngineerId) {
      showToast('Please select an engineer', 'error');
      return;
    }

    try {
      setUpdating(ticketId);
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          engineerId: assignEngineerId,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to assign engineer');
      }

      showToast('Engineer assigned', 'success');
      setAssignEngineerId('');
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(null);
      }
    } catch (error: any) {
      console.error('Error assigning engineer:', error);
      showToast('Failed to assign engineer', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const unassignEngineer = async (ticketId: string) => {
    try {
      setUpdating(ticketId);
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unassign',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to unassign engineer');
      }

      showToast('Engineer unassigned', 'success');
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(null);
      }
    } catch (error: any) {
      console.error('Error unassigning engineer:', error);
      showToast('Failed to unassign engineer', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Ticket Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage and assign IT and Travel tickets
          </p>
        </div>
        <BackToHome />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="text-sm font-medium mb-1 block">Domain</label>
              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="">All</option>
                <option value="IT">IT</option>
                <option value="TRAVEL">Travel</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-md"
              >
                <option value="">All</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="WAITING_ON_REQUESTER">Waiting on Requester</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No tickets found
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={STATUS_COLORS[ticket.status]}>
                        {ticket.status.replace('_', ' ')}
                      </Badge>
                      <Badge className={PRIORITY_COLORS[ticket.priority]}>
                        {ticket.priority}
                      </Badge>
                      <a
                        href={`/tickets/${ticket.id}`}
                        className="font-mono text-sm font-semibold hover:text-blue-600 hover:underline"
                      >
                        {ticket.ticketNumber}
                      </a>
                      <span className="text-sm text-muted-foreground">
                        {ticket.type}
                      </span>
                    </div>
                    <h3 className="font-semibold text-lg mb-1">
                      <a
                        href={`/tickets/${ticket.id}`}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {ticket.title}
                      </a>
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        Requester:{' '}
                        {ticket.requester.profile?.empName ||
                          ticket.requester.email}
                      </span>
                      <span>Created: {formatDate(ticket.createdAt)}</span>
                      {ticket.assignments.length > 0 && (
                        <span>
                          Assigned to:{' '}
                          {ticket.assignments[0].engineer.profile?.empName ||
                            ticket.assignments[0].engineer.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    {ticket.assignments.length === 0 && (
                      <div className="mb-2">
                        <select
                          value={assignEngineerId}
                          onChange={(e) => setAssignEngineerId(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border rounded-md"
                          disabled={updating === ticket.id}
                        >
                          <option value="">Select engineer...</option>
                          {engineers.map((eng) => (
                            <option key={eng.id} value={eng.id}>
                              {eng.profile?.empName || eng.email}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          className="w-full mt-1"
                          onClick={() => assignEngineer(ticket.id)}
                          disabled={updating === ticket.id || !assignEngineerId}
                        >
                          {updating === ticket.id ? (
                            <Spinner className="w-4 h-4" />
                          ) : (
                            'Assign'
                          )}
                        </Button>
                      </div>
                    )}
                    {ticket.assignments.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => unassignEngineer(ticket.id)}
                        disabled={updating === ticket.id}
                      >
                        {updating === ticket.id ? (
                          <Spinner className="w-4 h-4" />
                        ) : (
                          'Unassign'
                        )}
                      </Button>
                    )}
                    <select
                      value={ticket.status}
                      onChange={(e) =>
                        updateTicketStatus(ticket.id, e.target.value as TicketStatus)
                      }
                      className="w-full px-3 py-1.5 text-sm border rounded-md"
                      disabled={updating === ticket.id}
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="WAITING_ON_REQUESTER">
                        Waiting on Requester
                      </option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ToastContainer />
    </div>
  );
}

