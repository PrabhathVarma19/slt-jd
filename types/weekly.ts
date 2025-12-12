export interface WeeklyBriefRequest {
  week_start?: string; // ISO date
  agenda?: string;
  raw_updates: string;
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
  digest: { title: string; body: string }[];
  run_of_show: { title: string; body: string }[];
  action_register: WeeklyAction[];
  created_at: string;
  updated_at: string;
}
