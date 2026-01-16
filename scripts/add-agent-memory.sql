-- ============================================
-- Agent memory storage for shared runtime
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS "AgentMessage" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  agent TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agentmessage_user_agent ON "AgentMessage"("userId", agent);
CREATE INDEX IF NOT EXISTS idx_agentmessage_createdat ON "AgentMessage"("createdAt");
