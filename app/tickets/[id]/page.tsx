'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BackToHome } from '@/components/ui/back-to-home';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import {
  Ticket,
  User,
  Mail,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageSquare,
  UserCheck,
  UserX,
  ArrowRight,
  Shield,
  FileText,
  Tag,
  HelpCircle,
  Info,
} from 'lucide-react';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_REQUESTER' | 'RESOLVED' | 'CLOSED' | 'PENDING_APPROVAL';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type TicketType = 'IT' | 'TRAVEL';
type EventType = 'CREATED' | 'ASSIGNED' | 'STATUS_CHANGED' | 'PRIORITY_CHANGED' | 'NOTE_ADDED' | 'APPROVAL_REQUESTED' | 'APPROVED' | 'REJECTED';

interface TicketEvent {
  id: string;
  type: EventType;
  createdAt: string;
  payload: any;
  creator: {
    id: string;
    email: string;
    profile?: {
      empName?: string;
    };
  };
}

interface TicketApproval {
  id: string;
  approverEmail: string;
  state: 'PENDING' | 'APPROVED' | 'REJECTED';
  note?: string;
  requestedAt: string;
  decidedAt?: string;
}

interface TicketDetails {
  id: string;
  ticketNumber: string;
  type: TicketType;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  domain: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
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
    assignedAt: string;
    engineer: {
      id: string;
      email: string;
      profile?: {
        empName?: string;
        employeeId?: number;
      };
    };
  }>;
  events: TicketEvent[];
  approvals: TicketApproval[];
  isRequester: boolean;
  isAssignedEngineer: boolean;
  isAdmin: boolean;
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  WAITING_ON_REQUESTER: 'bg-orange-100 text-orange-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
  PENDING_APPROVAL: 'bg-purple-100 text-purple-800',
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
  PENDING_APPROVAL: <Shield className="h-4 w-4" />,
};

const STATUS_DESCRIPTIONS: Record<TicketStatus, string> = {
  OPEN: 'Your ticket has been created and is waiting to be assigned to an engineer.',
  IN_PROGRESS: 'An engineer is actively working on your ticket.',
  WAITING_ON_REQUESTER: 'The engineer needs more information from you. Please check for updates or questions.',
  RESOLVED: 'Your ticket has been resolved. Please verify if everything is working as expected.',
  CLOSED: 'This ticket has been closed. If you need further assistance, please create a new ticket.',
  PENDING_APPROVAL: 'Your request is pending approval from your supervisor and/or travel admin.',
};

export default function TicketDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<TicketDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    if (ticketId) {
      fetchTicket();
    }
  }, [ticketId]);

  const fetchTicket = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch ticket');
      }
      const data = await res.json();
      setTicket(data.ticket);
    } catch (error) {
      console.error('Error fetching ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    if (!noteText.trim() || !ticket) return;

    try {
      setAddingNote(true);
      
      // Use unified endpoint for all users
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: noteText.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add comment');
      }

      setNoteText('');
      fetchTicket(); // Refresh to show new comment
    } catch (error: any) {
      console.error('Error adding comment:', error);
      alert(error.message || 'Failed to add comment');
    } finally {
      setAddingNote(false);
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

  const getEventIcon = (type: EventType) => {
    switch (type) {
      case 'CREATED':
        return <Ticket className="h-4 w-4 text-blue-600" />;
      case 'ASSIGNED':
        return <UserCheck className="h-4 w-4 text-green-600" />;
      case 'STATUS_CHANGED':
        return <ArrowRight className="h-4 w-4 text-yellow-600" />;
      case 'PRIORITY_CHANGED':
        return <Tag className="h-4 w-4 text-orange-600" />;
      case 'NOTE_ADDED':
        return <MessageSquare className="h-4 w-4 text-gray-600" />;
      case 'APPROVAL_REQUESTED':
        return <Shield className="h-4 w-4 text-purple-600" />;
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'REJECTED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getEventDescription = (event: TicketEvent) => {
    const creatorName = event.creator.profile?.empName || event.creator.email.split('@')[0];
    
    switch (event.type) {
      case 'CREATED':
        return `Ticket created by ${creatorName}`;
      case 'ASSIGNED':
        return event.payload.action === 'unassigned'
          ? `Ticket unassigned by ${creatorName}`
          : `Ticket assigned by ${creatorName}`;
      case 'STATUS_CHANGED':
        return `${creatorName} changed status from ${event.payload.oldStatus} to ${event.payload.newStatus}`;
      case 'PRIORITY_CHANGED':
        return `${creatorName} changed priority from ${event.payload.oldPriority} to ${event.payload.newPriority}`;
      case 'NOTE_ADDED':
        return `${creatorName} added a note`;
      case 'APPROVAL_REQUESTED':
        return `Approval requested from ${event.payload.approverEmails?.join(', ') || 'approvers'}`;
      case 'APPROVED':
        return `${creatorName} approved (${event.payload.level || 'approver'})`;
      case 'REJECTED':
        return `${creatorName} rejected (${event.payload.level || 'approver'})`;
      default:
        return `Event by ${creatorName}`;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Spinner className="mx-auto mb-4" />
          <p className="text-sm text-gray-600">Loading ticket details...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-gray-600">Ticket not found</p>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  // Combine events and approvals into a timeline
  const timelineItems: Array<{
    type: 'event' | 'approval';
    data: TicketEvent | TicketApproval;
    timestamp: string;
  }> = [
    ...ticket.events.map((e) => ({ type: 'event' as const, data: e, timestamp: e.createdAt })),
    ...ticket.approvals.map((a) => ({
      type: 'approval' as const,
      data: a,
      timestamp: a.decidedAt || a.requestedAt,
    })),
  ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const canAddNotes = ticket.isAssignedEngineer || ticket.isAdmin;
  const canAddComments = ticket.isRequester || ticket.isAssignedEngineer || ticket.isAdmin;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Ticket Details</h1>
          <p className="mt-1 text-sm text-gray-600">
            View complete ticket information and history
          </p>
        </div>
        <BackToHome />
      </div>

      {/* Ticket Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Ticket className="h-6 w-6 text-blue-600" />
                <CardTitle className="text-xl">{ticket.ticketNumber}</CardTitle>
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
              <h2 className="text-lg font-semibold text-gray-900 mt-2">{ticket.title}</h2>
              
              {/* Status Description for Regular Users */}
              {ticket.isRequester && !ticket.isAdmin && (
                <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-blue-900">Status Information</p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        {STATUS_DESCRIPTIONS[ticket.status]}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left Column - Ticket Info */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Requester</p>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">
                      {ticket.requester.profile?.empName || ticket.requester.email}
                    </p>
                    <p className="text-xs text-gray-500">{ticket.requester.email}</p>
                    {ticket.requester.profile?.employeeId && (
                      <p className="text-xs text-gray-500">ID: {ticket.requester.profile.employeeId}</p>
                    )}
                  </div>
                </div>
              </div>

              {ticket.assignments.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Assigned To</p>
                  {ticket.assignments
                    .filter((a) => !a.assignedAt.includes('unassigned'))
                    .map((assignment) => (
                      <div key={assignment.id} className="flex items-center gap-2 mb-2">
                        <UserCheck className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-sm font-medium">
                            {assignment.engineer.profile?.empName || assignment.engineer.email}
                          </p>
                          <p className="text-xs text-gray-500">
                            Assigned {formatDate(assignment.assignedAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {ticket.approvals.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Approvals</p>
                  <div className="space-y-2">
                    {ticket.approvals.map((approval) => (
                      <div key={approval.id} className="flex items-start gap-2">
                        {approval.state === 'PENDING' && (
                          <Clock className="h-4 w-4 text-yellow-600 mt-0.5" />
                        )}
                        {approval.state === 'APPROVED' && (
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                        )}
                        {approval.state === 'REJECTED' && (
                          <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{approval.approverEmail}</p>
                          <p className="text-xs text-gray-500">
                            {approval.state === 'PENDING'
                              ? `Requested ${formatDate(approval.requestedAt)}`
                              : `${approval.state} ${approval.decidedAt ? formatDate(approval.decidedAt) : ''}`}
                          </p>
                          {approval.note && (
                            <p className="text-xs text-gray-600 mt-1 italic">"{approval.note}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Metadata */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Created</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <p className="text-sm">{formatDate(ticket.createdAt)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Last Updated</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <p className="text-sm">{formatDate(ticket.updatedAt)}</p>
                </div>
              </div>

              {ticket.resolvedAt && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Resolved</p>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <p className="text-sm">{formatDate(ticket.resolvedAt)}</p>
                  </div>
                </div>
              )}

              {ticket.closedAt && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Closed</p>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-gray-600" />
                    <p className="text-sm">{formatDate(ticket.closedAt)}</p>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Domain</p>
                <Badge variant="outline">{ticket.domain}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Support Section for Regular Users */}
      {ticket.isRequester && !ticket.isAdmin && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-blue-600" />
                  Need Help?
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Have a question or need to provide additional information about this ticket?
                </p>
                <div className="flex flex-wrap gap-2">
                  {ticket.assignments.length > 0 && (
                    <a
                      href={`mailto:${ticket.assignments[0].engineer.email}?subject=Re: ${ticket.ticketNumber} - ${ticket.title}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-blue-300 rounded-md text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      Email Assigned Engineer
                    </a>
                  )}
                  {ticket.domain === 'IT' && (
                    <a
                      href={`mailto:${process.env.NEXT_PUBLIC_IT_SERVICEDESK_EMAIL || 'it-support@trianz.com'}?subject=${ticket.ticketNumber} - ${ticket.title}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-blue-300 rounded-md text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      Contact IT Support
                    </a>
                  )}
                  {ticket.domain === 'TRAVEL' && (
                    <a
                      href={`mailto:${process.env.NEXT_PUBLIC_TRAVEL_DESK_EMAIL || 'travel@trianz.com'}?subject=${ticket.ticketNumber} - ${ticket.title}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-blue-300 rounded-md text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      Contact Travel Desk
                    </a>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Comment/Note Section */}
      {canAddComments && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {ticket.isRequester && !ticket.isAdmin ? 'Add Comment or Question' : 'Add Note'}
            </CardTitle>
            {ticket.isRequester && !ticket.isAdmin && (
              <p className="text-sm text-gray-600 mt-1">
                Add a comment or question. The assigned engineer or admin will see this and can respond.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <textarea
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder={ticket.isRequester && !ticket.isAdmin 
                  ? "Add a comment, question, or provide additional information..."
                  : "Add a note or comment..."}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                disabled={addingNote}
              />
              <Button
                onClick={addNote}
                disabled={!noteText.trim() || addingNote}
                className="w-full sm:w-auto"
              >
                {addingNote ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Adding...
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {ticket.isRequester && !ticket.isAdmin ? 'Add Comment' : 'Add Note'}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {timelineItems.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No timeline events</p>
          ) : (
            <div className="space-y-4">
              {timelineItems.map((item, index) => (
                <div key={item.type === 'event' ? item.data.id : `approval-${item.data.id}`} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                      {item.type === 'event' ? getEventIcon((item.data as TicketEvent).type) : (
                        (item.data as TicketApproval).state === 'PENDING' ? (
                          <Clock className="h-4 w-4 text-yellow-600" />
                        ) : (item.data as TicketApproval).state === 'APPROVED' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )
                      )}
                    </div>
                    {index < timelineItems.length - 1 && (
                      <div className="h-full w-0.5 bg-gray-200 mt-2" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {item.type === 'event' ? (
                          <>
                            <p className="text-sm font-medium text-gray-900">
                              {getEventDescription(item.data as TicketEvent)}
                            </p>
                            {(item.data as TicketEvent).type === 'NOTE_ADDED' && (
                              <div className="mt-2 rounded-lg bg-gray-50 p-3">
                                <p className="text-sm text-gray-700">
                                  {(item.data as TicketEvent).payload.note}
                                </p>
                              </div>
                            )}
                            {(item.data as TicketEvent).type === 'APPROVED' && (item.data as TicketEvent).payload.note && (
                              <p className="text-xs text-gray-600 mt-1 italic">
                                Note: {(item.data as TicketEvent).payload.note}
                              </p>
                            )}
                            {(item.data as TicketEvent).type === 'REJECTED' && (item.data as TicketEvent).payload.note && (
                              <p className="text-xs text-red-600 mt-1 italic">
                                Reason: {(item.data as TicketEvent).payload.note}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-gray-900">
                              Approval {(item.data as TicketApproval).state.toLowerCase()}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {(item.data as TicketApproval).approverEmail}
                            </p>
                            {(item.data as TicketApproval).note && (
                              <p className="text-xs text-gray-600 mt-1 italic">
                                "{(item.data as TicketApproval).note}"
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 ml-4">
                        {formatDate(item.timestamp)}
                      </p>
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

