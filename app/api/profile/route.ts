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
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/profile/route.ts:11',message:'Profile API called',data:{userId:session.userId,email:session.email},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Check if this is a test email - test emails should not have synced profile data
      const normalizedEmail = session.email?.toLowerCase().trim();
      const testEmails = ['user@trianz.com', 'test@trianz.com', 'admin@trianz.com'];
      const isTestEmail = normalizedEmail && testEmails.includes(normalizedEmail);

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/profile/route.ts:25',message:'Test email check',data:{normalizedEmail,isTestEmail},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

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

      // #region agent log
      const rawProfile = Array.isArray(userData.profile) ? userData.profile[0] : userData.profile;
      fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/profile/route.ts:60',message:'Raw profile data from DB',data:{hasProfile:!!rawProfile,employeeId:rawProfile?.employeeId,empName:rawProfile?.empName,lastSyncedAt:rawProfile?.lastSyncedAt},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

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

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/7f74fb16-5e81-4704-9c2c-1a3dd73f3bf3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/profile/route.ts:75',message:'Returning profile response',data:{isTestEmail,profileReturned:!!profile,profileEmployeeId:profile?.employeeId},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

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


