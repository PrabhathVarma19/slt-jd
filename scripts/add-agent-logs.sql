-- ============================================
-- Agent logs for audit and monitoring
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS "AgentLog" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  input TEXT NOT NULL,
  intent TEXT NOT NULL,
  tool TEXT NOT NULL,
  "toolInput" JSONB,
  response TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agentlog_agent ON "AgentLog"(agent);
CREATE INDEX IF NOT EXISTS idx_agentlog_user ON "AgentLog"("userId");
CREATE INDEX IF NOT EXISTS idx_agentlog_createdat ON "AgentLog"("createdAt");
