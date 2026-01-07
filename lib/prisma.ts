// Prisma client - will be available after running: npx prisma generate
// For now, this is a placeholder to avoid build errors
// TODO: Generate Prisma client once network/proxy issues are resolved

let PrismaClient: any;
try {
  PrismaClient = require('@prisma/client').PrismaClient;
} catch {
  // Prisma client not generated yet - will be available after prisma generate
  PrismaClient = null;
}

const globalForPrisma = globalThis as unknown as {
  prisma: any;
};

export const prisma = PrismaClient
  ? (globalForPrisma.prisma ??
    new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    }))
  : null;

if (PrismaClient && process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

