-- ============================================
-- SLA CONFIGURATION FOR IT ANALYTICS
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS "SlaConfig" (
  priority TEXT PRIMARY KEY CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  "targetMinutes" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO "SlaConfig" (priority, "targetMinutes")
VALUES
  ('URGENT', 240),
  ('HIGH', 480),
  ('MEDIUM', 1440),
  ('LOW', 4320)
ON CONFLICT (priority) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_slaconfig_priority ON "SlaConfig"(priority);
