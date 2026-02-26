'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Ticket } from 'lucide-react';
import { BackToHome } from '@/components/ui/back-to-home';
import Button from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_ON_REQUESTER'
  | 'PENDING_APPROVAL'
  | 'RESOLVED'
  | 'CLOSED';
type TicketType = 'IT' | 'TRAVEL';
type FilterKey = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

type UserTicket = {
  id: string;
  ticketNumber: string;
  title: string;
  status: TicketStatus;
  type: TicketType;
  createdAt: string;
};

const FILTERS: Array<{ key: FilterKey; label: string; statusQuery?: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'OPEN', label: 'Open', statusQuery: 'OPEN,PENDING_APPROVAL' },
  { key: 'IN_PROGRESS', label: 'In Progress', statusQuery: 'IN_PROGRESS,WAITING_ON_REQUESTER' },
  { key: 'RESOLVED', label: 'Resolved', statusQuery: 'RESOLVED' },
  { key: 'CLOSED', label: 'Closed', statusQuery: 'CLOSED' },
];

const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  WAITING_ON_REQUESTER: 'bg-orange-100 text-orange-800',
  PENDING_APPROVAL: 'bg-purple-100 text-purple-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-slate-100 text-slate-700',
};

function formatStatusLabel(status: TicketStatus) {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MyTicketsPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('ALL');
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({ limit: '100' });
        const selectedFilter = FILTERS.find((filter) => filter.key === activeFilter);
        if (selectedFilter?.statusQuery) {
          params.set('status', selectedFilter.statusQuery);
        }

        const res = await fetch(`/api/profile/tickets?${params.toString()}`, {
          cache: 'no-store',
        });
        const data = await res.json();

        if (!res.ok || data?.error) {
          throw new Error(data?.error || 'Failed to load tickets');
        }

        const nextTickets: UserTicket[] = Array.isArray(data?.tickets)
          ? data.tickets
              .filter((ticket: any) => typeof ticket?.id === 'string')
              .map((ticket: any) => ({
                id: ticket.id,
                ticketNumber: ticket.ticketNumber || ticket.id,
                title: ticket.title || 'Untitled request',
                status: (ticket.status || 'OPEN') as TicketStatus,
                type: (ticket.type || 'IT') as TicketType,
                createdAt: ticket.createdAt || new Date().toISOString(),
              }))
          : [];

        setTickets(nextTickets);
      } catch (fetchError: any) {
        setError(fetchError?.message || 'Failed to load tickets');
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [activeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-slate-900">My Tickets</h1>
          <p className="text-sm text-slate-600">Track every request you have raised.</p>
        </div>
        <BackToHome />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-slate-900">Filter by status</CardTitle>
          <CardDescription>Switch tabs to quickly find the tickets you need.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => {
              const active = filter.key === activeFilter;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  className={[
                    'rounded-full border px-3 py-1.5 text-sm transition',
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <Spinner className="h-6 w-6" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-rose-700">{error}</p>
          </CardContent>
        </Card>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Ticket className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-700">You haven&apos;t raised any requests yet.</p>
            <div className="mt-4">
              <Button asChild>
                <Link href="/">Raise a request</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-200">
              {tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => router.push(`/tickets/${ticket.id}`)}
                  className="w-full px-4 py-4 text-left transition hover:bg-slate-50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-900">
                      {ticket.ticketNumber}
                    </span>
                    <Badge className={STATUS_COLORS[ticket.status]}>
                      {formatStatusLabel(ticket.status)}
                    </Badge>
                    <Badge variant="outline">{ticket.type}</Badge>
                  </div>
                  <p className="mt-1 text-base font-semibold text-slate-900">{ticket.title}</p>
                  <p className="mt-1 text-sm text-slate-600">Raised: {formatDate(ticket.createdAt)}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
