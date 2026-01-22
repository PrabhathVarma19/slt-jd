-- Ticket metrics rollup table for dashboard performance

create table if not exists "TicketMetricsDaily" (
  day date primary key,
  opened integer not null default 0,
  resolved integer not null default 0,
  slaBreached integer not null default 0,
  mttaMinutes integer not null default 0,
  mttrMinutes integer not null default 0,
  createdAt timestamptz not null default now(),
  updatedAt timestamptz not null default now()
);

create index if not exists ticketmetricsdaily_day_idx
  on "TicketMetricsDaily"(day);
