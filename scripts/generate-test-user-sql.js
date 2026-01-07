const bcrypt = require('bcryptjs');

async function generateSQL() {
  const email = 'user@trianz.com';
  const password = 'test123';
  
  // Generate password hash
  const passwordHash = await bcrypt.hash(password, 10);
  
  console.log('-- Run this SQL in Supabase SQL Editor to create test user');
  console.log('-- Email: user@trianz.com');
  console.log('-- Password: test123');
  console.log('');
  console.log('-- First, create roles if they don\'t exist');
  console.log(`
INSERT INTO "Role" (id, type, name, description, "createdAt")
VALUES 
  (gen_random_uuid(), 'EMPLOYEE', 'Employee', 'Standard employee role', NOW()),
  (gen_random_uuid(), 'SUPER_ADMIN', 'Super Admin', 'Full system access', NOW())
ON CONFLICT (type) DO NOTHING;
`);

  console.log('-- Create test user');
  console.log(`
INSERT INTO "User" (id, email, "passwordHash", status, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  '${email}',
  '${passwordHash}',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET 
  "passwordHash" = EXCLUDED."passwordHash",
  status = 'ACTIVE';
`);

  console.log('-- Assign SUPER_ADMIN role to test user');
  console.log(`
DO $$
DECLARE
  v_user_id UUID;
  v_role_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM "User" WHERE email = '${email}';
  SELECT id INTO v_role_id FROM "Role" WHERE type = 'SUPER_ADMIN';
  
  IF v_user_id IS NOT NULL AND v_role_id IS NOT NULL THEN
    INSERT INTO "UserRole" (id, "userId", "roleId", "grantedAt")
    VALUES (gen_random_uuid(), v_user_id, v_role_id, NOW())
    ON CONFLICT ("userId", "roleId") DO UPDATE SET "revokedAt" = NULL;
  END IF;
END $$;
`);

  console.log('');
  console.log('✅ SQL generated! Copy and paste the above into Supabase SQL Editor.');
}

generateSQL().catch(console.error);

