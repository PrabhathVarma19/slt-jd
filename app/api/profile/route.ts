import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * GET /api/profile
 * Get current user's profile data
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      // Check if this is a test email - test emails should not have synced profile data
      const normalizedEmail = session.email?.toLowerCase().trim();
      const testEmails = ['user@trianz.com', 'test@trianz.com', 'admin@trianz.com'];
      const isTestEmail = normalizedEmail && testEmails.includes(normalizedEmail);

      // Use Supabase
      const { data: userData, error: userError } = await supabaseServer
        .from('User')
        .select(`
          id,
          email,
          status,
          profile:UserProfile (
            employeeId,
            empName,
            gradeCode,
            location,
            projectCode,
            projectName,
            orgGroup,
            pmEmail,
            dmEmail,
            supervisorEmail,
            lastSyncedAt
          )
        `)
        .eq('id', session.userId)
        .single();

      if (userError || !userData) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Fetch roles
      const { data: userRoles } = await supabaseServer
        .from('UserRole')
        .select(`
          role:Role!inner(type)
        `)
        .eq('userId', session.userId)
        .is('revokedAt', null);

      const roles = (userRoles || [])
        .map((ur: any) => ur.role?.type)
        .filter((type: string | undefined) => type !== undefined);

      // For test emails, return null profile (they shouldn't have synced data)
      const profile = isTestEmail ? null : (Array.isArray(userData.profile) ? userData.profile[0] : userData.profile);

      return NextResponse.json({
        user: {
          id: userData.id,
          email: userData.email,
          status: userData.status,
          profile,
          roles,
        },
      });
    } catch (dbError: any) {
      console.error('Database error fetching profile:', dbError);
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}


