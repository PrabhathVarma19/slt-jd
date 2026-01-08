'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BackToHome } from '@/components/ui/back-to-home';
import { Spinner } from '@/components/ui/spinner';
import {
  CheckCircle,
  XCircle,
  Ticket,
  User,
  Mail,
  Calendar,
  Shield,
} from 'lucide-react';

interface Approval {
  id: string;
  ticketId: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  requestedAt: string;
  requester: {
    email: string;
    name?: string;
    employeeId?: number;
    supervisorEmail?: string;
  };
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
};

export default function TravelAdminApprovalsPage() {
  const router = useRouter();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchApprovals();
  }, []);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/approvals/travel-admin');
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch approvals');
      }
      const data = await res.json();
      setApprovals(data.approvals || []);
    } catch (error) {
      console.error('Error fetching approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (approvalId: string, action: 'approve' | 'reject') => {
    try {
      setProcessingId(approvalId);
      const res = await fetch('/api/approvals/travel-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approvalId,
          action,
          note: note[approvalId] || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to process approval');
      }

      // Remove from list
      setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
      setNote((prev) => {
        const newNote = { ...prev };
        delete newNote[approvalId];
        return newNote;
      });
    } catch (error: any) {
      alert(error.message || 'Failed to process approval');
    } finally {
      setProcessingId(null);
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Spinner className="mx-auto mb-4" />
          <p className="text-sm text-gray-600">Loading approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Travel Admin Approvals</h1>
          <p className="mt-1 text-sm text-gray-600">
            Review and approve travel requests (after supervisor approval)
          </p>
        </div>
        <BackToHome />
      </div>

      {approvals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600">No pending approvals</p>
            <p className="text-xs text-gray-500 mt-1">
              All travel requests have been reviewed
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <Card key={approval.id} className="border-l-4 border-l-purple-500">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-5 w-5 text-purple-600" />
                      <Ticket className="h-5 w-5 text-purple-600" />
                      <CardTitle className="text-lg">{approval.ticketNumber}</CardTitle>
                      <Badge className={PRIORITY_COLORS[approval.priority] || PRIORITY_COLORS.MEDIUM}>
                        {approval.priority}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{approval.title}</h3>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>
                          {approval.requester.name || approval.requester.email}
                          {approval.requester.employeeId && ` (${approval.requester.employeeId})`}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span>{approval.requester.email}</span>
                      </div>
                      {approval.requester.supervisorEmail && (
                        <div className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          <span>Supervisor: {approval.requester.supervisorEmail}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Requested: {formatDate(approval.requestedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                    <div className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-green-900">Supervisor Approved</p>
                        <p className="text-xs text-green-700 mt-0.5">
                          This request has been approved by the supervisor and is ready for travel admin review.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Request Details</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {approval.description}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">
                      Add Note (Optional)
                    </label>
                    <textarea
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows={2}
                      placeholder="Add a note for your approval decision..."
                      value={note[approval.id] || ''}
                      onChange={(e) =>
                        setNote((prev) => ({ ...prev, [approval.id]: e.target.value }))
                      }
                      disabled={processingId === approval.id}
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2 border-t">
                    <Button
                      onClick={() => handleApproval(approval.id, 'approve')}
                      disabled={processingId === approval.id}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {processingId === approval.id ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleApproval(approval.id, 'reject')}
                      disabled={processingId === approval.id}
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                    >
                      {processingId === approval.id ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          Reject
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

