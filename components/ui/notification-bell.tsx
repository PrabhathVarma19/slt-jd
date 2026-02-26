'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';

type NotificationTicket = {
  id: string;
  ticketNumber: string;
  status: string;
  title?: string;
};

type NotificationResponse = {
  pendingApprovals: number;
  activeTickets: NotificationTicket[];
};

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

export function NotificationBell() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [activeTickets, setActiveTickets] = useState<NotificationTicket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const totalCount = pendingApprovals + activeTickets.length;

  const summary = useMemo(() => {
    if (pendingApprovals > 0) {
      const noun = pendingApprovals === 1 ? 'request' : 'requests';
      return `${pendingApprovals} ${noun} waiting for your approval`;
    }
    if (activeTickets.length > 0) {
      const noun = activeTickets.length === 1 ? 'active ticket' : 'active tickets';
      return `${activeTickets.length} ${noun}`;
    }
    return "You're all caught up";
  }, [activeTickets.length, pendingApprovals]);

  useEffect(() => {
    if (pathname === '/login') {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/notifications/count', { cache: 'no-store' });
        const data = (await res.json()) as NotificationResponse & { error?: string };
        if (res.status === 401) {
          setPendingApprovals(0);
          setActiveTickets([]);
          setError(null);
          return;
        }
        if (!res.ok || data?.error) {
          throw new Error(data?.error || 'Failed to fetch notifications');
        }
        setPendingApprovals(typeof data.pendingApprovals === 'number' ? data.pendingApprovals : 0);
        setActiveTickets(Array.isArray(data.activeTickets) ? data.activeTickets : []);
        setError(null);
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch notifications');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  if (pathname === '/login') {
    return null;
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {totalCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {totalCount > 9 ? '9+' : totalCount}
          </span>
        )}
      </button>

      <div
        className={`absolute right-0 mt-2 w-[340px] origin-top-right rounded-xl border border-gray-200 bg-white p-3 shadow-xl transition-all ${
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0'
        }`}
      >
        <div className="mb-2 border-b border-gray-100 pb-2">
          <p className="text-sm font-semibold text-gray-900">Notifications</p>
          <p className="text-xs text-gray-600">{loading ? 'Loading...' : summary}</p>
        </div>

        {error ? (
          <p className="text-xs text-rose-700">{error}</p>
        ) : loading ? (
          <p className="text-xs text-gray-600">Loading updates...</p>
        ) : (
          <div className="space-y-3">
            {pendingApprovals > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Approvals</p>
                <Link
                  href="/approvals/supervisor"
                  className="block rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 hover:bg-amber-100"
                  onClick={() => setOpen(false)}
                >
                  {pendingApprovals} requests waiting for your approval
                </Link>
              </div>
            )}

            {activeTickets.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Active Tickets</p>
                <div className="space-y-1">
                  {activeTickets.map((ticket) => (
                    <Link
                      key={ticket.id}
                      href={`/tickets/${ticket.id}`}
                      className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                      onClick={() => setOpen(false)}
                    >
                      <span className="min-w-0 truncate">
                        {ticket.ticketNumber} - {ticket.title || formatStatus(ticket.status)}
                      </span>
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                        {formatStatus(ticket.status)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {pendingApprovals === 0 && activeTickets.length === 0 && (
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                You&apos;re all caught up
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
