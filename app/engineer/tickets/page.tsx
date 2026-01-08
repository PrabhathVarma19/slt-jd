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
import { Input } from '@/components/ui/input';
import {
  Ticket,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_REQUESTER' | 'RESOLVED' | 'CLOSED';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type TicketType = 'IT' | 'TRAVEL';

interface TicketData {
  id: string;
  ticketNumber: string;
  type: TicketType;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  domain: string;
  createdAt: string;
  resolvedAt?: string;
  projectCode?: string;
  projectName?: string;
  isAssigned?: boolean; // true if assigned to this engineer, false if unassigned
  requester: {
    id: string;
    email: string;
    profile?: {
      empName?: string;
      employeeId?: number;
    };
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

const STATUS_ICONS: Record<TicketStatus, React.ReactNode> = {
  OPEN: <AlertCircle className="h-4 w-4" />,
  IN_PROGRESS: <Clock className="h-4 w-4" />,
  WAITING_ON_REQUESTER: <Clock className="h-4 w-4" />,
  RESOLVED: <CheckCircle className="h-4 w-4" />,
  CLOSED: <XCircle className="h-4 w-4" />,
};

export default function EngineerTicketsPage() {
  const router = useRouter();
  const { showToast, ToastContainer } = useToast();

  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
  const [noteText, setNoteText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    fetchTickets();
  }, [statusFilter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);

      const res = await fetch(`/api/engineer/tickets?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          showToast('Engineer role required', 'error');
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

  const updateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    try {
      setUpdating(ticketId);
      const res = await fetch(`/api/engineer/tickets/${ticketId}`, {
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

  const claimTicket = async (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening ticket modal
    try {
      setUpdating(ticketId);
      const res = await fetch(`/api/engineer/tickets/${ticketId}/claim`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to claim ticket');
      }

      showToast('Ticket claimed successfully', 'success');
      fetchTickets();
    } catch (error: any) {
      console.error('Error claiming ticket:', error);
      showToast(error.message || 'Failed to claim ticket', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const addNote = async (ticketId: string) => {
    if (!noteText.trim()) {
      showToast('Please enter a note', 'error');
      return;
    }

    try {
      setUpdating(ticketId);
      const res = await fetch(`/api/engineer/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText.trim() }),
      });

      if (!res.ok) {
        throw new Error('Failed to add note');
      }

      showToast('Note added successfully', 'success');
      setNoteText('');
      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        // Refresh selected ticket
        const updatedRes = await fetch(`/api/engineer/tickets/${ticketId}`);
        if (updatedRes.ok) {
          const data = await updatedRes.json();
          setSelectedTicket(data.ticket);
        }
      }
    } catch (error: any) {
      console.error('Error adding note:', error);
      showToast('Failed to add note', 'error');
    } finally {
      setUpdating(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusOptions = (currentStatus: TicketStatus): TicketStatus[] => {
    switch (currentStatus) {
      case 'OPEN':
        return ['IN_PROGRESS', 'WAITING_ON_REQUESTER', 'RESOLVED'];
      case 'IN_PROGRESS':
        return ['WAITING_ON_REQUESTER', 'RESOLVED'];
      case 'WAITING_ON_REQUESTER':
        return ['IN_PROGRESS', 'RESOLVED'];
      case 'RESOLVED':
        return ['CLOSED'];
      case 'CLOSED':
        return [];
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">My Tickets</h1>
          <p className="mt-1 text-sm text-gray-600">
            View assigned tickets and claim unassigned IT tickets
          </p>
        </div>
        <BackToHome />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_ON_REQUESTER">Waiting on Requester</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Ticket className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600">No tickets available</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <Card
              key={ticket.id}
              className={`transition-shadow hover:shadow-md ${
                ticket.isAssigned === false ? 'border-2 border-dashed border-blue-300' : ''
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => ticket.isAssigned !== false && setSelectedTicket(ticket)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-gray-900">
                        {ticket.ticketNumber}
                      </span>
                      {ticket.projectCode && (
                        <Badge variant="outline" className="text-xs">
                          {ticket.projectCode}{ticket.projectName ? ` - ${ticket.projectName}` : ''}
                        </Badge>
                      )}
                      {ticket.isAssigned === false && (
                        <Badge className="bg-orange-100 text-orange-800">
                          Unassigned
                        </Badge>
                      )}
                      <Badge className={STATUS_COLORS[ticket.status]}>
                        <span className="flex items-center gap-1">
                          {STATUS_ICONS[ticket.status]}
                          {ticket.status.replace(/_/g, ' ')}
                        </span>
                      </Badge>
                      <Badge className={PRIORITY_COLORS[ticket.priority]}>
                        {ticket.priority}
                      </Badge>
                      <Badge variant="outline">{ticket.type}</Badge>
                    </div>
                    <h3 className="font-medium text-gray-900 mb-1">
                      <a
                        href={`/tickets/${ticket.id}`}
                        className="hover:text-blue-600 hover:underline"
                      >
                        {ticket.title}
                      </a>
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>
                        Requester:{' '}
                        {ticket.requester.profile?.empName || ticket.requester.email}
                      </span>
                      <span>Created: {formatDate(ticket.createdAt)}</span>
                      {ticket.resolvedAt && (
                        <span>Resolved: {formatDate(ticket.resolvedAt)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ticket.isAssigned === false ? (
                      <Button
                        onClick={(e) => claimTicket(ticket.id, e)}
                        disabled={updating === ticket.id}
                        size="sm"
                        variant="default"
                      >
                        {updating === ticket.id ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          'Claim'
                        )}
                      </Button>
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-400 cursor-pointer" onClick={() => setSelectedTicket(ticket)} />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{selectedTicket.ticketNumber}</CardTitle>
                  <CardDescription className="mt-1">{selectedTicket.title}</CardDescription>
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Ticket Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Status:</span>
                    <Badge className={STATUS_COLORS[selectedTicket.status]}>
                      <span className="flex items-center gap-1">
                        {STATUS_ICONS[selectedTicket.status]}
                        {selectedTicket.status.replace(/_/g, ' ')}
                      </span>
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">Priority:</span>
                    <Badge className={PRIORITY_COLORS[selectedTicket.priority]}>
                      {selectedTicket.priority}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Requester: </span>
                    <span className="text-gray-600">
                      {selectedTicket.requester.profile?.empName || selectedTicket.requester.email}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Created: </span>
                    <span className="text-gray-600">{formatDate(selectedTicket.createdAt)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Description:</span>
                    <p className="text-gray-600 mt-1">{selectedTicket.description}</p>
                  </div>
                </div>
              </div>

              {/* Status Update */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Update Status</h3>
                <div className="flex flex-wrap gap-2">
                  {getStatusOptions(selectedTicket.status).map((status) => (
                    <Button
                      key={status}
                      onClick={() => updateTicketStatus(selectedTicket.id, status)}
                      disabled={updating === selectedTicket.id}
                      variant="outline"
                      size="sm"
                    >
                      {updating === selectedTicket.id ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        status.replace(/_/g, ' ')
                      )}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Add Note */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Add Note
                </h3>
                <div className="space-y-2">
                  <Input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add a note or comment..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey) {
                        addNote(selectedTicket.id);
                      }
                    }}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      Press Ctrl+Enter to add note
                    </p>
                    <Button
                      onClick={() => addNote(selectedTicket.id)}
                      disabled={updating === selectedTicket.id || !noteText.trim()}
                      size="sm"
                    >
                      {updating === selectedTicket.id ? <Spinner className="h-4 w-4" /> : 'Add Note'}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}

