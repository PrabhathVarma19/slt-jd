create table if not exists weekly_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  mode text not null check (mode in ('prep', 'publish')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  week_start date not null,
  agenda text,
  raw_updates text not null,
  digest jsonb not null default '[]'::jsonb,
  run_of_show jsonb not null default '[]'::jsonb,
  action_register jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_weekly_briefs_user_created_at
  on weekly_briefs(user_id, created_at desc);

create trigger update_weekly_briefs_updated_at
  before update on weekly_briefs
  for each row
  execute function update_updated_at_column();
