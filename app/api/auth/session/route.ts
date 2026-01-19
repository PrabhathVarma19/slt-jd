import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({
        isAuthenticated: false,
        authenticated: false,
      });
    }

    // Check if this is a test email - test emails should not have synced profile data
    const normalizedEmail = session.email?.toLowerCase().trim();
    const testEmails = ['user@trianz.com', 'test@trianz.com', 'admin@trianz.com'];
    const isTestEmail = normalizedEmail && testEmails.includes(normalizedEmail);

    // Verify user still exists and is active
    const { data: userData, error: userError } = await supabaseServer
      .from('User')
      .select(`
        id,
        email,
        status,
        profile:UserProfile (
          empName
        )
      `)
      .eq('id', session.userId)
      .maybeSingle();
    
    if (userError) {
      console.error('[SESSION] Error fetching user in session check:', {
        userId: session.userId,
        error: userError,
      });
      return NextResponse.json({ 
        isAuthenticated: false,
        authenticated: false,
        error: 'Failed to fetch user data'
      }, { status: 500 });
    }
    
    const user = userData;
    const userProfile = Array.isArray(user?.profile) ? user.profile[0] : user?.profile;

    if (!user || user.status !== 'ACTIVE') {
      console.warn('[SESSION] User not found or inactive:', {
        userId: session.userId,
        userExists: !!user,
        status: user?.status,
      });
      return NextResponse.json({
        isAuthenticated: false,
        authenticated: false,
      });
    }

    // CRITICAL: Validate that user has required fields before returning authenticated: true
    if (!user.id || !user.email) {
      console.error('[SESSION] User data incomplete - missing required fields:', {
        userId: session.userId,
        hasId: !!user.id,
        hasEmail: !!user.email,
      });
      return NextResponse.json({
        isAuthenticated: false,
        authenticated: false,
        error: 'User data incomplete'
      }, { status: 500 });
    }

    // For test emails, don't return profile name (they shouldn't have synced data)
    const userName = isTestEmail ? null : userProfile?.empName;

    // Ensure roles is always an array
    const userRoles = Array.isArray(session.roles) ? session.roles : [];

    const responseData = {
      isAuthenticated: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: userName,
        roles: userRoles,
      },
    };

    // Final validation before sending response
    if (!responseData.user.id || !responseData.user.email) {
      console.error('[SESSION] Response validation failed - user object incomplete:', {
        userId: session.userId,
        responseData,
      });
      return NextResponse.json({
        isAuthenticated: false,
        authenticated: false,
        error: 'User data validation failed'
      }, { status: 500 });
    }

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('[SESSION] Session check error:', {
      error: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { 
        isAuthenticated: false,
        authenticated: false,
        error: 'Session check failed' 
      },
      { status: 500 }
    );
  }
}

