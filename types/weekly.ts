export interface WeeklyBriefRequest {
  week_start?: string; // ISO date
  agenda?: string;
  raw_updates: string;
}

export type WeeklyBriefMode = 'prep' | 'publish';
export type WeeklyBriefStatus = 'draft' | 'published';

export interface WeeklyBriefSection {
  title: string;
  body: string;
}

export interface WeeklyAction {
  id: string;
  team?: string;
  description: string;
  owner?: string;
  due_date?: string;
  status: 'open' | 'closed';
  source?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WeeklyBrief {
  id: string;
  week_start: string;
  agenda?: string;
  raw_updates: string;
  digest: WeeklyBriefSection[];
  run_of_show: WeeklyBriefSection[];
  action_register: WeeklyAction[];
  created_at: string;
  updated_at: string;
}

export interface WeeklyBriefHistoryItem {
  id: string;
  mode: WeeklyBriefMode;
  status: WeeklyBriefStatus;
  weekStart: string;
  agenda?: string;
  rawUpdates: string;
  digest: WeeklyBriefSection[];
  runOfShow: WeeklyBriefSection[];
  actions: WeeklyAction[];
  createdAt: string;
  updatedAt: string;
}
