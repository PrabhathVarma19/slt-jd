import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * GET /api/admin/engineers
 * List engineers (for assignment dropdown)
 * Requires: ADMIN_IT, ADMIN_TRAVEL, or SUPER_ADMIN
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireSessionRole(['ADMIN_IT', 'ADMIN_TRAVEL', 'SUPER_ADMIN']);

    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain'); // 'IT' or 'TRAVEL'

    // Only IT engineers exist (no travel engineers)
    const engineerRole = 'ENGINEER_IT';

    try {
      // Use Supabase - only IT engineers
      const { data: role } = await supabaseServer
        .from('Role')
        .select('id')
        .eq('type', 'ENGINEER_IT')
        .single();

      if (!role) {
        return NextResponse.json({ engineers: [] });
      }

      const { data: userRoles } = await supabaseServer
        .from('UserRole')
        .select('userId')
        .eq('roleId', role.id)
        .is('revokedAt', null);

      if (!userRoles || userRoles.length === 0) {
        return NextResponse.json({ engineers: [] });
      }

      const userIds = [...new Set(userRoles.map((ur: any) => ur.userId))];

      const { data: engineers } = await supabaseServer
        .from('User')
        .select(`
          id,
          email,
          status,
          profile:UserProfile (
            empName,
            employeeId
          )
        `)
        .in('id', userIds)
        .eq('status', 'ACTIVE')
        .order('email', { ascending: true });

      return NextResponse.json({
        engineers: engineers?.map((e: any) => ({
          id: e.id,
          email: e.email,
          profile: e.profile,
        })) || [],
      });
    } catch (dbError: any) {
      console.error('Database error fetching engineers:', dbError);
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error fetching engineers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch engineers' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}

