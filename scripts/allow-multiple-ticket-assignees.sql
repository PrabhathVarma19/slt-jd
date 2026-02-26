-- Allow multiple active assignees per ticket.
-- Keeps one active row per (ticketId, engineerId) to avoid duplicate assignment records.

DO $$
DECLARE
  idx RECORD;
BEGIN
  -- Drop any existing unique partial index that enforces a single active assignee per ticket.
  FOR idx IN
    SELECT schemaname, indexname, indexdef
    FROM pg_indexes
    WHERE tablename IN ('TicketAssignment', 'ticketassignment')
      AND indexdef ILIKE '%UNIQUE INDEX%'
      AND indexdef ILIKE '%("ticketId")%'
      AND indexdef ILIKE '%unassignedAt%'
      AND indexdef NOT ILIKE '%"engineerId"%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I.%I', idx.schemaname, idx.indexname);
  END LOOP;
END $$;

-- Ensure we do not create duplicate active assignments for the same engineer and ticket.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ticketassignment_active_ticket_engineer_unique
  ON "TicketAssignment" ("ticketId", "engineerId")
  WHERE "unassignedAt" IS NULL;
