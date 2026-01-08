import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * GET /api/admin/users
 * List users with their roles and profiles
 * Requires: SUPER_ADMIN or ADMIN_HR
 */
export async function GET(req: NextRequest) {
  try {
    // Only SUPER_ADMIN and ADMIN_HR can manage users
    const auth = await requireSessionRole(['SUPER_ADMIN', 'ADMIN_HR']);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search'); // Search by email or name
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    try {
      // Use Supabase
      let query = supabaseServer
          .from('User')
          .select(`
            *,
            profile:UserProfile (*),
            roles:UserRole!UserRole_userId_fkey (
              id,
              grantedAt,
              grantedBy,
              role:Role!UserRole_roleId_fkey (
                id,
                type,
                name
              )
            )
          `, { count: 'exact' })
          .is('roles.revokedAt', null);

        if (status) {
          query = query.eq('status', status);
        }
        if (search) {
          query = query.or(`email.ilike.%${search}%,profile.empName.ilike.%${search}%`);
        }

        const { data: users, error, count } = await query
          .order('email', { ascending: true })
          .range(offset, offset + limit - 1);

        if (error) {
          throw new Error(error.message);
        }

        return NextResponse.json({
          users: (users || []).map((user: any) => ({
            id: user.id,
            email: user.email,
            status: user.status,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            profile: user.profile,
            roles: ((user.roles || []) as any[])
              .filter((ur: any) => !ur.revokedAt)
              .map((ur: any) => ({
                id: ur.role?.id,
                type: ur.role?.type,
                name: ur.role?.name,
                grantedAt: ur.grantedAt,
                grantedBy: ur.grantedBy,
              })),
          })) || [],
        total: count || 0,
        limit,
        offset,
      });
    } catch (dbError: any) {
      console.error('Database error fetching users:', dbError);
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch users' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}

