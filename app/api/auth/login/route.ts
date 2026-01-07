import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();

    // TODO: Once Prisma client is generated, replace this with actual DB query
    // For now, this is a placeholder that will fail gracefully
    if (!prisma) {
      return NextResponse.json(
        { error: 'Database not initialized. Please run: npx prisma generate && npm run db:push' },
        { status: 503 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        roles: {
          include: {
            role: true,
          },
          where: {
            revokedAt: null, // Only active roles
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Account is not active. Please contact support.' },
        { status: 403 }
      );
    }

    // Verify password
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'Password not set. Please use SSO or contact support.' },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Get user roles
    const roles = user.roles.map((ur: any) => ur.role.type);

    // Create session
    await createSession({
      userId: user.id,
      email: user.email,
      roles,
    });

    // TODO: Sync user profile from Profile API (Feature D)
    // This will be added in a later feature

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        roles,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An error occurred during login. Please try again.' },
      { status: 500 }
    );
  }
}

