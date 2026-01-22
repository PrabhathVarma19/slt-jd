import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

const DEFAULT_SLA_MINUTES: Record<Priority, number> = {
  LOW: 4320,
  MEDIUM: 1440,
  HIGH: 480,
  URGENT: 240,
};

const toDayKey = (value: string) => value.slice(0, 10);

export async function POST(req: NextRequest) {
  try {
    await requireSessionRole(['SUPER_ADMIN']);
    const { searchParams } = new URL(req.url);
    const daysParam = Number(searchParams.get('days') || 30);
    const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 365) : 30;
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date().toISOString();

    const { data: slaConfig, error: slaError } = await supabaseServer
      .from('SlaConfig')
      .select('priority, targetMinutes');
    if (slaError) {
      throw new Error(slaError.message);
    }
    const slaTargets = (slaConfig || []).reduce(
      (acc, row) => {
        acc[row.priority as Priority] = row.targetMinutes;
        return acc;
      },
      { ...DEFAULT_SLA_MINUTES }
    );

    const { data: tickets, error: ticketError } = await supabaseServer
      .from('Ticket')
      .select('id, createdAt, resolvedAt, closedAt, priority')
      .eq('domain', 'IT')
      .gte('createdAt', start)
      .lte('createdAt', end);

    if (ticketError) {
      throw new Error(ticketError.message);
    }

    const openedByDay: Record<string, number> = {};
    const resolvedByDay: Record<string, number> = {};
    const breachedByDay: Record<string, number> = {};

    for (const ticket of tickets || []) {
      const createdKey = toDayKey(ticket.createdAt);
      openedByDay[createdKey] = (openedByDay[createdKey] || 0) + 1;

      const resolvedAt = ticket.resolvedAt || ticket.closedAt || null;
      if (resolvedAt) {
        const resolvedKey = toDayKey(resolvedAt);
        resolvedByDay[resolvedKey] = (resolvedByDay[resolvedKey] || 0) + 1;
      }

      const target = slaTargets[ticket.priority as Priority] || DEFAULT_SLA_MINUTES.MEDIUM;
      const endTime = resolvedAt || end;
      const elapsedMinutes =
        (new Date(endTime).getTime() - new Date(ticket.createdAt).getTime()) / 60000;
      if (elapsedMinutes > target) {
        breachedByDay[createdKey] = (breachedByDay[createdKey] || 0) + 1;
      }
    }

    const rows = Object.keys(openedByDay).map((day) => ({
      day,
      opened: openedByDay[day] || 0,
      resolved: resolvedByDay[day] || 0,
      slaBreached: breachedByDay[day] || 0,
      mttaMinutes: 0,
      mttrMinutes: 0,
      updatedAt: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabaseServer
        .from('TicketMetricsDaily')
        .upsert(rows, { onConflict: 'day' });
      if (upsertError) {
        throw new Error(upsertError.message);
      }
    }

    return NextResponse.json({ rolledUp: rows.length, days, range: { start, end } });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to roll up dashboard metrics' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}
