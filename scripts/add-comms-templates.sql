-- ============================================
-- Beacon Comms Templates
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS "CommsTemplate" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type TEXT NOT NULL CHECK (type IN (
    'security_advisory',
    'it_incident',
    'policy_update',
    'travel_advisory',
    'leadership_update'
  )),
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  version INTEGER NOT NULL DEFAULT 1,
  "createdBy" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "publishedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_commstemplate_type ON "CommsTemplate"(type);
CREATE INDEX IF NOT EXISTS idx_commstemplate_status ON "CommsTemplate"(status);

CREATE TABLE IF NOT EXISTS "CommsTemplateSection" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "templateId" TEXT NOT NULL REFERENCES "CommsTemplate"(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT true,
  locked BOOLEAN NOT NULL DEFAULT false,
  rules JSONB
);

CREATE INDEX IF NOT EXISTS idx_commstemplatesection_templateid ON "CommsTemplateSection"("templateId");

-- ============================================
-- Seed core templates if none exist
-- ============================================

DO $$
DECLARE
  security_id TEXT;
  incident_id TEXT;
  policy_id TEXT;
  travel_id TEXT;
  leadership_id TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "CommsTemplate") THEN
    INSERT INTO "CommsTemplate" (id, type, scope, status, version, "createdAt", "publishedAt")
    VALUES (gen_random_uuid()::text, 'security_advisory', 'global', 'published', 1, NOW(), NOW())
    RETURNING id INTO security_id;

    INSERT INTO "CommsTemplate" (id, type, scope, status, version, "createdAt", "publishedAt")
    VALUES (gen_random_uuid()::text, 'it_incident', 'global', 'published', 1, NOW(), NOW())
    RETURNING id INTO incident_id;

    INSERT INTO "CommsTemplate" (id, type, scope, status, version, "createdAt", "publishedAt")
    VALUES (gen_random_uuid()::text, 'policy_update', 'global', 'published', 1, NOW(), NOW())
    RETURNING id INTO policy_id;

    INSERT INTO "CommsTemplate" (id, type, scope, status, version, "createdAt", "publishedAt")
    VALUES (gen_random_uuid()::text, 'travel_advisory', 'global', 'published', 1, NOW(), NOW())
    RETURNING id INTO travel_id;

    INSERT INTO "CommsTemplate" (id, type, scope, status, version, "createdAt", "publishedAt")
    VALUES (gen_random_uuid()::text, 'leadership_update', 'global', 'published', 1, NOW(), NOW())
    RETURNING id INTO leadership_id;

    -- Security advisory
    INSERT INTO "CommsTemplateSection" ("templateId", key, title, "order", required, locked, rules)
    VALUES
      (security_id, 'summary', 'Summary', 1, true, true, '{"maxSentences":2}'::jsonb),
      (security_id, 'how_scam_works', 'How the Scam Works', 2, false, false, NULL),
      (security_id, 'hard_rules', 'Hard Rules (Never Do This)', 3, true, true, '{"verbatim":true,"defaultBody":"No Trianz leader, executive, or payroll provider will ever:\\n- Contact you from unknown or personal phone numbers\\n- Request money, gift cards, or wire transfers via SMS or WhatsApp\\n- Ask for banking or payroll details through messaging apps"}'::jsonb),
      (security_id, 'examples', 'Examples of Scam Messages', 4, true, false, NULL),
      (security_id, 'red_flags', 'Common Red Flags', 5, false, false, NULL),
      (security_id, 'verification_protocol', 'Verification Protocol', 6, true, false, '{"defaultBody":"All legitimate leadership or payroll communications will only occur through:\\n- Official company email domains (@trianz.com, @concierto.cloud)\\n- Verified internal platforms such as Teams, Corporate Email, or Pulse\\n- Scheduled meetings through corporate calendars"}'::jsonb),
      (security_id, 'mandatory_actions', 'Mandatory Actions (STOP / VERIFY / REPORT)', 7, true, true, NULL),
      (security_id, 'if_responded', 'If You Already Responded', 8, true, false, NULL),
      (security_id, 'signature', 'Signature', 9, true, true, '{"defaultBody":"Information Security\\nEmail: infosec@trianz.com"}'::jsonb);

    -- IT incident / outage
    INSERT INTO "CommsTemplateSection" ("templateId", key, title, "order", required, locked, rules)
    VALUES
      (incident_id, 'summary', 'Summary', 1, true, true, '{"maxSentences":2}'::jsonb),
      (incident_id, 'impact_details', 'Impact Details', 2, true, false, NULL),
      (incident_id, 'timeline', 'Timeline (Key Events)', 3, true, false, NULL),
      (incident_id, 'current_status', 'Current Status', 4, true, false, NULL),
      (incident_id, 'workarounds', 'Workarounds (if any)', 5, false, false, NULL),
      (incident_id, 'next_update', 'Next Update', 6, true, false, NULL),
      (incident_id, 'contact', 'Contact', 7, true, true, '{"defaultBody":"IT Service Desk: it.servicedesk@trianz.com"}'::jsonb);

    -- Policy update
    INSERT INTO "CommsTemplateSection" ("templateId", key, title, "order", required, locked, rules)
    VALUES
      (policy_id, 'summary', 'Summary', 1, true, true, '{"maxSentences":2}'::jsonb),
      (policy_id, 'key_changes', 'Key Changes (Top 3-5)', 2, true, false, NULL),
      (policy_id, 'actions_required', 'What You Need To Do', 3, true, false, NULL),
      (policy_id, 'full_policy', 'Where to Read the Full Policy', 4, true, false, NULL),
      (policy_id, 'contacts', 'Contacts', 5, true, false, NULL);

    -- Travel advisory
    INSERT INTO "CommsTemplateSection" ("templateId", key, title, "order", required, locked, rules)
    VALUES
      (travel_id, 'summary', 'Summary', 1, true, true, '{"maxSentences":2}'::jsonb),
      (travel_id, 'affected_travelers', 'Affected Travelers', 2, true, false, NULL),
      (travel_id, 'allowed_not_allowed', 'What\'s Allowed / Not Allowed', 3, true, false, NULL),
      (travel_id, 'approval_process', 'Approval Process', 4, true, false, NULL),
      (travel_id, 'travel_desk', 'Travel Desk Contact', 5, true, true, '{"defaultBody":"Travel Desk: travel@trianz.com"}'::jsonb);

    -- Leadership / org update
    INSERT INTO "CommsTemplateSection" ("templateId", key, title, "order", required, locked, rules)
    VALUES
      (leadership_id, 'summary', 'Summary', 1, true, true, '{"maxSentences":2}'::jsonb),
      (leadership_id, 'context', 'Context', 2, true, false, NULL),
      (leadership_id, 'changes', 'What\'s Changing', 3, true, false, NULL),
      (leadership_id, 'timeline', 'Timeline / Next Steps', 4, true, false, NULL),
      (leadership_id, 'actions_required', 'Actions Required (if any)', 5, true, false, NULL),
      (leadership_id, 'contacts', 'Contacts', 6, true, false, NULL);
  END IF;
END $$;

-- ============================================
-- DONE
-- ============================================
