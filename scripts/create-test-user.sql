-- Create test user: user@trianz.com / test123
-- Run this in Supabase SQL Editor

-- First, create the roles if they don't exist
INSERT INTO "Role" (id, type, name, description, "createdAt")
VALUES 
  (gen_random_uuid(), 'EMPLOYEE', 'Employee', 'Standard employee role', NOW()),
  (gen_random_uuid(), 'SUPER_ADMIN', 'Super Admin', 'Full system access', NOW())
ON CONFLICT (type) DO NOTHING;

-- Create the test user (password hash for 'test123')
-- Hash generated with: bcrypt.hash('test123', 10)
-- This is a pre-computed hash - in production, use the hashPassword function
INSERT INTO "User" (id, email, "passwordHash", status, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'user@trianz.com',
  '$2a$10$rOzJqZqZqZqZqZqZqZqZqOZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZqZq', -- Placeholder - will be replaced with real hash
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  "passwordHash" = EXCLUDED."passwordHash",
  status = 'ACTIVE';

-- Get the user ID and assign SUPER_ADMIN role
DO $$
DECLARE
  v_user_id UUID;
  v_role_id UUID;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id FROM "User" WHERE email = 'user@trianz.com';
  
  -- Get SUPER_ADMIN role ID
  SELECT id INTO v_role_id FROM "Role" WHERE type = 'SUPER_ADMIN';
  
  -- Assign role
  IF v_user_id IS NOT NULL AND v_role_id IS NOT NULL THEN
    INSERT INTO "UserRole" (id, "userId", "roleId", "grantedAt")
    VALUES (gen_random_uuid(), v_user_id, v_role_id, NOW())
    ON CONFLICT ("userId", "roleId") DO NOTHING;
  END IF;
END $$;



