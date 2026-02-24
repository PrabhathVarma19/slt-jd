import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyBriefDraft } from '@/lib/ai/llm';
import { requireAuth } from '@/lib/auth/require-auth';
import { supabaseServer } from '@/lib/supabase/server';
import {
  WeeklyAction,
  WeeklyBrief,
  WeeklyBriefHistoryItem,
  WeeklyBriefMode,
  WeeklyBriefRequest,
  WeeklyBriefSection,
  WeeklyBriefStatus,
} from '@/types/weekly';

type WeeklyBriefSavePayload = {
  id?: string;
  save?: boolean;
  mode?: WeeklyBriefMode;
  status?: WeeklyBriefStatus;
  week_start?: string;
  agenda?: string;
  raw_updates?: string;
  digest?: WeeklyBriefSection[];
  run_of_show?: WeeklyBriefSection[];
  action_register?: WeeklyAction[];
};

function normalizeSections(input: unknown): WeeklyBriefSection[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => ({
      title: typeof item?.title === 'string' ? item.title.trim() : '',
      body: typeof item?.body === 'string' ? item.body.trim() : '',
    }))
    .filter((item) => item.title || item.body);
}

function normalizeActions(input: unknown): WeeklyAction[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, idx) => {
      const status: WeeklyAction['status'] = item?.status === 'closed' ? 'closed' : 'open';
      return {
        id: typeof item?.id === 'string' && item.id.trim() ? item.id.trim() : `A-${idx + 1}`,
        team: typeof item?.team === 'string' ? item.team.trim() : undefined,
        description: typeof item?.description === 'string' ? item.description.trim() : '',
        owner: typeof item?.owner === 'string' ? item.owner.trim() : undefined,
        due_date: typeof item?.due_date === 'string' ? item.due_date.trim() : undefined,
        status,
      };
    })
    .filter((item) => item.description);
}

function mapHistoryRow(row: any): WeeklyBriefHistoryItem {
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    weekStart: row.week_start,
    agenda: row.agenda || '',
    rawUpdates: row.raw_updates,
    digest: normalizeSections(row.digest),
    runOfShow: normalizeSections(row.run_of_show),
    actions: normalizeActions(row.action_register),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getDefaultWeekStart(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const auth = await requireAuth();

    const { data, error } = await supabaseServer
      .from('weekly_briefs')
      .select(
        'id, mode, status, week_start, agenda, raw_updates, digest, run_of_show, action_register, created_at, updated_at'
      )
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      items: (data || []).map(mapHistoryRow),
    });
  } catch (error: any) {
    const message = (error?.message || '').toString();
    if (message.includes('Not authenticated')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.error('Weekly brief history error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch weekly brief history' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as WeeklyBriefRequest & WeeklyBriefSavePayload;

    if (!body?.save) {
      if (!body || !body.raw_updates || !body.raw_updates.trim()) {
        return NextResponse.json({ error: 'Missing raw_updates' }, { status: 400 });
      }

      const brief = await generateWeeklyBriefDraft(body);
      return NextResponse.json(brief);
    }

    const auth = await requireAuth();

    const weekStart =
      typeof body.week_start === 'string' && body.week_start.trim()
        ? body.week_start.trim()
        : getDefaultWeekStart();
    const mode: WeeklyBriefMode = body.mode === 'publish' ? 'publish' : 'prep';
    const status: WeeklyBriefStatus = body.status === 'published' ? 'published' : 'draft';
    const agenda = typeof body.agenda === 'string' ? body.agenda.trim() : '';
    const rawUpdates = typeof body.raw_updates === 'string' ? body.raw_updates.trim() : '';
    const digest = normalizeSections(body.digest);
    const runOfShow = normalizeSections(body.run_of_show);
    const actions = normalizeActions(body.action_register);

    if (!rawUpdates) {
      return NextResponse.json({ error: 'raw_updates is required for save' }, { status: 400 });
    }

    if (digest.length === 0 && runOfShow.length === 0 && actions.length === 0) {
      return NextResponse.json({ error: 'Cannot save an empty weekly brief' }, { status: 400 });
    }

    const payload = {
      user_id: auth.userId,
      mode,
      status,
      week_start: weekStart,
      agenda,
      raw_updates: rawUpdates,
      digest,
      run_of_show: runOfShow,
      action_register: actions,
    };

    const recordId = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : null;
    if (recordId) {
      const { data, error } = await supabaseServer
        .from('weekly_briefs')
        .update(payload)
        .eq('id', recordId)
        .eq('user_id', auth.userId)
        .select(
          'id, mode, status, week_start, agenda, raw_updates, digest, run_of_show, action_register, created_at, updated_at'
        )
        .single();

      if (error || !data) {
        throw new Error(error?.message || 'Weekly brief not found');
      }

      return NextResponse.json({ item: mapHistoryRow(data) });
    }

    const { data, error } = await supabaseServer
      .from('weekly_briefs')
      .insert(payload)
      .select(
        'id, mode, status, week_start, agenda, raw_updates, digest, run_of_show, action_register, created_at, updated_at'
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to save weekly brief');
    }

    return NextResponse.json({ item: mapHistoryRow(data) });
  } catch (error: any) {
    const message = (error?.message || '').toString();
    if (message.includes('Not authenticated')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.error('Weekly brief API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process weekly brief request' },
      { status: 500 }
    );
  }
}
