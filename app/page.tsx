'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import Button from '@/components/ui/button';
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
    description: 'Turn weekly updates into a CIO / SLT brief.',
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

export default function Home() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEngineer, setIsEngineer] = useState(false);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [isTravelAdmin, setIsTravelAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);

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
          
          // Check if user is a supervisor (anyone can be a supervisor if they have approvals pending)
          // We'll show the link if they're logged in - the API will handle authorization
          setIsSupervisor(true); // Show to all logged-in users, API handles auth
          
          // Check if user has travel admin role
          const travelAdminRoles = ['ADMIN_TRAVEL', 'SUPER_ADMIN'];
          const hasTravelAdminRole = roles.some((role: string) => travelAdminRoles.includes(role));
          setIsTravelAdmin(hasTravelAdminRole);
          
          setIsSuperAdmin(roles.includes('SUPER_ADMIN'));
          
          console.log('Session check:', { roles, hasAdminRole, hasEngineerRole, hasTravelAdminRole, data });
        } else {
          console.log('No admin roles found:', data);
        }
      })
      .catch((err) => {
        console.error('Session check error:', err);
        // Not logged in or error
      });
  }, []);

  const buckets: ToolBucket[] = ['Ask', 'Requests', 'Outputs'];

  type PromptCategory =
    | 'Catch Up'
    | 'Ask'
    | 'Requests'
    | 'Create'
    | 'Summarize'
    | 'Onboard';

  const PROMPT_CATEGORIES: PromptCategory[] = [
    'Catch Up',
    'Ask',
    'Requests',
    'Create',
    'Summarize',
    'Onboard',
  ];

  const [activePromptCategory, setActivePromptCategory] = useState<PromptCategory>('Catch Up');
  const [homeMessage, setHomeMessage] = useState('');
  const [homeLoading, setHomeLoading] = useState(false);
  const [homeConfirmLoading, setHomeConfirmLoading] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [homeRunId, setHomeRunId] = useState<string | null>(null);
  const [showHomeDetails, setShowHomeDetails] = useState(false);
  const [homeDraftPatch, setHomeDraftPatch] = useState({
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
  type ToolCategory = 'All' | ToolBucket;
  const TOOL_CATEGORIES: ToolCategory[] = ['All', 'Ask', 'Requests', 'Outputs'];
  const [activeToolCategory, setActiveToolCategory] = useState<ToolCategory>('All');

  useEffect(() => {
    const data = homeResult?.actionCard?.data || {};
    setHomeDraftPatch({
      reason: typeof data.reason === 'string' ? data.reason : '',
      details: typeof data.details === 'string' ? data.details : '',
      durationType: typeof data.durationType === 'string' ? data.durationType : '',
      durationUntil: typeof data.durationUntil === 'string' ? data.durationUntil : '',
    });
  }, [homeResult]);

  const submitHomeCommand = async (messageOverride?: string) => {
    const message = (messageOverride ?? homeMessage).trim();
    if (!message) return;

    try {
      setHomeLoading(true);
      setHomeError(null);

      const res = await fetch('/api/home/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
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
    } finally {
      setHomeLoading(false);
    }
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
        if (data?.actionCard) {
          setHomeResult((prev) =>
            prev
              ? {
                  ...prev,
                  actionCard: data.actionCard,
                  requiresConfirmation: true,
                }
              : null
          );
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
    } finally {
      setHomeConfirmLoading(false);
    }
  };

  type PromptCard = {
    title: string;
    description: string;
    href: string;
    accent: string;
  };

  const PROMPTS: Record<PromptCategory, PromptCard[]> = {
    'Catch Up': [
      {
        title: 'Catch up on weekly initiatives',
        description:
          'Turn team updates into a concise CIO / SLT brief, week over week.',
        href: '/weekly-brief',
        accent: 'bg-amber-100 text-amber-700',
      },
      {
        title: 'Stay informed on policy changes',
        description:
          'Ask Beacon for the latest policy guidance with citations from internal docs.',
        href: '/policy-agent',
        accent: 'bg-sky-100 text-sky-700',
      },
      {
        title: 'Get the gist of an email or document',
        description:
          'Ask a focused question and use sources to verify the answer quickly.',
        href: '/policy-agent',
        accent: 'bg-indigo-100 text-indigo-700',
      },
    ],
    Ask: [
      {
        title: 'Ask a policy question',
        description:
          'Get grounded answers with citations from internal policies and guidelines.',
        href: '/policy-agent',
        accent: 'bg-sky-100 text-sky-700',
      },
      {
        title: 'Help a new joiner',
        description:
          'Answer first-90-days questions and point new joiners to the right policies.',
        href: '/new-joiner',
        accent: 'bg-emerald-100 text-emerald-700',
      },
      {
        title: 'Expenses and Fusion help',
        description:
          'Explain reimbursable expenses and Fusion steps in clear actions.',
        href: '/expenses-coach',
        accent: 'bg-teal-100 text-teal-700',
      },
    ],
    Requests: [
      {
        title: 'Raise an IT / access request',
        description:
          'Turn free text into a structured Service Desk email routed to the right queue.',
        href: '/service-desk',
        accent: 'bg-slate-100 text-slate-700',
      },
      {
        title: 'Raise a travel request',
        description:
          'Create ready-to-send travel requests with dates, routes and approvals captured.',
        href: '/travel-desk',
        accent: 'bg-cyan-100 text-cyan-700',
      },
      {
        title: 'Ask before you submit',
        description:
          'Use Ask Beacon to check policy limits (travel grade, hotel caps, per diem) first.',
        href: '/policy-agent',
        accent: 'bg-sky-100 text-sky-700',
      },
    ],
    Create: [
      {
        title: 'Draft a comms update',
        description:
          'Turn raw updates into newsletters and change notices with clear structure.',
        href: '/comms-hub',
        accent: 'bg-fuchsia-100 text-fuchsia-700',
      },
      {
        title: 'Create a Job Description',
        description:
          'Generate structured role descriptions and skill requirements in minutes.',
        href: '/jd',
        accent: 'bg-indigo-100 text-indigo-700',
      },
      {
        title: 'Create a weekly brief',
        description:
          'Summarize initiatives into leadership-ready bullets with consistent format.',
        href: '/weekly-brief',
        accent: 'bg-amber-100 text-amber-700',
      },
    ],
    Summarize: [
      {
        title: 'Summarize weekly updates',
        description:
          'Convert updates into a concise CIO / SLT brief with consistent headings.',
        href: '/weekly-brief',
        accent: 'bg-amber-100 text-amber-700',
      },
      {
        title: 'Summarize policy guidance',
        description:
          'Ask Beacon for key rules and what-to-do-next, grounded with citations.',
        href: '/policy-agent',
        accent: 'bg-sky-100 text-sky-700',
      },
      {
        title: 'Summarize comms into an announcement',
        description:
          'Turn notes into a clear announcement with audience, timing and action items.',
        href: '/comms-hub',
        accent: 'bg-fuchsia-100 text-fuchsia-700',
      },
    ],
    Onboard: [
      {
        title: 'Day 1 checklist',
        description:
          'Get onboarding steps for access, policies and first-week expectations.',
        href: '/new-joiner',
        accent: 'bg-emerald-100 text-emerald-700',
      },
      {
        title: 'IT setup help',
        description:
          'Get guidance for VPN, email, and tool access, or route to Service Desk if needed.',
        href: '/new-joiner',
        accent: 'bg-slate-100 text-slate-700',
      },
      {
        title: 'RTO and leave basics',
        description:
          'Ask the buddy about RTO expectations, probation, and leave policies.',
        href: '/new-joiner',
        accent: 'bg-emerald-100 text-emerald-700',
      },
    ],
  };

  const TOOL_GROUPS: Record<ToolCategory, Tool[]> = {
    All: TOOLS,
    Ask: TOOLS.filter((t) => t.bucket === 'Ask'),
    Requests: TOOLS.filter((t) => t.bucket === 'Requests'),
    Outputs: TOOLS.filter((t) => t.bucket === 'Outputs'),
    Admin: [], // Admin tools shown separately below
  };

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Text column */}
        <div className="space-y-6">
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            Beacon - the Trianz AI desk for answers and requests.
          </h1>

          <p className="max-w-xl text-base text-slate-600">
            Ask policy questions with citations, raise IT and travel requests, and generate
            leadership updates - all in one place, grounded in Trianz policies and systems.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild className="rounded-full px-5">
              <Link href="/policy-agent">Ask Beacon</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-5">
              <Link href="/service-desk">Raise IT request</Link>
            </Button>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('all-tools');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="text-sm text-slate-500 underline-offset-4 hover:underline"
            >
              See all tools
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Home Command Bar
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                value={homeMessage}
                onChange={(e) => setHomeMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !homeLoading && !homeConfirmLoading) {
                    e.preventDefault();
                    submitHomeCommand();
                  }
                }}
                placeholder="Try: I need VPN access for project work"
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
              <Button
                onClick={() => submitHomeCommand()}
                disabled={homeLoading || homeConfirmLoading || !homeMessage.trim()}
                className="rounded-xl px-4"
              >
                {homeLoading ? 'Running...' : 'Run'}
              </Button>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {[
                'Raise IT ticket for VPN access',
                'Check status of ticket IT-000123',
                'What is the RTO policy?',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:bg-slate-200"
                  disabled={homeLoading || homeConfirmLoading}
                  onClick={() => submitHomeCommand(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>

            {homeResult?.actionCard && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{homeResult.actionCard.title}</p>
                <p className="mt-1 text-sm text-slate-700">{homeResult.actionCard.description}</p>
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
                {homeResult.requiresConfirmation &&
                  Array.isArray(homeResult.actionCard.data?.missingFields) &&
                  homeResult.actionCard.data.missingFields.length > 0 && (
                    <div className="mt-3 grid gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold text-amber-800">
                        Required before submit:
                        {' '}
                        {homeResult.actionCard.data.missingFields.join(', ')}
                      </p>

                      {homeResult.actionCard.data.missingFields.includes('reason') && (
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
                      )}

                      {homeResult.actionCard.data.missingFields.includes('details') && (
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
                      )}

                      {homeResult.actionCard.data.missingFields.includes('durationType') && (
                        <label className="text-xs text-slate-700">
                          Duration
                          <input
                            value={homeDraftPatch.durationType}
                            onChange={(e) =>
                              setHomeDraftPatch((prev) => ({
                                ...prev,
                                durationType: e.target.value,
                              }))
                            }
                            className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                            placeholder='e.g. permanent, 2 weeks, or temporary'
                          />
                        </label>
                      )}

                      {(homeResult.actionCard.data.missingFields.includes('durationUntil') ||
                        (homeDraftPatch.durationType || '').trim().toLowerCase() ===
                          'temporary') && (
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
                {typeof homeResult.actionCard.data?.routeTo === 'string' && (
                  <div className="mt-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={homeResult.actionCard.data.routeTo}>Open in Tool</Link>
                    </Button>
                  </div>
                )}
                {homeResult.actionCard.data && (
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
                {homeResult.actionCard.data && showHomeDetails && (
                  <pre className="mt-2 overflow-auto rounded-lg bg-white p-2 text-xs text-slate-700">
                    {JSON.stringify(homeResult.actionCard.data, null, 2)}
                  </pre>
                )}
                {homeResult.requiresConfirmation && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => confirmHomeAction(true)}
                      disabled={homeConfirmLoading}
                    >
                      {homeConfirmLoading ? 'Processing...' : 'Approve & Run'}
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

            {homeRunId && (
              <p className="mt-2 text-xs text-slate-500">
                Run ID: <span className="font-mono">{homeRunId}</span>
              </p>
            )}
            {(homeRunDetailsLoading || homeRunDetails) && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Run Timeline
                </p>
                {homeRunDetailsLoading && (
                  <p className="mt-1 text-xs text-slate-500">Loading timeline...</p>
                )}
                {!homeRunDetailsLoading && homeRunDetails?.steps?.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">No steps recorded yet.</p>
                )}
                {!homeRunDetailsLoading && homeRunDetails?.steps?.length ? (
                  <div className="mt-2 space-y-1">
                    {homeRunDetails.steps.map((step) => (
                      <div
                        key={step.id}
                        className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 text-xs"
                      >
                        <p className="font-medium text-slate-700">
                          Step {step.stepNo}: {step.phase}
                        </p>
                        <p className="text-slate-600">
                          Status: {step.status}
                          {step.tool ? ` | Tool: ${step.tool}` : ''}
                          {step.requiresApproval ? ' | Approval required' : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {!homeRunDetailsLoading && homeRunDetails?.approvals?.length ? (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Approvals
                    </p>
                    <div className="mt-1 space-y-1">
                      {homeRunDetails.approvals.map((approval) => (
                        <div key={approval.id} className="text-xs text-slate-600">
                          Decision: {approval.decision}
                          {approval.reason ? ` | Reason: ${approval.reason}` : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            {homeError && <p className="mt-2 text-xs text-red-600">{homeError}</p>}
          </div>

          <p className="text-xs text-slate-400">Built for Trianz. Content updated Dec 2025.</p>
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

      {/* What Beacon helps with */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">What you can do with Beacon</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="rounded-2xl bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                  Q
                </span>
                Ask Beacon
              </CardTitle>
              <CardDescription className="text-sm text-slate-600">
                Get policy and &quot;how do I...&quot; answers with citations from internal docs.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="rounded-2xl bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                  IT
                </span>
                Service Desk &amp; Travel Desk
              </CardTitle>
              <CardDescription className="text-sm text-slate-600">
                Turn plain language into structured IT and travel requests, emailed to the right
                queues.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="rounded-2xl bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                  C
                </span>
                Comms &amp; updates
              </CardTitle>
              <CardDescription className="text-sm text-slate-600">
                Turn weekly updates into briefs, newsletters and change notices for teams.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Task-based prompts */}
      <section id="tools" className="space-y-5">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">
            Task-based prompts
          </h2>
          <p className="text-sm text-slate-600">
            Choose your workflow to see prompts that help you accomplish specific tasks.
          </p>
        </div>

        {/* Pills */}
        <div className="flex flex-wrap gap-2">
          {PROMPT_CATEGORIES.map((cat) => {
            const isActive = cat === activePromptCategory;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActivePromptCategory(cat)}
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

        {/* Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {PROMPTS[activePromptCategory].map((prompt) => (
            <Card
              key={prompt.title}
              className="rounded-3xl bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <CardHeader className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${prompt.accent}`}
                  >
                    {/* lightweight marker; keeps layout consistent */}
                    <span aria-hidden="true">{'>'}</span>
                  </div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    {prompt.title}
                  </CardTitle>
                </div>
                <CardDescription className="text-sm text-slate-600">
                  {prompt.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link
                  href={prompt.href}
                  className="inline-flex items-center gap-3 text-sm font-medium text-slate-900"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                  Try this prompt
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Tools (categorized like prompts) */}
      <section id="all-tools" className="space-y-5">
                <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Tools
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
              className="flex items-center justify-between gap-4 rounded-2xl bg-card px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
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

      {/* Trust strip */}
      <section className="pb-4">
        <div className="rounded-2xl bg-card px-4 py-4 text-sm shadow-sm">
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
    </div>
  );
}
