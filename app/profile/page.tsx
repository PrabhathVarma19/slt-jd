'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { BackToHome } from '@/components/ui/back-to-home';
import {
  User,
  Mail,
  Briefcase,
  MapPin,
  Shield,
  Calendar,
  Ticket,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_REQUESTER' | 'RESOLVED' | 'CLOSED';
type TicketType = 'IT' | 'TRAVEL';
type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface UserProfile {
  employeeId?: number;
  empName?: string;
  gradeCode?: string;
  location?: string;
  projectCode?: string;
  projectName?: string;
  orgGroup?: string;
  pmEmail?: string;
  dmEmail?: string;
  supervisorEmail?: string;
  lastSyncedAt?: string;
}

interface UserTicket {
  id: string;
  ticketNumber: string;
  type: TicketType;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  resolvedAt?: string;
  assignments?: Array<{
    engineer?: {
      email: string;
      profile?: {
        empName?: string;
      };
    };
  }>;
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

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{
    email: string;
    profile?: UserProfile;
    roles?: string[];
  } | null>(null);
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    fetchTickets();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch profile');
      }
      const data = await res.json();
      setProfile(data.user);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async () => {
    try {
      setTicketsLoading(true);
      const res = await fetch('/api/profile/tickets?limit=20');
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setTicketsLoading(false);
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
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mx-auto" />
          <p className="text-sm text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-gray-600">Failed to load profile</p>
        </div>
      </div>
    );
  }

  const userProfile = profile.profile;
  const isAdmin = profile.roles?.some((role) =>
    ['ADMIN_IT', 'ADMIN_TRAVEL', 'ADMIN_HR', 'SUPER_ADMIN'].includes(role)
  );
  const hasProfileData = userProfile && userProfile.employeeId;
  const isPredefinedAccount = !hasProfileData;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">My Profile</h1>
          <p className="mt-1 text-sm text-gray-600">
            View your profile information and ticket history
          </p>
        </div>
        <BackToHome />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar
                  email={profile.email}
                  name={userProfile?.empName}
                  size="lg"
                />
                <div className="flex-1">
                  <CardTitle className="text-xl">
                    {userProfile?.empName || profile.email.split('@')[0]}
                  </CardTitle>
                  <p className="text-sm text-gray-500 mt-1">{profile.email}</p>
                  {isAdmin && (
                    <Badge className="mt-2 bg-purple-100 text-purple-700">
                      <Shield className="mr-1 h-3 w-3" />
                      Admin
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isPredefinedAccount && (
                <div className="mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-blue-900">Predefined Account</p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        Profile information is not synced from external systems for this account.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!hasProfileData && (
                <div className="space-y-3 pb-2 border-b">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="text-sm font-medium">{profile.email}</p>
                    </div>
                  </div>
                  {profile.roles && profile.roles.length > 0 && (
                    <div className="flex items-start gap-3">
                      <Shield className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-500">Roles</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {profile.roles.map((role) => (
                            <Badge key={role} className="bg-gray-100 text-gray-700 text-xs">
                              {role.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {userProfile?.employeeId && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Employee ID</p>
                    <p className="text-sm font-medium">{userProfile.employeeId}</p>
                  </div>
                </div>
              )}

              {userProfile?.gradeCode && (
                <div className="flex items-start gap-3">
                  <Briefcase className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Grade</p>
                    <p className="text-sm font-medium">Grade {userProfile.gradeCode}</p>
                  </div>
                </div>
              )}

              {userProfile?.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Location</p>
                    <p className="text-sm font-medium">{userProfile.location}</p>
                  </div>
                </div>
              )}

              {userProfile?.projectCode && (
                <div className="flex items-start gap-3">
                  <Briefcase className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Project</p>
                    <p className="text-sm font-medium">
                      {userProfile.projectCode}
                      {userProfile.projectName && ` - ${userProfile.projectName}`}
                    </p>
                  </div>
                </div>
              )}

              {userProfile?.orgGroup && (
                <div className="flex items-start gap-3">
                  <Briefcase className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Organization</p>
                    <p className="text-sm font-medium">{userProfile.orgGroup}</p>
                  </div>
                </div>
              )}

              {userProfile?.supervisorEmail && (
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Supervisor</p>
                    <p className="text-sm font-medium">{userProfile.supervisorEmail}</p>
                  </div>
                </div>
              )}

              {userProfile?.pmEmail && (
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Project Manager</p>
                    <p className="text-sm font-medium">{userProfile.pmEmail}</p>
                  </div>
                </div>
              )}

              {userProfile?.dmEmail && (
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Delivery Manager</p>
                    <p className="text-sm font-medium">{userProfile.dmEmail}</p>
                  </div>
                </div>
              )}

              {userProfile?.lastSyncedAt && (
                <div className="flex items-start gap-3 pt-2 border-t">
                  <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Last Synced</p>
                    <p className="text-sm font-medium">
                      {formatDate(userProfile.lastSyncedAt)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tickets History */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                My Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ticketsLoading ? (
                <div className="py-8 text-center">
                  <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mx-auto" />
                  <p className="text-sm text-gray-600">Loading tickets...</p>
                </div>
              ) : tickets.length === 0 ? (
                <div className="py-8 text-center">
                  <Ticket className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">No tickets found</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Tickets you create will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-gray-900">
                              {ticket.ticketNumber}
                            </span>
                            <Badge className={STATUS_COLORS[ticket.status]}>
                              <span className="flex items-center gap-1">
                                {STATUS_ICONS[ticket.status]}
                                {ticket.status.replace(/_/g, ' ')}
                              </span>
                            </Badge>
                            <Badge className={PRIORITY_COLORS[ticket.priority]}>
                              {ticket.priority}
                            </Badge>
                          </div>
                          <h3 className="font-medium text-gray-900 mb-1">
                            {ticket.title}
                          </h3>
                          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                            {ticket.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Type: {ticket.type}</span>
                            <span>Created: {formatDate(ticket.createdAt)}</span>
                            {ticket.resolvedAt && (
                              <span>Resolved: {formatDate(ticket.resolvedAt)}</span>
                            )}
                          </div>
                          {ticket.assignments && ticket.assignments.length > 0 && (
                            <div className="mt-2 text-xs text-gray-500">
                              Assigned to:{' '}
                              {ticket.assignments
                                .map(
                                  (a) =>
                                    a.engineer?.profile?.empName ||
                                    a.engineer?.email ||
                                    'Unknown'
                                )
                                .join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


