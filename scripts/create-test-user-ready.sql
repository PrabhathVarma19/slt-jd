-- Run this SQL in Supabase SQL Editor to create test user
-- Email: user@trianz.com
-- Password: test123

-- First, create roles if they don't exist
INSERT INTO "Role" (id, type, name, description, "createdAt")
VALUES 
  (gen_random_uuid(), 'EMPLOYEE', 'Employee', 'Standard employee role', NOW()),
  (gen_random_uuid(), 'SUPER_ADMIN', 'Super Admin', 'Full system access', NOW())
ON CONFLICT (type) DO NOTHING;

-- Create test user
INSERT INTO "User" (id, email, "passwordHash", status, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'user@trianz.com',
  '$2b$10$8chQlnc5BCnLDE1.qiBsuOUH9p4PHoMuITUwo2gwLIj5kCsfNVRWG',
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
  v_user_id UUID;
  v_role_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM "User" WHERE email = 'user@trianz.com';
  SELECT id INTO v_role_id FROM "Role" WHERE type = 'SUPER_ADMIN';
  
  IF v_user_id IS NOT NULL AND v_role_id IS NOT NULL THEN
    INSERT INTO "UserRole" (id, "userId", "roleId", "grantedAt")
    VALUES (gen_random_uuid(), v_user_id, v_role_id, NOW())
    ON CONFLICT ("userId", "roleId") DO UPDATE SET "revokedAt" = NULL;
  END IF;
END $$;

