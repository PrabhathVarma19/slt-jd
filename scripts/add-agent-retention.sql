-- Agent log retention support (archive + metrics rollups)

create table if not exists "AgentLogArchive" (
  id uuid primary key default gen_random_uuid(),
  sourceLogId uuid not null,
  userId uuid,
  agent text,
  intent text,
  tool text,
  input text,
  response text,
  success boolean,
  toolInput jsonb,
  metadata jsonb,
  createdAt timestamptz,
  archivedAt timestamptz not null default now()
);

create unique index if not exists agentlogarchive_source_idx
  on "AgentLogArchive" ("sourceLogId");

create index if not exists agentlogarchive_created_idx
  on "AgentLogArchive" ("createdAt");

create table if not exists "AgentLogMetricsDaily" (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  agent text not null,
  intent text,
  tool text,
  successCount integer not null default 0,
  failureCount integer not null default 0,
  totalCount integer not null default 0,
  createdAt timestamptz not null default now()
);

create unique index if not exists agentlogmetricsdaily_unique_idx
  on "AgentLogMetricsDaily" ("day", "agent", "intent", "tool");
