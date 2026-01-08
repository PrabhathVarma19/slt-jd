import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import { syncUserProfile } from '@/lib/api/sync-user-profile';

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

    let user: any = null;
    let roles: string[] = [];

    // Use Supabase direct queries
    const { data: userData, error: userError } = await supabaseServer
      .from('User')
      .select('id, email, "passwordHash", status')
      .eq('email', normalizedEmail)
      .single();

    if (!userError && userData) {
      // Get user roles - query UserRole and join Role
      const { data: userRoles, error: rolesError } = await supabaseServer
        .from('UserRole')
        .select(`
          roleId,
          role:Role!inner(type)
        `)
        .eq('userId', userData.id)
        .is('revokedAt', null);

      if (!rolesError && userRoles && Array.isArray(userRoles)) {
        roles = userRoles
          .map((ur: any) => ur.role?.type)
          .filter((type: string | undefined) => type !== undefined);
      }

      user = {
        id: userData.id,
        email: userData.email,
        passwordHash: userData.passwordHash,
        status: userData.status,
      };
    }

    // If user doesn't exist, try to auto-create from API
    if (!user) {
      const syncResult = await syncUserProfile(normalizedEmail);
      
      if (!syncResult.success || !syncResult.created) {
        return NextResponse.json(
          { error: 'Account not found. Please contact IT support to create your account.' },
          { status: 401 }
        );
      }

      // User was created, fetch them again
      const { data: newUser } = await supabaseServer
        .from('User')
        .select('id, email, "passwordHash", status')
        .eq('email', normalizedEmail)
        .single();

      if (newUser) {
        const { data: userRoles } = await supabaseServer
          .from('UserRole')
          .select(`
            roleId,
            role:Role!inner(type)
          `)
          .eq('userId', newUser.id)
          .is('revokedAt', null);

        if (userRoles && Array.isArray(userRoles)) {
          roles = userRoles
            .map((ur: any) => ur.role?.type)
            .filter((type: string | undefined) => type !== undefined);
        }

        user = {
          id: newUser.id,
          email: newUser.email,
          passwordHash: newUser.passwordHash,
          status: newUser.status,
        };
      }

      // If still no user after sync attempt, return error
      if (!user) {
        return NextResponse.json(
          { error: 'Account not found. Please contact IT support.' },
          { status: 401 }
        );
      }
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

    // Create session
    await createSession({
      userId: user.id,
      email: user.email,
      roles,
    });

    // Sync user profile from external API (non-blocking)
    // This runs in the background and won't block login if it fails
    syncUserProfile(normalizedEmail).catch((error) => {
      console.error('Background profile sync failed:', error);
      // Don't throw - login should succeed even if sync fails
    });

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

