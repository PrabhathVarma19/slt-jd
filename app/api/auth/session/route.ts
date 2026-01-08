import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ 
        isAuthenticated: false,
        authenticated: false 
      }, { status: 401 });
    }

    // Verify user still exists and is active
    const { data: userData } = await supabaseServer
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
      .single();
    
    const user = userData;
    const userProfile = Array.isArray(user?.profile) ? user.profile[0] : user?.profile;

    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json({ 
        isAuthenticated: false,
        authenticated: false 
      }, { status: 401 });
    }

    return NextResponse.json({
      isAuthenticated: true,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: userProfile?.empName,
        roles: session.roles || [],
      },
    });
  } catch (error: any) {
    console.error('Session check error:', error);
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

