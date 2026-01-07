import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
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

    // Determine which engineer role to fetch
    let engineerRole: 'ENGINEER_IT' | 'ENGINEER_TRAVEL' | null = null;
    if (domain === 'IT' || auth.roles.includes('ADMIN_IT') || auth.roles.includes('SUPER_ADMIN')) {
      engineerRole = 'ENGINEER_IT';
    } else if (domain === 'TRAVEL' || auth.roles.includes('ADMIN_TRAVEL')) {
      engineerRole = 'ENGINEER_TRAVEL';
    }

    try {
      if (prisma) {
        const engineers = await prisma.user.findMany({
          where: {
            status: 'ACTIVE',
            roles: {
              some: {
                role: {
                  type: engineerRole || { in: ['ENGINEER_IT', 'ENGINEER_TRAVEL'] },
                },
                revokedAt: null,
              },
            },
          },
          include: {
            profile: {
              select: {
                empName: true,
                employeeId: true,
              },
            },
          },
          orderBy: {
            email: 'asc',
          },
        });

        return NextResponse.json({ engineers });
      } else {
        // Use Supabase
        const roleFilter = engineerRole
          ? { type: engineerRole }
          : { type: { in: ['ENGINEER_IT', 'ENGINEER_TRAVEL'] } };

        const { data: roles } = await supabaseServer
          .from('Role')
          .select('id')
          .eq('type', engineerRole || 'ENGINEER_IT'); // Fallback

        if (!roles || roles.length === 0) {
          return NextResponse.json({ engineers: [] });
        }

        const roleIds = roles.map((r: any) => r.id);

        const { data: userRoles } = await supabaseServer
          .from('UserRole')
          .select('userId')
          .in('roleId', roleIds)
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
      }
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

