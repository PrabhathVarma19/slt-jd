-- Notification failure logging (emails)

create table if not exists "NotificationFailure" (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  domain text not null default 'IT',
  event text not null,
  ticketId uuid,
  actorId uuid,
  recipients jsonb not null default '[]'::jsonb,
  subject text,
  htmlBody text,
  textBody text,
  errorMessage text,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'FAILED',
  attempts integer not null default 1,
  createdAt timestamptz not null default now(),
  lastAttemptAt timestamptz
);

create index if not exists notificationfailure_status_idx
  on "NotificationFailure" ("status");

create index if not exists notificationfailure_created_idx
  on "NotificationFailure" ("createdAt");
