import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
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
      if (prisma) {
        const user = await prisma.user.findUnique({
          where: { id: session.userId },
          select: {
            id: true,
            email: true,
            status: true,
            profile: {
              select: {
                employeeId: true,
                empName: true,
                gradeCode: true,
                location: true,
                projectCode: true,
                projectName: true,
                orgGroup: true,
                pmEmail: true,
                dmEmail: true,
                supervisorEmail: true,
                lastSyncedAt: true,
              },
            },
            roles: {
              where: {
                revokedAt: null,
              },
              include: {
                role: {
                  select: {
                    type: true,
                  },
                },
              },
            },
          },
        });

        if (!user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
          user: {
            id: user.id,
            email: user.email,
            status: user.status,
            profile: user.profile,
            roles: user.roles.map((ur: any) => ur.role.type),
          },
        });
      } else {
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

        return NextResponse.json({
          user: {
            id: userData.id,
            email: userData.email,
            status: userData.status,
            profile: Array.isArray(userData.profile) ? userData.profile[0] : userData.profile,
            roles,
          },
        });
      }
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


