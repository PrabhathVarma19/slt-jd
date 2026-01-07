import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
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
    let user: any = null;
    
    if (prisma) {
      user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          email: true,
          status: true,
        },
      });
    } else {
      // Use Supabase fallback
      const { data: userData } = await supabaseServer
        .from('User')
        .select('id, email, status')
        .eq('id', session.userId)
        .single();
      
      if (userData) {
        user = userData;
      }
    }

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

