import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * GET /api/admin/users/[id]
 * Get single user with full details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireSessionRole(['SUPER_ADMIN', 'ADMIN_HR']);

    const userId = params.id;

    try {
      if (prisma) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            profile: true,
            roles: {
              include: {
                role: true,
              },
              orderBy: {
                grantedAt: 'desc',
              },
            },
          },
        });

        if (!user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
          user: {
            ...user,
            roles: user.roles.map((ur: any) => ({
              id: ur.role.id,
              type: ur.role.type,
              name: ur.role.name,
              grantedAt: ur.grantedAt,
              grantedBy: ur.grantedBy,
              revokedAt: ur.revokedAt,
              revokedBy: ur.revokedBy,
            })),
          },
        });
      } else {
        // Use Supabase
        const { data: user, error } = await supabaseServer
          .from('User')
          .select(`
            *,
            profile:UserProfile (*),
            roles:UserRole!UserRole_userId_fkey (
              *,
              role:Role!UserRole_roleId_fkey (
                id,
                type,
                name
              )
            )
          `)
          .eq('id', userId)
          .single();

        if (error || !user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ user });
      }
    } catch (dbError: any) {
      console.error('Database error fetching user:', dbError);
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Update user (status, roles)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireSessionRole(['SUPER_ADMIN', 'ADMIN_HR']);

    const userId = params.id;
    const body = await req.json();
    const { status, roles } = body; // roles: array of role types to assign

    try {
      if (prisma) {
        const updates: any = {};

        if (status) {
          updates.status = status;
        }

        // Update user status if provided
        if (Object.keys(updates).length > 0) {
          await prisma.user.update({
            where: { id: userId },
            data: updates,
          });
        }

        // Handle role assignments if provided
        if (roles && Array.isArray(roles)) {
          // Get all role IDs
          const roleRecords = await prisma.role.findMany({
            where: {
              type: { in: roles },
            },
          });

          const roleIds = roleRecords.map((r: any) => r.id);

          // Get current active roles
          const currentRoles = await prisma.userRole.findMany({
            where: {
              userId,
              revokedAt: null,
            },
          });

          const currentRoleIds = currentRoles.map((ur: any) => ur.roleId);

          // Revoke roles not in the new list
          const rolesToRevoke = currentRoleIds.filter((rid: string) => !roleIds.includes(rid));
          if (rolesToRevoke.length > 0) {
            await prisma.userRole.updateMany({
              where: {
                userId,
                roleId: { in: rolesToRevoke },
                revokedAt: null,
              },
              data: {
                revokedAt: new Date(),
                revokedBy: auth.userId,
              },
            });
          }

          // Grant new roles
          const rolesToGrant = roleIds.filter((rid: string) => !currentRoleIds.includes(rid));
          for (const roleId of rolesToGrant) {
            await prisma.userRole.upsert({
              where: {
                userId_roleId: {
                  userId,
                  roleId,
                },
              },
              update: {
                revokedAt: null,
                revokedBy: null,
                grantedAt: new Date(),
                grantedBy: auth.userId,
              },
              create: {
                userId,
                roleId,
                grantedBy: auth.userId,
              },
            });
          }
        }

        // Fetch updated user
        const updatedUser = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            profile: true,
            roles: {
              where: {
                revokedAt: null,
              },
              include: {
                role: true,
              },
            },
          },
        });

        return NextResponse.json({ user: updatedUser });
      } else {
        // Use Supabase
        const updates: any = {};
        if (status) {
          updates.status = status;
        }

        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await supabaseServer
            .from('User')
            .update(updates)
            .eq('id', userId);

          if (updateError) {
            throw new Error(updateError.message);
          }
        }

        // Handle role assignments
        if (roles && Array.isArray(roles)) {
          // Get role IDs
          const { data: roleRecords } = await supabaseServer
            .from('Role')
            .select('id')
            .in('type', roles);

          if (!roleRecords) {
            throw new Error('Failed to fetch roles');
          }

          const roleIds = roleRecords.map((r: any) => r.id);

          // Get current active roles
          const { data: currentRoles } = await supabaseServer
            .from('UserRole')
            .select('roleId')
            .eq('userId', userId)
            .is('revokedAt', null);

          const currentRoleIds = (currentRoles || []).map((ur: any) => ur.roleId);

          // Revoke roles not in new list
          const rolesToRevoke = currentRoleIds.filter((rid: string) => !roleIds.includes(rid));
          if (rolesToRevoke.length > 0) {
            await supabaseServer
              .from('UserRole')
              .update({
                revokedAt: new Date().toISOString(),
                revokedBy: auth.userId,
              })
              .eq('userId', userId)
              .in('roleId', rolesToRevoke)
              .is('revokedAt', null);
          }

          // Grant new roles
          const rolesToGrant = roleIds.filter((rid: string) => !currentRoleIds.includes(rid));
          for (const roleId of rolesToGrant) {
            // Check if role assignment exists
            const { data: existing } = await supabaseServer
              .from('UserRole')
              .select('id')
              .eq('userId', userId)
              .eq('roleId', roleId)
              .single();

            if (existing) {
              // Update existing
              await supabaseServer
                .from('UserRole')
                .update({
                  revokedAt: null,
                  revokedBy: null,
                  grantedAt: new Date().toISOString(),
                  grantedBy: auth.userId,
                })
                .eq('id', existing.id);
            } else {
              // Create new
              await supabaseServer.from('UserRole').insert({
                userId,
                roleId,
                grantedBy: auth.userId,
              });
            }
          }
        }

        // Fetch updated user
        const { data: updatedUser } = await supabaseServer
          .from('User')
          .select(`
            *,
            profile:UserProfile (*),
            roles:UserRole!UserRole_userId_fkey (
              *,
              role:Role!UserRole_roleId_fkey (
                id,
                type,
                name
              )
            )
          `)
          .eq('id', userId)
          .is('roles.revokedAt', null)
          .single();

        return NextResponse.json({ user: updatedUser });
      }
    } catch (dbError: any) {
      console.error('Database error updating user:', dbError);
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}

