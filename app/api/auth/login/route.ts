import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';
import { syncUserProfile } from '@/lib/api/sync-user-profile';
import { resolveLoginUser } from '@/lib/auth/resolve-login-user';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { user } = await resolveLoginUser(normalizedEmail);

    const { data: passwordData, error: passwordError } = await supabaseServer
      .from('User')
      .select('"passwordHash"')
      .eq('id', user.id)
      .maybeSingle();

    if (passwordError) {
      throw new Error(passwordError.message);
    }

    if (!passwordData?.passwordHash) {
      return NextResponse.json(
        { error: 'Password not set. Please use SSO or contact support.' },
        { status: 401 }
      );
    }

    const isValidPassword = await verifyPassword(password, passwordData.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    await createSession({
      userId: user.id,
      email: user.email,
      roles: user.roles,
    });

    syncUserProfile(normalizedEmail).catch((error) => {
      console.error('Background profile sync failed:', error);
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
      },
    });
  } catch (error: any) {
    const message = error?.message || 'An error occurred during login. Please try again.';
    console.error('Login error:', error);

    if (message.includes('Account not found')) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message.includes('Account is not active')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'An error occurred during login. Please try again.' },
      { status: 500 }
    );
  }
}
