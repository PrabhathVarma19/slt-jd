// Prisma seed script - run with: npm run db:seed
// Note: Prisma client must be generated first (npx prisma generate)

let PrismaClient: any;
try {
  PrismaClient = require('@prisma/client').PrismaClient;
} catch {
  console.error('❌ Prisma client not found. Please run: npx prisma generate');
  process.exit(1);
}

import { hashPassword } from '../lib/auth/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create roles
  console.log('Creating roles...');
  const roles = [
    { type: 'EMPLOYEE', name: 'Employee', description: 'Standard employee role' },
    { type: 'ENGINEER_IT', name: 'IT Engineer', description: 'IT engineer with ticket queue access' },
    { type: 'ENGINEER_TRAVEL', name: 'Travel Engineer', description: 'Travel engineer with ticket queue access' },
    { type: 'ADMIN_IT', name: 'IT Admin', description: 'IT admin with triage and assignment access' },
    { type: 'ADMIN_TRAVEL', name: 'Travel Admin', description: 'Travel admin with triage and assignment access' },
    { type: 'ADMIN_HR', name: 'HR Admin', description: 'HR admin with policy source management' },
    { type: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full system access including user management' },
  ];

  for (const roleData of roles) {
    await prisma.role.upsert({
      where: { type: roleData.type },
      update: {},
      create: roleData,
    });
  }

  console.log('✅ Roles created');

  // Create test user: user@trianz.com / test123
  console.log('Creating test user...');
  const testPasswordHash = await hashPassword('test123');
  
  const testUser = await prisma.user.upsert({
    where: { email: 'user@trianz.com' },
    update: {
      passwordHash: testPasswordHash,
      status: 'ACTIVE',
    },
    create: {
      email: 'user@trianz.com',
      passwordHash: testPasswordHash,
      status: 'ACTIVE',
    },
  });

  console.log('✅ Test user created:', testUser.email);

  // Assign SUPER_ADMIN role to test user
  const superAdminRole = await prisma.role.findUnique({
    where: { type: 'SUPER_ADMIN' },
  });

  if (superAdminRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: testUser.id,
          roleId: superAdminRole.id,
        },
      },
      update: {
        revokedAt: null, // Ensure it's active
      },
      create: {
        userId: testUser.id,
        roleId: superAdminRole.id,
      },
    });
    console.log('✅ SUPER_ADMIN role assigned to test user');
  }

  console.log('🎉 Seeding complete!');
  console.log('\nTest credentials:');
  console.log('  Email: user@trianz.com');
  console.log('  Password: test123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

