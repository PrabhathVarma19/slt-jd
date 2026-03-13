create extension if not exists pgcrypto;

create table if not exists sharepoint_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sharepoint_sources(id) on delete cascade,
  status text not null default 'queued',
  total_files integer not null default 0,
  processed_files integer not null default 0,
  synced_files integer not null default 0,
  skipped_files integer not null default 0,
  pending_files jsonb not null default '[]'::jsonb,
  file_results jsonb not null default '[]'::jsonb,
  last_error text,
  next_run_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sharepoint_sync_jobs_source_id on sharepoint_sync_jobs(source_id);
create index if not exists idx_sharepoint_sync_jobs_status on sharepoint_sync_jobs(status);
create index if not exists idx_sharepoint_sync_jobs_next_run_at on sharepoint_sync_jobs(next_run_at);
