-- ============================================
-- Engineering Tools: Draft History + Presets + Audit
-- Run in Supabase SQL editor
-- ============================================

create table if not exists "EngineeringToolDraft" (
  id text primary key default gen_random_uuid()::text,
  "userId" text references "User"(id) on delete set null,
  tool text not null,
  input jsonb not null,
  output jsonb not null,
  "createdAt" timestamptz not null default now()
);

create index if not exists engineeringtooldraft_userid_idx
  on "EngineeringToolDraft"("userId");
create index if not exists engineeringtooldraft_tool_idx
  on "EngineeringToolDraft"(tool);
create index if not exists engineeringtooldraft_created_idx
  on "EngineeringToolDraft"("createdAt");

create table if not exists "EngineeringToolPreset" (
  id text primary key default gen_random_uuid()::text,
  "userId" text references "User"(id) on delete set null,
  tool text not null,
  name text not null,
  data jsonb not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index if not exists engineeringtoolpreset_unique
  on "EngineeringToolPreset"("userId", tool, name);
create index if not exists engineeringtoolpreset_tool_idx
  on "EngineeringToolPreset"(tool);

create table if not exists "EngineeringToolAuditLog" (
  id text primary key default gen_random_uuid()::text,
  "userId" text references "User"(id) on delete set null,
  tool text not null,
  action text not null,
  meta jsonb,
  "createdAt" timestamptz not null default now()
);

create index if not exists engineeringtoolaudit_userid_idx
  on "EngineeringToolAuditLog"("userId");
create index if not exists engineeringtoolaudit_tool_idx
  on "EngineeringToolAuditLog"(tool);

-- ============================================
-- DONE
-- ============================================
