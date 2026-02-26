'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Clock3, Ticket, Sparkles, X } from 'lucide-react';
import Button from '@/components/ui/button';
import { useToast } from '@/lib/hooks/useToast';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

type ToolBucket = 'Ask' | 'Requests' | 'Outputs' | 'Admin';

interface Tool {
  title: string;
  description: string;
  href: string;
  bucket: ToolBucket;
  initials: string;
  accent: string;
}

type HomeThreadItem = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  runId?: string | null;
  intent?: string;
  status?: string;
  actionCard?: {
    type: 'confirm' | 'info' | 'result' | 'error';
    title: string;
    description: string;
    data?: Record<string, any>;
  };
  requiresConfirmation?: boolean;
};

type HistoryTicketItem = {
  id: string;
  ticketNumber: string;
  title: string;
  status: string;
  type: string;
  createdAt: string;
};

type HomeHistoryRunItem = {
  id: string;
  createdAt: string;
  status: string;
  intent: string;
  message: string;
  description: string;
  routeTo?: string | null;
  ticketId?: string | null;
  ticketNumber?: string | null;
};

const TOOLS: Tool[] = [
  {
    title: 'Ask Beacon',
    description: 'Get policy and "how do I..." answers with citations.',
    href: '/policy-agent',
    bucket: 'Ask',
    initials: 'AB',
    accent: 'bg-sky-100 text-sky-700',
  },
  {
    title: 'New Joiner Buddy',
    description: 'Help new joiners through their first 90 days.',
    href: '/new-joiner',
    bucket: 'Ask',
    initials: 'NJ',
    accent: 'bg-emerald-100 text-emerald-700',
  },
  {
    title: 'Service Desk',
    description: 'Format and email IT / access requests.',
    href: '/service-desk',
    bucket: 'Requests',
    initials: 'SD',
    accent: 'bg-slate-100 text-slate-700',
  },
  {
    title: 'My Tickets',
    description: 'Track requests you have raised and open ticket details.',
    href: '/my-tickets',
    bucket: 'Requests',
    initials: 'MT',
    accent: 'bg-blue-100 text-blue-700',
  },
  {
    title: 'Travel Desk',
    description: 'Create travel request emails with all required details.',
    href: '/travel-desk',
    bucket: 'Requests',
    initials: 'TD',
    accent: 'bg-cyan-100 text-cyan-700',
  },
  {
    title: 'Comms Hub',
    description: 'Draft newsletters and change notices from updates.',
    href: '/comms-hub',
    bucket: 'Outputs',
    initials: 'CH',
    accent: 'bg-fuchsia-100 text-fuchsia-700',
  },
  {
    title: 'Engineering Tools',
    description: 'Generate release notes, PR summaries, and post-mortems.',
    href: '/engineering-tools',
    bucket: 'Outputs',
    initials: 'ET',
    accent: 'bg-emerald-100 text-emerald-700',
  },
  {
    title: 'Weekly Initiatives',
    description: 'Turn weekly updates into a concise weekly brief.',
    href: '/weekly-brief',
    bucket: 'Outputs',
    initials: 'WI',
    accent: 'bg-amber-100 text-amber-700',
  },
  {
    title: 'Create JD',
    description: 'Generate structured role descriptions and skill requirements.',
    href: '/jd',
    bucket: 'Outputs',
    initials: 'JD',
    accent: 'bg-indigo-100 text-indigo-700',
  },
  {
    title: 'Expenses & Fusion Coach',
    description: 'Explain reimbursable expenses and Fusion steps in clear actions.',
    href: '/expenses-coach',
    bucket: 'Outputs',
    initials: 'EX',
    accent: 'bg-teal-100 text-teal-700',
  },
  {
    title: 'PDF to PowerPoint',
    description: 'Convert PDF files to PowerPoint presentations with Trianz branding.',
    href: '/pdf-to-ppt',
    bucket: 'Outputs',
    initials: 'PP',
    accent: 'bg-orange-100 text-orange-700',
  },
];

const BUCKET_LABELS: Record<ToolBucket, string> = {
  Ask: 'Ask',
  Requests: 'Requests',
  Outputs: 'Outputs',
  Admin: 'Admin',
};

// Admin tools - only shown to admins
const ADMIN_TOOLS: Tool[] = [
  {
    title: 'Dashboard',
    description: 'View analytics, metrics, and system performance.',
    href: '/admin/dashboard',
    bucket: 'Admin',
    initials: 'DB',
    accent: 'bg-indigo-100 text-indigo-700',
  },
  {
    title: 'Notification failures',
    description: 'Review failed emails and retry notifications.',
    href: '/admin/notifications',
    bucket: 'Admin',
    initials: 'NF',
    accent: 'bg-rose-100 text-rose-700',
  },
  {
    title: 'Ticket Dashboard',
    description: 'View, assign, and manage IT and Travel tickets.',
    href: '/admin/tickets',
    bucket: 'Admin',
    initials: 'TD',
    accent: 'bg-red-100 text-red-700',
  },
  {
    title: 'User Management',
    description: 'Manage users, assign roles, and control access.',
    href: '/admin/users',
    bucket: 'Admin',
    initials: 'UM',
    accent: 'bg-purple-100 text-purple-700',
  },
  {
    title: 'Comms Templates',
    description: 'Edit and publish comms templates used by Beacon.',
    href: '/admin/templates',
    bucket: 'Admin',
    initials: 'CT',
    accent: 'bg-amber-100 text-amber-700',
  },
];

const SUPER_ADMIN_TOOLS: Tool[] = [
  {
    title: 'Agent Logs',
    description: 'Audit AI decisions, tools, and responses.',
    href: '/admin/agent-logs',
    bucket: 'Admin',
    initials: 'AL',
    accent: 'bg-slate-100 text-slate-700',
  },
  {
    title: 'Home Metrics',
    description: 'Track home command usage, approvals, and failure patterns.',
    href: '/admin/home-metrics',
    bucket: 'Admin',
    initials: 'HM',
    accent: 'bg-cyan-100 text-cyan-700',
  },
];

// Engineer tools - only shown to engineers
const ENGINEER_TOOLS: Tool[] = [
  {
    title: 'My Tickets',
    description: 'View and manage tickets assigned to you.',
    href: '/engineer/tickets',
    bucket: 'Admin',
    initials: 'MT',
    accent: 'bg-blue-100 text-blue-700',
  },
];

function getDayGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function toFirstName(raw: string) {
  const normalized = raw.replace(/\./g, ' ').trim();
  if (!normalized) return '';
  return normalized.split(/\s+/)[0] || '';
}

export default function Home() {
  const router = useRouter();
  const { showToast, ToastContainer } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEngineer, setIsEngineer] = useState(false);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [isTravelAdmin, setIsTravelAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [heroGreetingPrefix, setHeroGreetingPrefix] = useState('Hello');
  const [heroGreetingName, setHeroGreetingName] = useState('');

  useEffect(() => {
    setHeroGreetingPrefix(getDayGreeting());
    if (typeof window === 'undefined') return;
    try {
      const cachedUser = window.localStorage.getItem('beacon:user');
      if (!cachedUser) return;
      const parsed = JSON.parse(cachedUser);
      const name = typeof parsed?.name === 'string' ? parsed.name : '';
      const email = typeof parsed?.email === 'string' ? parsed.email : '';
      const derivedName = name || (email ? email.split('@')[0] : '');
      setHeroGreetingName(toFirstName(derivedName));
    } catch {
      // Ignore malformed local cache
    }
  }, []);

  useEffect(() => {
    // Check if user is admin
    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        // Check both isAuthenticated and authenticated properties
        if ((data.isAuthenticated || data.authenticated) && data.user?.roles) {
          const roles = data.user.roles || [];
          setUserRoles(roles);
          // Check if user has any admin role
          const adminRoles = ['ADMIN_IT', 'ADMIN_TRAVEL', 'ADMIN_HR', 'SUPER_ADMIN'];
          const hasAdminRole = roles.some((role: string) => adminRoles.includes(role));
          setIsAdmin(hasAdminRole);
          
          // Check if user has any engineer role
          const engineerRoles = ['ENGINEER_IT', 'ADMIN_IT', 'SUPER_ADMIN'];
          const hasEngineerRole = roles.some((role: string) => engineerRoles.includes(role));
          setIsEngineer(hasEngineerRole);
          
          // Show supervisor approvals link only when user has pending supervisor approvals.
          fetch('/api/approvals/supervisor')
            .then(async (res) => {
              if (!res.ok) return { approvals: [] };
              return res.json();
            })
            .then((approvalData) => {
              const pendingApprovals = Array.isArray(approvalData?.approvals)
                ? approvalData.approvals
                : [];
              setIsSupervisor(pendingApprovals.length > 0);
            })
            .catch(() => {
              setIsSupervisor(false);
            });
          
          // Check if user has travel admin role
          const travelAdminRoles = ['ADMIN_TRAVEL', 'SUPER_ADMIN'];
          const hasTravelAdminRole = roles.some((role: string) => travelAdminRoles.includes(role));
          setIsTravelAdmin(hasTravelAdminRole);
          
          setIsSuperAdmin(roles.includes('SUPER_ADMIN'));
          
        } else {
        }
      })
      .catch((err) => {
        console.error('Session check error:', err);
        // Not logged in or error
      });
  }, []);

  const [homeMessage, setHomeMessage] = useState('');
  const [lastHomeCommand, setLastHomeCommand] = useState('');
  const [homeLoading, setHomeLoading] = useState(false);
  const [homeConfirmLoading, setHomeConfirmLoading] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [homeRunId, setHomeRunId] = useState<string | null>(null);
  const [showHomeDetails, setShowHomeDetails] = useState(false);
  const [homeDraftPatch, setHomeDraftPatch] = useState({
    system: '',
    reason: '',
    details: '',
    durationType: '',
    durationUntil: '',
  });
  const [homeRunDetails, setHomeRunDetails] = useState<{
    steps: Array<{
      id: string;
      stepNo: number;
      phase: string;
      status: string;
      tool?: string | null;
      requiresApproval?: boolean;
      createdAt?: string;
    }>;
    approvals: Array<{
      id: string;
      decision: string;
      reason?: string | null;
      requestedAt?: string;
      decidedAt?: string | null;
    }>;
  } | null>(null);
  const [homeRunDetailsLoading, setHomeRunDetailsLoading] = useState(false);
  const [showRunAuditDetails, setShowRunAuditDetails] = useState(false);
  const [homePdfFile, setHomePdfFile] = useState<File | null>(null);
  const [homePdfLoading, setHomePdfLoading] = useState(false);
  const [homePdfProgress, setHomePdfProgress] = useState(0);
  const [homePdfStage, setHomePdfStage] = useState<'idle' | 'uploading' | 'processing' | 'ready'>('idle');
  const [homePdfLocalError, setHomePdfLocalError] = useState<string | null>(null);
  const [homePdfMode, setHomePdfMode] = useState<'extract' | 'ai' | 'visual'>('ai');
  const [isHomePdfDragging, setIsHomePdfDragging] = useState(false);
  const homePdfGlobalInputRef = useRef<HTMLInputElement | null>(null);
  const homePdfCardInputRef = useRef<HTMLInputElement | null>(null);
  const [homePdfResult, setHomePdfResult] = useState<{
    filename: string;
    pptxBase64: string;
    totalSlides?: number;
  } | null>(null);
  const [homeResult, setHomeResult] = useState<{
    status: string;
    intent: string;
    requiresConfirmation: boolean;
    actionCard: {
      type: 'confirm' | 'info' | 'result' | 'error';
      title: string;
      description: string;
      data?: Record<string, any>;
    };
  } | null>(null);
  const [homeThread, setHomeThread] = useState<HomeThreadItem[]>([]);
  const homeSessionIdRef = useRef(crypto.randomUUID());
  const [showHomeSessionConversation, setShowHomeSessionConversation] = useState(false);
  const [homeInputFocused, setHomeInputFocused] = useState(false);
  type ToolCategory = 'All' | ToolBucket;
  const TOOL_CATEGORIES: ToolCategory[] = ['All', 'Ask', 'Requests', 'Outputs'];
  const [activeToolCategory, setActiveToolCategory] = useState<ToolCategory>('All');
  const [recentItTickets, setRecentItTickets] = useState<string[]>([]);
  const [activeNudgeTickets, setActiveNudgeTickets] = useState<HistoryTicketItem[]>([]);
  const [activeNudgeLoaded, setActiveNudgeLoaded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyTickets, setHistoryTickets] = useState<HistoryTicketItem[]>([]);
  const [historyRuns, setHistoryRuns] = useState<HomeHistoryRunItem[]>([]);
  const temporaryAccessUntilDate = useMemo(() => {
    const now = new Date();
    const quarterEndMonth = Math.floor(now.getMonth() / 3) * 3 + 2;
    const quarterEndDate = new Date(now.getFullYear(), quarterEndMonth + 1, 0);
    const yyyy = quarterEndDate.getFullYear();
    const mm = String(quarterEndDate.getMonth() + 1).padStart(2, '0');
    const dd = String(quarterEndDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);
  const quickPrompts = [
    { label: 'Raise a request', value: 'Raise a request for ' },
    { label: 'Check ticket status', value: 'Check status of ticket ' },
    { label: 'Ask a policy question', value: 'Ask a policy question: ' },
    { label: 'Convert PDF to PPT', value: 'Convert this PDF to PowerPoint' },
  ];
  const ticketAutocompleteSuggestions = useMemo(() => {
    if (recentItTickets.length === 0) return [];

    const text = homeMessage.trim().toLowerCase();
    const hasTicketKeyword = text.includes('ticket');
    if (!text) return recentItTickets.slice(0, 5);

    const ticketLike = text.match(/(it[-_ ]?\d{0,6}|tr[-_ ]?\d{0,6}|\d{1,6})$/i)?.[0] || '';
    if (!ticketLike) {
      return hasTicketKeyword ? recentItTickets.slice(0, 5) : [];
    }

    const normalized = ticketLike.toUpperCase().replace(/[_ ]/g, '-');
    const digitOnly = normalized.replace(/[^0-9]/g, '');
    return recentItTickets
      .filter((ticketNumber) => {
        const upper = ticketNumber.toUpperCase();
        return upper.includes(normalized) || (digitOnly ? upper.includes(digitOnly) : false);
      })
      .slice(0, 5);
  }, [homeMessage, recentItTickets]);
  const hasTicketSignal = homeInputFocused || /\b(ticket|\d{2,})\b/i.test(homeMessage);
  const isItApprovalCard =
    homeResult?.intent === 'create_it_ticket' &&
    homeResult?.requiresConfirmation &&
    !!homeResult?.actionCard?.data;
  const isDuplicateWarningCard =
    !!homeResult?.actionCard?.data?.duplicateTicketNumber &&
    homeResult?.actionCard?.type === 'info';
  const isPdfConvertCard = homeResult?.intent === 'pdf_to_ppt_convert';
  const shouldShowActiveActionCard =
    !!homeResult?.actionCard && (isItApprovalCard || isPdfConvertCard || isDuplicateWarningCard);
  const isNeedsReviewStatus = isDuplicateWarningCard;
  const latestAssistantEntry = useMemo(
    () => [...homeThread].reverse().find((entry) => entry.role === 'assistant') || null,
    [homeThread]
  );
  const latestAssistantRouteTo =
    typeof latestAssistantEntry?.actionCard?.data?.routeTo === 'string'
      ? latestAssistantEntry.actionCard.data.routeTo
      : latestAssistantEntry?.intent === 'check_ticket_status' &&
          typeof latestAssistantEntry?.actionCard?.data?.ticket?.id === 'string'
        ? `/tickets/${latestAssistantEntry.actionCard.data.ticket.id}`
        : null;
  const isCreateTicketCompleted =
    homeResult?.intent === 'create_it_ticket' &&
    String(homeResult?.status || '').toUpperCase() === 'COMPLETED' &&
    !homeResult?.requiresConfirmation;
  const homeViewTicketRoute =
    isCreateTicketCompleted &&
    typeof homeResult?.actionCard?.data?.routeTo === 'string' &&
    homeResult.actionCard.data.routeTo.trim().length > 0
      ? homeResult.actionCard.data.routeTo
      : isCreateTicketCompleted &&
          typeof homeResult?.actionCard?.data?.ticket?.id === 'string' &&
          homeResult.actionCard.data.ticket.id.trim().length > 0
        ? `/tickets/${homeResult.actionCard.data.ticket.id}`
        : isCreateTicketCompleted &&
            typeof homeResult?.actionCard?.data?.ticketId === 'string' &&
            homeResult.actionCard.data.ticketId.trim().length > 0
          ? `/tickets/${homeResult.actionCard.data.ticketId}`
          : null;
  const shouldShowViewTicketCta = Boolean(homeViewTicketRoute);
  const itMissingFields =
    Array.isArray(homeResult?.actionCard?.data?.missingFields) &&
    homeResult?.actionCard?.data?.missingFields?.length
      ? homeResult.actionCard.data.missingFields
      : [];
  const homeStatusLabel = homeLoading
    ? 'Running'
    : homeConfirmLoading
      ? 'Submitting'
      : isNeedsReviewStatus
        ? 'Needs Review'
        : homeResult?.requiresConfirmation
          ? 'Awaiting Approval'
          : homeResult
            ? 'Done'
            : 'Ready';
  const homeStatusClass = homeLoading || homeConfirmLoading
    ? 'bg-amber-100 text-amber-800'
    : isNeedsReviewStatus
      ? 'bg-amber-100 text-amber-800'
      : homeResult?.requiresConfirmation
      ? 'bg-blue-100 text-blue-800'
      : homeResult
        ? 'bg-emerald-100 text-emerald-800'
        : 'bg-slate-100 text-slate-700';

  const historyTimeline = useMemo(() => {
    const ticketEntries = historyTickets.map((ticket) => ({
      key: `ticket-${ticket.id}`,
      createdAt: ticket.createdAt,
      type: 'ticket' as const,
      ticket,
    }));
    const commandEntries = historyRuns.map((run) => ({
      key: `run-${run.id}`,
      createdAt: run.createdAt,
      type: 'command' as const,
      run,
    }));
    return [...ticketEntries, ...commandEntries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [historyRuns, historyTickets]);

  const groupedHistory = useMemo(() => {
    const groups = {
      Today: [] as typeof historyTimeline,
      'This week': [] as typeof historyTimeline,
      Earlier: [] as typeof historyTimeline,
    };
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - 7);

    historyTimeline.forEach((entry) => {
      const when = new Date(entry.createdAt);
      if (Number.isNaN(when.getTime())) {
        groups.Earlier.push(entry);
      } else if (when >= todayStart) {
        groups.Today.push(entry);
      } else if (when >= weekStart) {
        groups['This week'].push(entry);
      } else {
        groups.Earlier.push(entry);
      }
    });

    return groups;
  }, [historyTimeline]);

  const formatHomeFieldLabel = (key: string) =>
    key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();

  const getHomeIntentLabel = (intent?: string) => {
    const normalized = (intent || '').toLowerCase();
    if (normalized === 'policy_question') return 'Policy';
    if (normalized === 'check_ticket_status') return 'Ticket Status';
    if (normalized === 'create_it_ticket') return 'IT Request';
    if (normalized === 'password_reset') return 'Password Reset';
    if (normalized === 'pdf_to_ppt_convert') return 'PDF to PPT';
    if (normalized === 'comms_generate') return 'Comms';
    if (normalized === 'engineering_generate') return 'Engineering';
    if (normalized === 'jd_generate') return 'JD';
    return intent ? intent.replace(/_/g, ' ') : 'Response';
  };

  const formatStatusLabel = (status?: string) => {
    if (!status) return 'Unknown';
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
  };

  const historyStatusClass = (status?: string) => {
    const normalized = (status || '').toUpperCase();
    if (['OPEN', 'IN_PROGRESS', 'WAITING_ON_REQUESTER', 'RUNNING'].includes(normalized)) {
      return 'bg-blue-100 text-blue-800';
    }
    if (['RESOLVED', 'COMPLETED'].includes(normalized)) {
      return 'bg-emerald-100 text-emerald-800';
    }
    if (['CLOSED', 'CANCELLED'].includes(normalized)) {
      return 'bg-slate-100 text-slate-700';
    }
    if (['FAILED', 'REJECTED'].includes(normalized)) {
      return 'bg-rose-100 text-rose-800';
    }
    return 'bg-slate-100 text-slate-700';
  };

  const renderHomeActionDetails = () => {
    const data = homeResult?.actionCard?.data;
    if (!data) return null;

    if (homeResult?.intent === 'create_it_ticket') {
      const duration =
        data.durationType && data.durationUntil
          ? `${data.durationType} (until ${data.durationUntil})`
          : data.durationType || data.durationUntil || '-';

      const rows: Array<{ label: string; value: string }> = [
        { label: 'Request Type', value: data.requestType || '-' },
        { label: 'System', value: data.system || '-' },
        { label: 'Impact', value: data.impact || '-' },
        { label: 'Business Reason', value: data.reason || '-' },
        { label: 'Duration', value: duration },
        { label: 'Details', value: data.details || '-' },
      ];

      return (
        <div className="mt-2 rounded-lg bg-white p-3 text-xs text-slate-700 space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="grid gap-1 sm:grid-cols-[140px_1fr]">
              <p className="font-semibold text-slate-600">{row.label}</p>
              <p className="break-words">{row.value}</p>
            </div>
          ))}
        </div>
      );
    }

    const entries = Object.entries(data).filter(([key]) => key !== 'missingFields');
    return (
      <div className="mt-2 rounded-lg bg-white p-3 text-xs text-slate-700 space-y-2">
        {entries.map(([key, value]) => (
          <div key={key} className="grid gap-1 sm:grid-cols-[140px_1fr]">
            <p className="font-semibold text-slate-600">{formatHomeFieldLabel(key)}</p>
            <p className="break-words">
              {typeof value === 'string'
                ? value
                : value == null
                  ? '-'
                  : JSON.stringify(value)}
            </p>
          </div>
        ))}
      </div>
    );
  };

  useEffect(() => {
    const data = homeResult?.actionCard?.data || {};
    const missingFields = Array.isArray(data.missingFields) ? data.missingFields : [];
    setHomeDraftPatch({
      system: typeof data.system === 'string' ? data.system : '',
      reason:
        missingFields.includes('reason')
          ? ''
          : typeof data.reason === 'string'
            ? data.reason
            : '',
      details:
        missingFields.includes('details')
          ? ''
          : typeof data.details === 'string'
            ? data.details
            : '',
      durationType: typeof data.durationType === 'string' ? data.durationType : '',
      durationUntil: typeof data.durationUntil === 'string' ? data.durationUntil : '',
    });
  }, [homeResult]);

  useEffect(() => {
    const fetchRecentTickets = async () => {
      try {
        const res = await fetch('/api/profile/tickets?type=IT&limit=5');
        if (!res.ok) return;
        const data = await res.json();
        const numbers = Array.isArray(data?.tickets)
          ? data.tickets
              .map((ticket: any) => ticket?.ticketNumber)
              .filter((ticketNumber: unknown) => typeof ticketNumber === 'string')
          : [];
        setRecentItTickets(Array.from(new Set(numbers)));
      } catch (err) {
        console.error('Failed to load recent IT tickets:', err);
      }
    };

    fetchRecentTickets();
  }, []);

  useEffect(() => {
    const fetchActiveNudgeTickets = async () => {
      try {
        const res = await fetch('/api/notifications/count', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || data?.error) {
          throw new Error(data?.error || 'Failed to load active tickets');
        }

        const nextTickets: HistoryTicketItem[] = Array.isArray(data?.activeTickets)
          ? data.activeTickets
              .slice(0, 3)
              .filter((ticket: any) => typeof ticket?.id === 'string')
              .map((ticket: any) => ({
                id: ticket.id,
                ticketNumber: ticket.ticketNumber || ticket.id,
                title: ticket.title || 'Ticket',
                status: ticket.status || 'OPEN',
                type: 'IT',
                createdAt: ticket.createdAt || new Date().toISOString(),
              }))
          : [];
        setActiveNudgeTickets(nextTickets);
      } catch (error) {
        console.error('Failed to load open ticket nudge:', error);
      } finally {
        setActiveNudgeLoaded(true);
      }
    };

    fetchActiveNudgeTickets();
  }, []);

  const fetchHistoryData = useCallback(async (force = false) => {
    if (historyLoading) return;
    if (historyLoaded && !force) return;

    try {
      setHistoryLoading(true);
      setHistoryError(null);

      const [ticketRes, runRes] = await Promise.all([
        fetch('/api/profile/tickets?limit=25'),
        fetch('/api/home/history?limit=25'),
      ]);

      const ticketData = await ticketRes.json();
      const runData = await runRes.json();

      if (!ticketRes.ok || ticketData?.error) {
        throw new Error(ticketData?.error || 'Failed to load ticket history');
      }
      if (!runRes.ok || runData?.error) {
        throw new Error(runData?.error || 'Failed to load command history');
      }

      const nextTickets: HistoryTicketItem[] = Array.isArray(ticketData?.tickets)
        ? ticketData.tickets
            .filter((ticket: any) => typeof ticket?.id === 'string')
            .map((ticket: any) => ({
              id: ticket.id,
              ticketNumber: ticket.ticketNumber || ticket.id,
              title: ticket.title || 'Ticket',
              status: ticket.status || 'OPEN',
              type: ticket.type || 'IT',
              createdAt: ticket.createdAt || ticket.updatedAt || new Date().toISOString(),
            }))
        : [];

      const nextRuns: HomeHistoryRunItem[] = Array.isArray(runData?.runs)
        ? runData.runs
            .filter((run: any) => typeof run?.id === 'string')
            .map((run: any) => ({
              id: run.id,
              createdAt: run.createdAt || new Date().toISOString(),
              status: run.status || 'COMPLETED',
              intent: run.intent || 'unknown',
              message: typeof run.message === 'string' ? run.message : '',
              description: typeof run.description === 'string' ? run.description : '',
              routeTo: typeof run.routeTo === 'string' ? run.routeTo : null,
              ticketId: typeof run.ticketId === 'string' ? run.ticketId : null,
              ticketNumber: typeof run.ticketNumber === 'string' ? run.ticketNumber : null,
            }))
        : [];

      setHistoryTickets(nextTickets);
      setHistoryRuns(nextRuns);
      setHistoryLoaded(true);
    } catch (error: any) {
      setHistoryError(error?.message || 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyLoaded, historyLoading]);

  useEffect(() => {
    if (!historyOpen) return;
    fetchHistoryData();
  }, [historyOpen, fetchHistoryData]);

  const pushHomeThreadUser = (text: string) => {
    setHomeThread((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'user',
        text,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const pushHomeThreadAssistant = (payload: {
    text: string;
    runId?: string | null;
    intent?: string;
    status?: string;
    actionCard?: HomeThreadItem['actionCard'];
    requiresConfirmation?: boolean;
  }) => {
    setHomeThread((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: payload.text,
        createdAt: new Date().toISOString(),
        runId: payload.runId || null,
        intent: payload.intent,
        status: payload.status,
        actionCard: payload.actionCard,
        requiresConfirmation: payload.requiresConfirmation,
      },
    ]);
  };

  const submitHomeCommand = async (messageOverride?: string) => {
    const message = (messageOverride ?? homeMessage).trim();
    if (!message) return;

    try {
      setHomeLoading(true);
      setHomeError(null);
      setLastHomeCommand(message);
      pushHomeThreadUser(message);

      const res = await fetch('/api/home/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId: homeSessionIdRef.current }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to process command');
      }

      const nextRunId = data.runId || null;
      setHomeRunId(nextRunId);
      setHomeResult(data);
      setShowHomeDetails(false);
      setHomeRunDetails(null);
      setShowRunAuditDetails(false);
      setHomePdfFile(null);
      setHomePdfResult(null);
      setHomePdfProgress(0);
      setHomePdfStage('idle');
      setHomePdfLocalError(null);
      pushHomeThreadAssistant({
        text: data?.actionCard?.description || 'Request processed.',
        runId: nextRunId,
        intent: data?.intent,
        status: data?.status,
        actionCard: data?.actionCard,
        requiresConfirmation: data?.requiresConfirmation,
      });
      if (nextRunId) {
        setHomeRunDetailsLoading(true);
        try {
          const runRes = await fetch(`/api/home/command/run/${encodeURIComponent(nextRunId)}`);
          const runData = await runRes.json();
          if (runRes.ok && !runData.error) {
            setHomeRunDetails({
              steps: runData.steps || [],
              approvals: runData.approvals || [],
            });
          }
        } catch (err) {
          console.error('Failed to load run details:', err);
        } finally {
          setHomeRunDetailsLoading(false);
        }
      }
      setHomeMessage('');
    } catch (error: any) {
      setHomeError(error?.message || 'Failed to process command');
      pushHomeThreadAssistant({
        text: error?.message || 'Failed to process command',
        status: 'FAILED',
        actionCard: {
          type: 'error',
          title: 'Home Command Failed',
          description: error?.message || 'Failed to process command',
        },
      });
    } finally {
      setHomeLoading(false);
    }
  };

  const runTicketStatusCheck = (ticketNumber: string) => {
    const command = `Check status of ticket ${ticketNumber}`;
    setHomeMessage(command);
    submitHomeCommand(command);
  };

  const resetHomeRunState = () => {
    setHomeResult(null);
    setHomeRunId(null);
    setHomeRunDetails(null);
    setShowHomeSessionConversation(false);
    setShowHomeDetails(false);
    setHomeError(null);
    setShowRunAuditDetails(false);
    setHomePdfFile(null);
    setHomePdfResult(null);
    setHomePdfProgress(0);
    setHomePdfStage('idle');
    setHomePdfLocalError(null);
    homeSessionIdRef.current = crypto.randomUUID();
    setHomeDraftPatch({
      system: '',
      reason: '',
      details: '',
      durationType: '',
      durationUntil: '',
    });
  };

  const confirmHomeAction = async (approve: boolean) => {
    if (!homeRunId) return;
    try {
      setHomeConfirmLoading(true);
      setHomeError(null);

      const res = await fetch('/api/home/command/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: homeRunId, approve, draftPatch: homeDraftPatch }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const isDuplicateConflict =
          res.status === 409 || !!data?.actionCard?.data?.duplicateTicketNumber;
        if (data?.actionCard) {
          setHomeResult((prev) =>
            prev
              ? {
                  ...prev,
                  actionCard: data.actionCard,
                  requiresConfirmation: isDuplicateConflict ? false : true,
                }
              : null
          );
        }
        if (isDuplicateConflict) {
          setHomeError(null);
          pushHomeThreadAssistant({
            text:
              data?.actionCard?.description ||
              'Possible duplicate found. Review existing ticket before submitting.',
            runId: homeRunId,
            intent: homeResult?.intent,
            status: 'COMPLETED',
            actionCard: data?.actionCard,
            requiresConfirmation: false,
          });
          showToast(
            data?.actionCard?.description || 'Possible duplicate found. Review existing ticket first.',
            'info'
          );
          return;
        }
        throw new Error(data.error || 'Failed to process approval');
      }

      setHomeResult((prev) => ({
        status: data.status || prev?.status || 'COMPLETED',
        intent: prev?.intent || 'create_it_ticket',
        requiresConfirmation: false,
        actionCard: data.actionCard || {
          type: 'result',
          title: approve ? 'Action completed' : 'Action cancelled',
          description: approve
            ? 'Your request was submitted.'
            : 'Your request was not submitted.',
        },
      }));
      setShowHomeDetails(false);
      setShowRunAuditDetails(false);
      pushHomeThreadAssistant({
        text:
          data?.actionCard?.description ||
          (approve ? 'Your request was submitted.' : 'Your request was not submitted.'),
        runId: homeRunId,
        intent: homeResult?.intent || 'create_it_ticket',
        status: data?.status || 'COMPLETED',
        actionCard: data?.actionCard || {
          type: 'result',
          title: approve ? 'Action completed' : 'Action cancelled',
          description: approve ? 'Your request was submitted.' : 'Your request was not submitted.',
        },
        requiresConfirmation: false,
      });
      showToast(
        approve
          ? data?.actionCard?.description || 'Request submitted successfully.'
          : data?.actionCard?.description || 'Request cancelled.',
        approve ? 'success' : 'info'
      );
      if (homeRunId) {
        setHomeRunDetailsLoading(true);
        try {
          const runRes = await fetch(`/api/home/command/run/${encodeURIComponent(homeRunId)}`);
          const runData = await runRes.json();
          if (runRes.ok && !runData.error) {
            setHomeRunDetails({
              steps: runData.steps || [],
              approvals: runData.approvals || [],
            });
          }
        } catch (err) {
          console.error('Failed to refresh run details:', err);
        } finally {
          setHomeRunDetailsLoading(false);
        }
      }
    } catch (error: any) {
      setHomeError(error?.message || 'Failed to process approval');
      pushHomeThreadAssistant({
        text: error?.message || 'Failed to process approval',
        runId: homeRunId,
        intent: homeResult?.intent,
        status: 'FAILED',
        actionCard: {
          type: 'error',
          title: 'Approval Failed',
          description: error?.message || 'Failed to process approval',
        },
      });
      showToast(error?.message || 'Failed to process approval', 'error');
    } finally {
      setHomeConfirmLoading(false);
    }
  };

  const chunkHomePdfFile = (file: File, chunkSize = 4 * 1024 * 1024): Blob[] => {
    const chunks: Blob[] = [];
    let start = 0;
    while (start < file.size) {
      const end = Math.min(start + chunkSize, file.size);
      chunks.push(file.slice(start, end));
      start = end;
    }
    return chunks;
  };

  const uploadHomePdfChunked = async (file: File) => {
    const chunks = chunkHomePdfFile(file);
    const sessionId = crypto.randomUUID();
    let finalData: any = null;

    for (let i = 0; i < chunks.length; i++) {
      const formData = new FormData();
      formData.append('chunk', chunks[i]);
      formData.append('sessionId', sessionId);
      formData.append('chunkIndex', i.toString());
      formData.append('totalChunks', chunks.length.toString());
      formData.append('filename', file.name);
      formData.append('extractionMode', homePdfMode);
      formData.append('numSlides', '10');

      const res = await fetch('/api/pdf-to-ppt/chunk', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error || 'Chunk upload failed');
      }
      setHomePdfStage(i < chunks.length - 1 ? 'uploading' : 'processing');
      setHomePdfProgress(Math.round(((i + 1) / chunks.length) * 100));
      if (data?.pptxBase64) {
        finalData = data;
      }
    }

    if (!finalData) throw new Error('Upload completed but conversion result is missing');
    return finalData;
  };

  const uploadHomePdfDirect = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('extractionMode', homePdfMode);
    formData.append('numSlides', '10');

    const res = await fetch('/api/pdf-to-ppt', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok || data?.error) {
      throw new Error(data?.error || 'Failed to convert PDF');
    }
    setHomePdfStage('processing');
    setHomePdfProgress(100);
    return data;
  };

  const showHomePdfConvertCard = () => {
    setHomeResult({
      status: 'COMPLETED',
      intent: 'pdf_to_ppt_convert',
      requiresConfirmation: false,
      actionCard: {
        type: 'info',
        title: 'PDF to PowerPoint Converter',
        description:
          'Upload your PDF in Home to convert now, or open the full converter for advanced options.',
        data: {
          routeTo: '/pdf-to-ppt',
          supportsInlineUpload: true,
          acceptedTypes: ['application/pdf'],
          maxSizeMb: 25,
        },
      },
    });
    setHomeRunId(null);
    setHomeRunDetails(null);
    setShowRunAuditDetails(false);
    setHomeError(null);
  };

  const selectHomePdfFile = (file: File | null) => {
    setHomePdfLocalError(null);
    setHomePdfResult(null);
    setHomePdfProgress(0);
    setHomePdfStage('idle');
    if (!file) {
      setHomePdfFile(null);
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setHomePdfLocalError('Only PDF files are supported.');
      setHomePdfFile(null);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setHomePdfLocalError('File size exceeds 25MB limit.');
      setHomePdfFile(null);
      return;
    }
    setHomePdfFile(file);
    pushHomeThreadUser(`Attached PDF: ${file.name}`);
    pushHomeThreadAssistant({
      text: 'PDF attached. Click Convert to generate PowerPoint.',
      intent: 'pdf_to_ppt_convert',
      status: 'COMPLETED',
      actionCard: {
        type: 'info',
        title: 'PDF Ready',
        description: 'PDF attached. Click Convert to generate PowerPoint.',
      },
      requiresConfirmation: false,
    });
    showHomePdfConvertCard();
  };

  const handleHomePdfConvert = async () => {
    if (!homePdfFile) {
      setHomePdfLocalError('Please upload a PDF file first.');
      return;
    }
    if (
      homePdfFile.type !== 'application/pdf' &&
      !homePdfFile.name.toLowerCase().endsWith('.pdf')
    ) {
      setHomePdfLocalError('Only PDF files are supported.');
      return;
    }
    if (homePdfFile.size > 25 * 1024 * 1024) {
      setHomePdfLocalError('File size exceeds 25MB limit.');
      return;
    }

    try {
      setHomePdfLoading(true);
      setHomePdfLocalError(null);
      setHomePdfResult(null);
      setHomePdfProgress(0);
      setHomePdfStage(homePdfFile.size > 4 * 1024 * 1024 ? 'uploading' : 'processing');

      const data =
        homePdfFile.size > 4 * 1024 * 1024
          ? await uploadHomePdfChunked(homePdfFile)
          : await uploadHomePdfDirect(homePdfFile);

      if (!data?.pptxBase64) {
        throw new Error('Conversion succeeded but PPT file is missing.');
      }
      if (data?.modeUsed && ['extract', 'ai', 'visual'].includes(String(data.modeUsed))) {
        setHomePdfMode(data.modeUsed as 'extract' | 'ai' | 'visual');
      }
      setHomePdfResult({
        filename: data.filename || homePdfFile.name.replace(/\.pdf$/i, '.pptx'),
        pptxBase64: data.pptxBase64,
        totalSlides: data.totalSlides,
      });
      setHomePdfStage('ready');
      if (data?.warning) {
        showToast(String(data.warning), 'info');
      }
      pushHomeThreadAssistant({
        text: `Converted ${homePdfFile.name} successfully.`,
        intent: 'pdf_to_ppt_convert',
        status: 'COMPLETED',
        actionCard: {
          type: 'result',
          title: 'PDF Conversion Complete',
          description: `Converted ${homePdfFile.name} successfully.`,
        },
      });
      showToast('PDF converted successfully.', 'success');
    } catch (error: any) {
      setHomePdfLocalError(error?.message || 'Failed to convert PDF.');
      setHomePdfStage('idle');
      pushHomeThreadAssistant({
        text: error?.message || 'Failed to convert PDF.',
        intent: 'pdf_to_ppt_convert',
        status: 'FAILED',
        actionCard: {
          type: 'error',
          title: 'PDF Conversion Failed',
          description: error?.message || 'Failed to convert PDF.',
        },
      });
      showToast(error?.message || 'Failed to convert PDF.', 'error');
    } finally {
      setHomePdfLoading(false);
    }
  };

  const downloadHomePptx = () => {
    if (!homePdfResult?.pptxBase64) return;
    try {
      const binary = atob(homePdfResult.pptxBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = homePdfResult.filename || 'presentation.pptx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setHomeError('Failed to download PowerPoint file.');
    }
  };

  const TOOL_GROUPS: Record<ToolCategory, Tool[]> = {
    All: TOOLS,
    Ask: TOOLS.filter((t) => t.bucket === 'Ask'),
    Requests: TOOLS.filter((t) => t.bucket === 'Requests'),
    Outputs: TOOLS.filter((t) => t.bucket === 'Outputs'),
    Admin: [], // Admin tools shown separately below
  };

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Text column */}
        <div className="space-y-7">
          <p className="text-sm font-semibold tracking-wide text-slate-500">
            {heroGreetingPrefix}
            {heroGreetingName ? `, ${heroGreetingName}` : ''}
          </p>

          {activeNudgeLoaded && activeNudgeTickets.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-900">
              <Ticket className="h-3.5 w-3.5 text-blue-700" />
              <span>
                {activeNudgeTickets
                  .slice(0, 2)
                  .map((ticket) => `${ticket.ticketNumber} is ${formatStatusLabel(ticket.status)}`)
                  .join(' | ')}
              </span>
              <button
                type="button"
                className="font-semibold underline underline-offset-2"
                onClick={() => setHistoryOpen(true)}
              >
                View all {'->'}
              </button>
            </div>
          )}

          <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
            Beacon is your command center for work requests and policy answers.
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-slate-600">
            Ask policy questions with citations, raise IT and travel requests, and generate
            ready-to-share drafts from one place.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild className="rounded-full px-5">
              <Link href="/policy-agent">Ask Beacon</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-5">
              <Link href="/service-desk">Raise IT request</Link>
            </Button>
          </div>

          <div
            id="home-command-bar"
            className={`max-w-2xl rounded-2xl border bg-white p-4 shadow-sm transition ${
              isHomePdfDragging
                ? 'border-blue-400 ring-2 ring-blue-100'
                : 'border-slate-300/80'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsHomePdfDragging(true);
            }}
            onDragLeave={() => setIsHomePdfDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsHomePdfDragging(false);
              const file = e.dataTransfer?.files?.[0] || null;
              selectHomePdfFile(file);
            }}
          >
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                ref={homePdfGlobalInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => {
                  selectHomePdfFile(e.target.files?.[0] || null);
                  e.currentTarget.value = '';
                }}
                className="hidden"
                disabled={homePdfLoading || homeLoading || homeConfirmLoading}
              />
              <input
                value={homeMessage}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  if (
                    homeResult &&
                    !homeResult.requiresConfirmation &&
                    nextValue.trim() !== homeMessage.trim()
                  ) {
                    resetHomeRunState();
                  }
                  setHomeMessage(nextValue);
                }}
                onFocus={() => setHomeInputFocused(true)}
                onBlur={() => setHomeInputFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !homeLoading && !homeConfirmLoading) {
                    e.preventDefault();
                    submitHomeCommand();
                  }
                }}
                placeholder="Try: I need VPN access for project work"
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-xl px-3"
                onClick={() => {
                  if (!homePdfGlobalInputRef.current) return;
                  homePdfGlobalInputRef.current.value = '';
                  homePdfGlobalInputRef.current.click();
                }}
                disabled={homePdfLoading || homeLoading || homeConfirmLoading}
              >
                Attach PDF
              </Button>
              <Button
                onClick={() => submitHomeCommand()}
                disabled={homeLoading || homeConfirmLoading || !homeMessage.trim()}
                className="rounded-xl px-4"
              >
                {homeLoading ? 'Running...' : homeConfirmLoading ? 'Please wait...' : 'Run'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl px-2"
                onClick={() => setHistoryOpen(true)}
                aria-label="View history"
              >
                <Clock3 className="h-4 w-4" />
              </Button>
            </div>
            {isHomePdfDragging && (
              <p className="mt-1 text-[11px] text-blue-700">Drop PDF to start conversion</p>
            )}
            {homeResult?.requiresConfirmation && (
              <p className="mt-1 text-[11px] text-slate-500">
                Tip: You can type follow-ups like <span className="font-mono">for 2 weeks</span> or{' '}
                <span className="font-mono">for QA team</span> and click Run to update this draft.
              </p>
            )}
            {homeLoading && !homeResult && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                <p className="text-xs font-medium text-amber-800">Analyzing your request...</p>
                <p className="mt-1 text-xs text-amber-700">
                  Routing to the right tool and preparing the next step.
                </p>
              </div>
            )}

            {homeThread.length > 0 && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {showHomeSessionConversation ? 'Conversation' : 'Latest Answer'}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-[11px] text-slate-500 underline underline-offset-2"
                      onClick={() => setShowHomeSessionConversation((prev) => !prev)}
                      disabled={homeLoading || homeConfirmLoading}
                    >
                      {showHomeSessionConversation ? 'Hide session' : 'Show session'}
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-slate-500 underline underline-offset-2"
                      onClick={() => {
                        setHomeThread([]);
                        setShowHomeSessionConversation(false);
                      }}
                      disabled={homeLoading || homeConfirmLoading}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                {showHomeSessionConversation ? (
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {homeThread.map((entry) => (
                      <div
                        key={entry.id}
                        className={`rounded-lg border px-2.5 py-2 text-xs ${
                          entry.role === 'user'
                            ? 'border-slate-300 bg-slate-50'
                            : 'border-blue-100 bg-blue-50/40'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="font-semibold text-slate-700">{entry.role === 'user' ? 'You' : ''}</p>
                          <div className="flex items-center gap-1">
                            {entry.intent && (
                              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                                {getHomeIntentLabel(entry.intent)}
                              </span>
                            )}
                            {entry.requiresConfirmation && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                Approval
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{entry.text}</p>
                      </div>
                    ))}
                  </div>
                ) : latestAssistantEntry ? (
                  <div
                    className={`rounded-lg border px-2.5 py-2 text-xs ${
                      latestAssistantEntry.actionCard?.type === 'error'
                        ? 'border-red-200 bg-red-50'
                        : 'border-blue-100 bg-blue-50/40'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      {latestAssistantEntry.intent && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                          {getHomeIntentLabel(latestAssistantEntry.intent)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{latestAssistantEntry.text}</p>
                    {latestAssistantRouteTo && (
                      <div className="mt-2">
                        <Link
                          href={latestAssistantRouteTo}
                          className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Open ticket details
                        </Link>
                      </div>
                    )}
                    {Array.isArray(latestAssistantEntry.actionCard?.data?.suggestions) &&
                      latestAssistantEntry.actionCard.data.suggestions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {latestAssistantEntry.actionCard.data.suggestions.map((suggestion: string) => (
                            <button
                              key={`latest-suggestion-${suggestion}`}
                              type="button"
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                              onClick={() => submitHomeCommand(suggestion)}
                              disabled={homeLoading || homeConfirmLoading}
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No assistant response yet.</p>
                )}
              </div>
            )}
            {!homeResult && !homeLoading && !homeConfirmLoading && (
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  'Need VPN access for ABC UAT for 2 weeks',
                  'Install Cursor for QA team',
                  'What is the RTO policy for India?',
                ].map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                    disabled={homeLoading || homeConfirmLoading}
                    onClick={() => setHomeMessage(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
            )}
            {recentItTickets.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {recentItTickets.map((ticketNumber) => {
                  const isSuggested = hasTicketSignal && ticketAutocompleteSuggestions.includes(ticketNumber);
                  return (
                    <button
                      key={`ticket-${ticketNumber}`}
                      type="button"
                      className={`rounded-full border px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 ${
                        isSuggested
                          ? 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 focus-visible:ring-sky-200'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-300'
                      }`}
                      disabled={homeLoading || homeConfirmLoading}
                      onClick={() => runTicketStatusCheck(ticketNumber)}
                    >
                      {ticketNumber}
                    </button>
                  );
                })}
              </div>
            )}

            {shouldShowActiveActionCard && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
                <div className="mb-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resetHomeRunState}
                    disabled={homeLoading || homeConfirmLoading}
                  >
                    Start New Request
                  </Button>
                </div>
                <p className="text-sm font-semibold text-slate-900">{homeResult.actionCard.title}</p>
                <p className="mt-1 text-sm text-slate-700">{homeResult.actionCard.description}</p>
                {homeResult.actionCard.data?.lastFollowupMessage && (
                  <p className="mt-1 text-xs text-slate-500">
                    Last update:
                    {' '}
                    <span className="font-medium">{String(homeResult.actionCard.data.lastFollowupMessage)}</span>
                  </p>
                )}
                {Array.isArray(homeResult.actionCard.data?.suggestions) &&
                  homeResult.actionCard.data.suggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {homeResult.actionCard.data.suggestions.map((suggestion: string) => (
                        <button
                          key={suggestion}
                          type="button"
                          className="rounded-full bg-white px-3 py-1 text-xs text-slate-700 border border-slate-200 hover:bg-slate-100"
                          onClick={() => submitHomeCommand(suggestion)}
                          disabled={homeLoading || homeConfirmLoading}
                        >
                          {suggestion}
                        </button>
                      ))}
                  </div>
                )}
                {isPdfConvertCard && (
                  <div className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Conversion Mode
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={`rounded-full border px-3 py-1 text-xs ${
                            homePdfMode === 'extract'
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300 bg-white text-slate-700'
                          }`}
                          onClick={() => setHomePdfMode('extract')}
                          disabled={homePdfLoading}
                        >
                          As-is (faithful)
                        </button>
                        <button
                          type="button"
                          className={`rounded-full border px-3 py-1 text-xs ${
                            homePdfMode === 'ai'
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300 bg-white text-slate-700'
                          }`}
                          onClick={() => setHomePdfMode('ai')}
                          disabled={homePdfLoading}
                        >
                          AI polished
                        </button>
                        <button
                          type="button"
                          className={`rounded-full border px-3 py-1 text-xs ${
                            homePdfMode === 'visual'
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300 bg-white text-slate-700'
                          }`}
                          onClick={() => setHomePdfMode('visual')}
                          disabled={homePdfLoading}
                        >
                          Visual preserve
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Upload PDF
                      </p>
                      <div
                        role="button"
                        tabIndex={0}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsHomePdfDragging(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setIsHomePdfDragging(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsHomePdfDragging(false);
                          selectHomePdfFile(e.dataTransfer.files?.[0] || null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            homePdfCardInputRef.current?.click();
                          }
                        }}
                        className={`rounded-md border border-dashed p-3 text-center transition ${
                          isHomePdfDragging
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          ref={homePdfCardInputRef}
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={(e) => {
                            selectHomePdfFile(e.target.files?.[0] || null);
                            e.currentTarget.value = '';
                          }}
                          className="hidden"
                          disabled={homePdfLoading}
                        />
                        <p className="text-xs text-slate-700">
                          Drag and drop a PDF here, or{' '}
                          <button
                            type="button"
                            className="font-semibold text-blue-700 underline underline-offset-2"
                            onClick={() => {
                              if (!homePdfCardInputRef.current) return;
                              homePdfCardInputRef.current.value = '';
                              homePdfCardInputRef.current.click();
                            }}
                            disabled={homePdfLoading}
                          >
                            browse
                          </button>
                        </p>
                      </div>
                      <p className="text-xs text-slate-500">
                        Max file size: 25MB. Large files auto-use chunked upload.
                      </p>
                    </div>
                    {homePdfFile && (
                      <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
                        <p className="text-xs text-slate-600">
                        Selected: <span className="font-medium">{homePdfFile.name}</span> (
                        {(homePdfFile.size / 1024 / 1024).toFixed(2)} MB)
                        </p>
                        <button
                          type="button"
                          className="text-xs text-slate-500 underline underline-offset-2"
                          onClick={() => selectHomePdfFile(null)}
                          disabled={homePdfLoading}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    {homePdfLocalError && (
                      <p className="text-xs text-red-700">{homePdfLocalError}</p>
                    )}
                    {homePdfLoading && (
                      <div className="space-y-1">
                        <div className="h-2 w-full rounded bg-slate-200">
                          <div
                            className="h-2 rounded bg-blue-500 transition-all"
                            style={{ width: `${homePdfProgress}%` }}
                          />
                        </div>
                        <p className="text-xs text-slate-600">
                          {homePdfStage === 'uploading'
                            ? `Uploading... ${homePdfProgress}%`
                            : `Processing... ${homePdfProgress}%`}
                        </p>
                      </div>
                    )}
                    {homePdfResult && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2">
                        <p className="text-xs font-medium text-emerald-800">
                          Conversion complete
                          {typeof homePdfResult.totalSlides === 'number'
                            ? ` (${homePdfResult.totalSlides} slides)`
                            : ''}
                        </p>
                        <p className="text-xs text-emerald-700">{homePdfResult.filename}</p>
                        <p className="text-xs text-emerald-700">
                          Mode:{' '}
                          {homePdfMode === 'extract'
                            ? 'As-is (faithful)'
                            : homePdfMode === 'visual'
                              ? 'Visual preserve'
                              : 'AI polished'}
                        </p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={handleHomePdfConvert}
                        disabled={homePdfLoading || !homePdfFile}
                      >
                        {homePdfLoading ? 'Working...' : 'Convert'}
                      </Button>
                      {homePdfResult && (
                        <Button size="sm" variant="outline" onClick={downloadHomePptx}>
                          Download PPT
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {isItApprovalCard && (
                  <div className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-white p-3">
                    {itMissingFields.length > 0 && (
                      <p className="text-xs font-semibold text-amber-700">
                        Required before submit: {itMissingFields.join(', ')}
                      </p>
                    )}
                    {itMissingFields.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {itMissingFields.includes('reason') && (
                          <>
                            {['for QA team', 'for ABC UAT', 'for client reporting'].map((value) => (
                              <button
                                key={`reason-${value}`}
                                type="button"
                                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                                onClick={() =>
                                  setHomeDraftPatch((prev) => ({
                                    ...prev,
                                    reason: value.replace(/^for\s+/i, ''),
                                  }))
                                }
                              >
                                {value}
                              </button>
                            ))}
                          </>
                        )}
                        {itMissingFields.includes('durationType') && (
                          <>
                            {[
                              { label: 'for 2 weeks', durationType: 'for 2 weeks', durationUntil: '' },
                              { label: 'permanent', durationType: 'permanent', durationUntil: '' },
                              {
                                label: 'temporary until end of quarter',
                                durationType: 'temporary',
                                durationUntil: temporaryAccessUntilDate,
                              },
                            ].map((option) => (
                              <button
                                key={`duration-${option.label}`}
                                type="button"
                                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                                onClick={() =>
                                  setHomeDraftPatch((prev) => ({
                                    ...prev,
                                    durationType: option.durationType,
                                    durationUntil: option.durationUntil,
                                  }))
                                }
                              >
                                {option.label}
                              </button>
                            ))}
                          </>
                        )}
                        {itMissingFields.includes('system') && (
                          <>
                            {['Cursor', 'Power BI', 'Jira'].map((value) => (
                              <button
                                key={`system-${value}`}
                                type="button"
                                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                                onClick={() => setHomeDraftPatch((prev) => ({ ...prev, system: value }))}
                              >
                                {value}
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}

                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="text-[11px] font-semibold uppercase text-slate-500">Request type</p>
                        <p className="text-xs text-slate-800">
                          {homeResult.actionCard.data?.requestType || '-'}
                        </p>
                      </div>
                      <label className="rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                        <p className="text-[11px] font-semibold uppercase text-slate-500">System</p>
                        <input
                          value={homeDraftPatch.system}
                          onChange={(e) =>
                            setHomeDraftPatch((prev) => ({ ...prev, system: e.target.value }))
                          }
                          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                          placeholder="e.g. Cursor, Power BI, Jira"
                        />
                      </label>
                      <div className="rounded-md bg-slate-50 p-2">
                        <p className="text-[11px] font-semibold uppercase text-slate-500">Impact</p>
                        <p className="text-xs text-slate-800">{homeResult.actionCard.data?.impact || '-'}</p>
                      </div>
                    </div>

                    <label className="text-xs text-slate-700">
                      Business reason / use case
                      <input
                        value={homeDraftPatch.reason}
                        onChange={(e) =>
                          setHomeDraftPatch((prev) => ({ ...prev, reason: e.target.value }))
                        }
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                        placeholder="Why do you need this access?"
                      />
                    </label>

                    <div className="space-y-2">
                      <p className="text-xs text-slate-700">Duration</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={`rounded-full border px-3 py-1 text-xs ${
                            homeDraftPatch.durationType.trim().toLowerCase() === 'permanent'
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300 bg-white text-slate-700'
                          }`}
                          onClick={() =>
                            setHomeDraftPatch((prev) => ({
                              ...prev,
                              durationType: 'permanent',
                              durationUntil: '',
                            }))
                          }
                        >
                          Permanent
                        </button>
                        <button
                          type="button"
                          className={`rounded-full border px-3 py-1 text-xs ${
                            homeDraftPatch.durationType.trim().toLowerCase() === 'temporary'
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300 bg-white text-slate-700'
                          }`}
                          onClick={() =>
                            setHomeDraftPatch((prev) => ({
                              ...prev,
                              durationType: 'temporary',
                            }))
                          }
                        >
                          Temporary until date
                        </button>
                        <button
                          type="button"
                          className={`rounded-full border px-3 py-1 text-xs ${
                            homeDraftPatch.durationType.trim().toLowerCase() !== 'permanent' &&
                            homeDraftPatch.durationType.trim().toLowerCase() !== 'temporary' &&
                            homeDraftPatch.durationType.trim().length > 0
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300 bg-white text-slate-700'
                          }`}
                          onClick={() =>
                            setHomeDraftPatch((prev) => ({
                              ...prev,
                              durationType:
                                prev.durationType.trim().toLowerCase() === 'permanent' ||
                                prev.durationType.trim().toLowerCase() === 'temporary'
                                  ? ''
                                  : prev.durationType,
                              durationUntil: '',
                            }))
                          }
                        >
                          Custom
                        </button>
                      </div>
                      {homeDraftPatch.durationType.trim().toLowerCase() !== 'permanent' &&
                        homeDraftPatch.durationType.trim().toLowerCase() !== 'temporary' && (
                          <input
                            value={homeDraftPatch.durationType}
                            onChange={(e) =>
                              setHomeDraftPatch((prev) => ({
                                ...prev,
                                durationType: e.target.value,
                                durationUntil: '',
                              }))
                            }
                            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            placeholder="e.g. 2 weeks"
                          />
                        )}
                    </div>

                    {(homeDraftPatch.durationType || '').trim().toLowerCase() === 'temporary' && (
                      <label className="text-xs text-slate-700">
                        Temporary access end date
                        <input
                          type="date"
                          value={homeDraftPatch.durationUntil}
                          onChange={(e) =>
                            setHomeDraftPatch((prev) => ({
                              ...prev,
                              durationUntil: e.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                        />
                      </label>
                    )}

                    <label className="text-xs text-slate-700">
                      Request details
                      <textarea
                        value={homeDraftPatch.details}
                        onChange={(e) =>
                          setHomeDraftPatch((prev) => ({ ...prev, details: e.target.value }))
                        }
                        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                        rows={3}
                        placeholder="Add exact details for IT team"
                      />
                    </label>
                  </div>
                )}
                {(homeResult.actionCard.data?.ticketNumber ||
                  typeof homeResult.actionCard.data?.jd_id === 'string' ||
                  Array.isArray(homeResult.actionCard.data?.sources)) && (
                  <div className="mt-2 text-xs text-slate-600 space-y-1">
                    {homeResult.actionCard.data?.ticketNumber && (
                      <p>
                        Ticket: <span className="font-mono">{homeResult.actionCard.data.ticketNumber}</span>
                      </p>
                    )}
                    {homeResult.actionCard.data?.jd_id && (
                      <p>
                        JD ID: <span className="font-mono">{homeResult.actionCard.data.jd_id}</span>
                      </p>
                    )}
                    {Array.isArray(homeResult.actionCard.data?.sources) && (
                      <p>Sources: {homeResult.actionCard.data.sources.length}</p>
                    )}
                  </div>
                )}
                {shouldShowViewTicketCta && (
                  <div className="mt-2">
                    <Button asChild size="sm" className="bg-blue-600 text-white hover:bg-blue-700">
                      <Link href={homeViewTicketRoute as string}>View ticket {'->'}</Link>
                    </Button>
                  </div>
                )}
                {typeof homeResult.actionCard.data?.routeTo === 'string' &&
                  !isDuplicateWarningCard &&
                  !shouldShowViewTicketCta && (
                  <div className="mt-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={homeResult.actionCard.data.routeTo}>Open in Tool</Link>
                    </Button>
                  </div>
                )}
                {isDuplicateWarningCard && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        runTicketStatusCheck(String(homeResult.actionCard.data?.duplicateTicketNumber))
                      }
                      disabled={homeLoading || homeConfirmLoading}
                    >
                      Review Ticket {homeResult.actionCard.data?.duplicateTicketNumber}
                    </Button>
                  </div>
                )}
                {homeResult.actionCard.data?.ticketNumber && !shouldShowViewTicketCta && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runTicketStatusCheck(String(homeResult.actionCard.data?.ticketNumber))}
                      disabled={homeLoading || homeConfirmLoading}
                    >
                      Track Ticket
                    </Button>
                  </div>
                )}
                {homeResult.actionCard.data && !isItApprovalCard && (
                  <div className="mt-2">
                    <button
                      type="button"
                      className="text-xs text-slate-500 underline underline-offset-2"
                      onClick={() => setShowHomeDetails((prev) => !prev)}
                    >
                      {showHomeDetails ? 'Hide details' : 'View details'}
                    </button>
                  </div>
                )}
                {homeResult.actionCard.data && !isItApprovalCard && showHomeDetails && renderHomeActionDetails()}
                {homeResult.requiresConfirmation && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => confirmHomeAction(true)}
                      disabled={homeConfirmLoading}
                    >
                      {homeConfirmLoading ? 'Submitting...' : 'Approve & Run'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => confirmHomeAction(false)}
                      disabled={homeConfirmLoading}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            )}

            {homeError && !isDuplicateWarningCard && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2">
                <p className="text-xs font-medium text-red-700">{homeError}</p>
                {lastHomeCommand && (
                  <button
                    type="button"
                    className="mt-1 text-xs font-medium text-red-700 underline underline-offset-2"
                    onClick={() => submitHomeCommand(lastHomeCommand)}
                    disabled={homeLoading || homeConfirmLoading}
                  >
                    Retry last command
                  </button>
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400">Built for Trianz.</p>
        </div>

        {/* Preview cluster */}
        <div className="relative h-64 md:h-72">
          <div className="absolute inset-0 rounded-full bg-indigo-100/40 blur-3xl" />

          {/* Keep Ask Beacon behind, IT request on top for nicer overlap */}
          <Card className="absolute left-0 top-10 w-64 rounded-2xl bg-white/90 shadow-md backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-900">Ask Beacon</CardTitle>
              <CardDescription className="text-[11px] text-slate-500">
                Policy and &quot;how do I...&quot; answers with citations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-slate-800">
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                How many days do I need to be in office?
              </div>
              <div className="rounded-2xl bg-indigo-50 px-3 py-2 text-[11px]">
                Beacon: Minimum three days per week as per roster, unless you have an approved
                exception. See Return to Office Policy, section 3.
              </div>
            </CardContent>
          </Card>

          <Card className="absolute bottom-2 right-10 z-10 w-64 translate-x-1 translate-y-2 rounded-2xl bg-white/90 shadow-md backdrop-blur sm:right-14 sm:translate-x-2 sm:translate-y-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-900">
                Raise an IT request
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-500">
                Type one sentence about what you need.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] text-slate-800">
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                My laptop is not turning on, please arrange support.
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                I need Power BI Pro subscription access for client reporting.
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Tools (categorized like prompts) */}
      <section id="tools-hub" className="space-y-5">
        <div id="all-tools" />
                <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Tools Hub
          </h2>
          <p className="text-sm text-slate-600">
            Jump straight into a tool, grouped by workflow.
          </p>
        </div>

        {/* Pills */}
        <div className="flex flex-wrap gap-2">
          {TOOL_CATEGORIES.map((cat) => {
            const isActive = cat === activeToolCategory;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveToolCategory(cat)}
                className={[
                  'rounded-full px-4 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                ].join(' ')}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {TOOL_GROUPS[activeToolCategory].map((tool) => (
            <Link
              key={tool.title}
              href={tool.href}
              className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-card px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
            >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${tool.accent}`}
                        >
                          {tool.initials}
                        </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-slate-900">{tool.title}</p>
                          <p className="text-xs text-slate-600">{tool.description}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </Link>
                  ))}
        </div>
      </section>

      {/* Admin Tools Section - Only shown to admins */}
      {isAdmin && (
        <section className="space-y-5 border-t border-gray-200 pt-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Admin
            </h2>
            <p className="text-sm text-slate-600">
              Administrative tools for managing tickets and users.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {ADMIN_TOOLS.map((tool) => (
              <Link
                key={tool.title}
                href={tool.href}
                className="flex items-center justify-between gap-4 rounded-2xl bg-card px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md border-2 border-purple-100"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${tool.accent}`}
                  >
                    {tool.initials}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-slate-900">{tool.title}</p>
                    <p className="text-xs text-slate-600">{tool.description}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </Link>
            ))}
          </div>
          {isSuperAdmin && (
            <div className="grid gap-3 md:grid-cols-2">
              {SUPER_ADMIN_TOOLS.map((tool) => (
                <Link
                  key={tool.title}
                  href={tool.href}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-card px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md border-2 border-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${tool.accent}`}
                    >
                      {tool.initials}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-slate-900">{tool.title}</p>
                      <p className="text-xs text-slate-600">{tool.description}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Engineer Tools Section - Only shown to engineers */}
      {isEngineer && (
        <section className="space-y-5 border-t border-gray-200 pt-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Engineer
            </h2>
            <p className="text-sm text-slate-600">
              Tools for managing tickets assigned to you.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {ENGINEER_TOOLS.map((tool) => (
              <Link
                key={tool.title}
                href={tool.href}
                className="flex items-center justify-between gap-4 rounded-2xl bg-card px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md border-2 border-blue-100"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${tool.accent}`}
                  >
                    {tool.initials}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-slate-900">{tool.title}</p>
                    <p className="text-xs text-slate-600">{tool.description}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Approvals Section */}
      {(isSupervisor || isTravelAdmin) && (
        <section className="space-y-5 border-t border-gray-200 pt-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Approvals
            </h2>
            <p className="text-sm text-slate-600">
              Review and approve travel requests.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {isSupervisor && (
              <Link
                href="/approvals/supervisor"
                className="flex items-center justify-between gap-4 rounded-2xl bg-card px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md border-2 border-green-100"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold bg-green-100 text-green-700">
                    SA
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-slate-900">Supervisor Approvals</p>
                    <p className="text-xs text-slate-600">Approve travel requests from your team</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </Link>
            )}
            {isTravelAdmin && (
              <Link
                href="/approvals/travel-admin"
                className="flex items-center justify-between gap-4 rounded-2xl bg-card px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md border-2 border-purple-100"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                    TA
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-slate-900">Travel Admin Approvals</p>
                    <p className="text-xs text-slate-600">Final approval for travel requests</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
              </Link>
            )}
          </div>
        </section>
      )}

      <div className={`fixed inset-0 z-50 ${historyOpen ? '' : 'pointer-events-none'}`}>
        <button
          type="button"
          className={`absolute inset-0 bg-slate-900/35 transition-opacity ${
            historyOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setHistoryOpen(false)}
          aria-label="Close history drawer"
        />
        <aside
          className={`absolute right-0 top-0 h-full w-full max-w-xl border-l border-slate-200 bg-white shadow-2xl transition-transform ${
            historyOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          aria-label="History"
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">History</p>
                <h3 className="text-lg font-semibold text-slate-900">Recent activity timeline</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fetchHistoryData(true)}
                  disabled={historyLoading}
                >
                  Refresh
                </Button>
                <button
                  type="button"
                  className="rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                  onClick={() => setHistoryOpen(false)}
                  aria-label="Close history drawer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {historyLoading ? (
                <p className="text-sm text-slate-600">Loading history...</p>
              ) : historyError ? (
                <p className="text-sm text-rose-700">{historyError}</p>
              ) : historyTimeline.length === 0 ? (
                <p className="text-sm text-slate-600">No recent activity yet.</p>
              ) : (
                <div className="space-y-6">
                  {(['Today', 'This week', 'Earlier'] as const).map((label) => {
                    const items = groupedHistory[label];
                    if (items.length === 0) return null;
                    return (
                      <section key={label} className="space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                        <div className="space-y-2">
                          {items.map((entry) =>
                            entry.type === 'ticket' ? (
                              <button
                                key={entry.key}
                                type="button"
                                onClick={() => {
                                  setHistoryOpen(false);
                                  router.push(`/tickets/${entry.ticket.id}`);
                                }}
                                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                              >
                                <div className="min-w-0">
                                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                    <Ticket className="h-4 w-4 text-slate-500" />
                                    <span className="truncate">
                                      {entry.ticket.ticketNumber} - {entry.ticket.title}
                                    </span>
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {new Date(entry.ticket.createdAt).toLocaleString()}
                                  </p>
                                </div>
                                <div className="ml-3 flex items-center gap-2">
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                                    {entry.ticket.type}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] ${historyStatusClass(entry.ticket.status)}`}
                                  >
                                    {formatStatusLabel(entry.ticket.status)}
                                  </span>
                                  <ChevronRight className="h-4 w-4 text-slate-400" />
                                </div>
                              </button>
                            ) : (
                              <button
                                key={entry.key}
                                type="button"
                                onClick={() => {
                                  setHistoryOpen(false);
                                  if (entry.run.routeTo) {
                                    router.push(entry.run.routeTo);
                                    return;
                                  }
                                  if (entry.run.message) {
                                    setHomeMessage(entry.run.message);
                                    submitHomeCommand(entry.run.message);
                                  }
                                }}
                                className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
                              >
                                <div className="min-w-0">
                                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                    <Sparkles className="h-4 w-4 text-slate-500" />
                                    <span className="truncate">{entry.run.message || entry.run.description || 'Home command'}</span>
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {entry.run.description || getHomeIntentLabel(entry.run.intent)}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {new Date(entry.run.createdAt).toLocaleString()}
                                  </p>
                                </div>
                                <div className="ml-3 flex items-center gap-2">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] ${historyStatusClass(entry.run.status)}`}
                                  >
                                    {formatStatusLabel(entry.run.status)}
                                  </span>
                                  <ChevronRight className="h-4 w-4 text-slate-400" />
                                </div>
                              </button>
                            )
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Trust strip */}
      <section className="pb-4">
        <div className="rounded-2xl border border-slate-200 bg-card px-4 py-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            How Beacon answers
          </p>
          <ul className="mt-2 space-y-1 list-disc pl-5 text-xs text-slate-600 md:text-sm">
            <li>Grounded in internal sources (policies, HR/IT docs).</li>
            <li>Citations included (document and section).</li>
            <li>Uses approved email workflows; does not bypass approvals.</li>
          </ul>
        </div>
      </section>
      <ToastContainer />
    </div>
  );
}
