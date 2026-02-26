-- Store reason/comments directly on assignment records.
-- Safe to run multiple times.

ALTER TABLE "TicketAssignment"
  ADD COLUMN IF NOT EXISTS "assignedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "unassignedReason" TEXT;
