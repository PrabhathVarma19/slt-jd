create extension if not exists pgcrypto;

create table if not exists sharepoint_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  site_url text not null,
  library_name text not null,
  folder_path text,
  site_id text,
  drive_id text,
  enabled boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_sharepoint_sources_enabled on sharepoint_sources(enabled);
create index if not exists idx_sharepoint_sources_category on sharepoint_sources(category);
