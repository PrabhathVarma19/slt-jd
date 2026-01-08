-- ============================================
-- COMPLETE DATABASE SETUP FOR BEACON
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. CREATE TABLES
-- ============================================

-- Roles table
CREATE TABLE IF NOT EXISTS "Role" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_type ON "Role"(type);

-- Users table
CREATE TABLE IF NOT EXISTS "User" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_email ON "User"(email);
CREATE INDEX IF NOT EXISTS idx_user_status ON "User"(status);

-- UserProfile table
CREATE TABLE IF NOT EXISTS "UserProfile" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
  "employeeId" INTEGER UNIQUE,
  "empName" TEXT,
  "gradeCode" TEXT,
  location TEXT,
  "projectCode" TEXT,
  "projectName" TEXT,
  "orgGroup" TEXT,
  "pmEmail" TEXT,
  "dmEmail" TEXT,
  "supervisorEmail" TEXT,
  "rawPayloadJson" JSONB,
  "lastSyncedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_userprofile_userid ON "UserProfile"("userId");
CREATE INDEX IF NOT EXISTS idx_userprofile_employeeid ON "UserProfile"("employeeId");
CREATE INDEX IF NOT EXISTS idx_userprofile_projectcode ON "UserProfile"("projectCode");
CREATE INDEX IF NOT EXISTS idx_userprofile_orggroup ON "UserProfile"("orgGroup");

-- UserRole table (many-to-many)
CREATE TABLE IF NOT EXISTS "UserRole" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "roleId" TEXT NOT NULL REFERENCES "Role"(id) ON DELETE CASCADE,
  "grantedBy" TEXT,
  "grantedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "revokedAt" TIMESTAMPTZ,
  "revokedBy" TEXT,
  UNIQUE("userId", "roleId")
);

CREATE INDEX IF NOT EXISTS idx_userrole_userid ON "UserRole"("userId");
CREATE INDEX IF NOT EXISTS idx_userrole_roleid ON "UserRole"("roleId");

-- Tickets table
CREATE TABLE IF NOT EXISTS "Ticket" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "ticketNumber" TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('IT', 'TRAVEL')),
  "requesterId" TEXT NOT NULL REFERENCES "User"(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  impact TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'WAITING_ON_REQUESTER', 'RESOLVED', 'CLOSED', 'PENDING_APPROVAL')),
  domain TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "resolvedAt" TIMESTAMPTZ,
  "closedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ticket_requesterid ON "Ticket"("requesterId");
CREATE INDEX IF NOT EXISTS idx_ticket_status ON "Ticket"(status);
CREATE INDEX IF NOT EXISTS idx_ticket_type ON "Ticket"(type);
CREATE INDEX IF NOT EXISTS idx_ticket_domain ON "Ticket"(domain);
CREATE INDEX IF NOT EXISTS idx_ticket_createdat ON "Ticket"("createdAt");
CREATE INDEX IF NOT EXISTS idx_ticket_ticketnumber ON "Ticket"("ticketNumber");

-- TicketAssignment table
CREATE TABLE IF NOT EXISTS "TicketAssignment" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "ticketId" TEXT NOT NULL REFERENCES "Ticket"(id) ON DELETE CASCADE,
  "engineerId" TEXT NOT NULL REFERENCES "User"(id),
  "assignedBy" TEXT,
  "assignedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "unassignedAt" TIMESTAMPTZ,
  "unassignedBy" TEXT
);

CREATE INDEX IF NOT EXISTS idx_ticketassignment_ticketid ON "TicketAssignment"("ticketId");
CREATE INDEX IF NOT EXISTS idx_ticketassignment_engineerid ON "TicketAssignment"("engineerId");
CREATE INDEX IF NOT EXISTS idx_ticketassignment_assignedat ON "TicketAssignment"("assignedAt");

-- TicketEvent table
CREATE TABLE IF NOT EXISTS "TicketEvent" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "ticketId" TEXT NOT NULL REFERENCES "Ticket"(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('CREATED', 'ASSIGNED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'NOTE_ADDED', 'APPROVAL_REQUESTED', 'APPROVED', 'REJECTED')),
  "createdBy" TEXT NOT NULL REFERENCES "User"(id),
  payload JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticketevent_ticketid ON "TicketEvent"("ticketId");
CREATE INDEX IF NOT EXISTS idx_ticketevent_createdat ON "TicketEvent"("createdAt");
CREATE INDEX IF NOT EXISTS idx_ticketevent_type ON "TicketEvent"(type);

-- TicketApproval table
CREATE TABLE IF NOT EXISTS "TicketApproval" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "ticketId" TEXT NOT NULL REFERENCES "Ticket"(id) ON DELETE CASCADE,
  "approverEmail" TEXT NOT NULL,
  "approverUserId" TEXT,
  state TEXT NOT NULL CHECK (state IN ('PENDING', 'APPROVED', 'REJECTED')),
  note TEXT,
  "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "decidedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ticketapproval_ticketid ON "TicketApproval"("ticketId");
CREATE INDEX IF NOT EXISTS idx_ticketapproval_approveremail ON "TicketApproval"("approverEmail");
CREATE INDEX IF NOT EXISTS idx_ticketapproval_state ON "TicketApproval"(state);

-- AuditLog table
CREATE TABLE IF NOT EXISTS "AuditLog" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'ROLE_GRANTED', 'ROLE_REVOKED', 'TICKET_CREATED', 'TICKET_UPDATED', 'TICKET_DELETED', 'TICKET_ASSIGNED', 'TICKET_STATUS_CHANGED', 'LOGIN', 'LOGOUT', 'PROFILE_SYNCED')),
  "resourceType" TEXT,
  "resourceId" TEXT,
  details JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auditlog_userid ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS idx_auditlog_action ON "AuditLog"(action);
CREATE INDEX IF NOT EXISTS idx_auditlog_resource ON "AuditLog"("resourceType", "resourceId");
CREATE INDEX IF NOT EXISTS idx_auditlog_createdat ON "AuditLog"("createdAt");

-- SubscriptionCatalogItem table
CREATE TABLE IF NOT EXISTS "SubscriptionCatalogItem" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  vendor TEXT NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  "unitCostMonthly" DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vendor, sku)
);

CREATE INDEX IF NOT EXISTS idx_subscriptioncatalogitem_vendor ON "SubscriptionCatalogItem"(vendor);

-- SubscriptionInstance table
CREATE TABLE IF NOT EXISTS "SubscriptionInstance" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "catalogItemId" TEXT NOT NULL REFERENCES "SubscriptionCatalogItem"(id),
  "userId" TEXT,
  department TEXT,
  "startDate" TIMESTAMPTZ NOT NULL,
  "endDate" TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED', 'EXPIRED')),
  notes TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptioninstance_catalogitemid ON "SubscriptionInstance"("catalogItemId");
CREATE INDEX IF NOT EXISTS idx_subscriptioninstance_userid ON "SubscriptionInstance"("userId");
CREATE INDEX IF NOT EXISTS idx_subscriptioninstance_status ON "SubscriptionInstance"(status);
CREATE INDEX IF NOT EXISTS idx_subscriptioninstance_startdate ON "SubscriptionInstance"("startDate");

-- ============================================
-- 2. CREATE ROLES
-- ============================================

INSERT INTO "Role" (id, type, name, description, "createdAt")
VALUES 
  (gen_random_uuid()::text, 'EMPLOYEE', 'Employee', 'Standard employee role', NOW()),
  (gen_random_uuid()::text, 'ENGINEER_IT', 'IT Engineer', 'IT engineer with ticket queue access', NOW()),
  (gen_random_uuid()::text, 'ENGINEER_TRAVEL', 'Travel Engineer', 'Travel engineer with ticket queue access', NOW()),
  (gen_random_uuid()::text, 'ADMIN_IT', 'IT Admin', 'IT admin with triage and assignment access', NOW()),
  (gen_random_uuid()::text, 'ADMIN_TRAVEL', 'Travel Admin', 'Travel admin with triage and assignment access', NOW()),
  (gen_random_uuid()::text, 'ADMIN_HR', 'HR Admin', 'HR admin with policy source management', NOW()),
  (gen_random_uuid()::text, 'SUPER_ADMIN', 'Super Admin', 'Full system access including user management', NOW())
ON CONFLICT (type) DO NOTHING;

-- ============================================
-- 3. CREATE TEST USER
-- ============================================

-- Create test user: user@trianz.com / test123
INSERT INTO "User" (id, email, "passwordHash", status, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'user@trianz.com',
  '$2b$10$Ic.bqdzaf8dBO3FsVbJ7CO.Ol7OA09eapW5bPLA27VWgKdB5/FoPW',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  "passwordHash" = EXCLUDED."passwordHash",
  status = 'ACTIVE';

-- Assign SUPER_ADMIN role to test user
DO $$
DECLARE
  v_user_id TEXT;
  v_role_id TEXT;
BEGIN
  SELECT id INTO v_user_id FROM "User" WHERE email = 'user@trianz.com';
  SELECT id INTO v_role_id FROM "Role" WHERE type = 'SUPER_ADMIN';
  
  IF v_user_id IS NOT NULL AND v_role_id IS NOT NULL THEN
    INSERT INTO "UserRole" (id, "userId", "roleId", "grantedAt")
    VALUES (gen_random_uuid()::text, v_user_id, v_role_id, NOW())
    ON CONFLICT ("userId", "roleId") DO UPDATE SET "revokedAt" = NULL;
  END IF;
END $$;

-- ============================================
-- DONE!
-- ============================================
-- Test credentials:
-- Email: user@trianz.com
-- Password: test123
-- Role: SUPER_ADMIN
-- ============================================



