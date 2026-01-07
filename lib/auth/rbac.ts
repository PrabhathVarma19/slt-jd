/**
 * RBAC (Role-Based Access Control) Helper Functions
 * Utilities for checking user roles and enforcing access control
 */

import { getSession } from './session';
import { prisma } from '@/lib/prisma';
import { supabaseServer } from '@/lib/supabase/server';

export type RoleType =
  | 'EMPLOYEE'
  | 'ENGINEER_IT'
  | 'ENGINEER_TRAVEL'
  | 'ADMIN_IT'
  | 'ADMIN_TRAVEL'
  | 'ADMIN_HR'
  | 'SUPER_ADMIN';

/**
 * Get all roles for a user
 */
export async function getUserRoles(userId: string): Promise<RoleType[]> {
  try {
    if (prisma) {
      const userRoles = await prisma.userRole.findMany({
        where: {
          userId,
          revokedAt: null, // Only active roles
        },
        include: {
          role: true,
        },
      });

      return userRoles.map((ur: any) => ur.role.type as RoleType);
    } else {
      // Use Supabase
      const { data: userRoles } = await supabaseServer
        .from('UserRole')
        .select(`
          role:Role!inner(type)
        `)
        .eq('userId', userId)
        .is('revokedAt', null);

      if (!userRoles || !Array.isArray(userRoles)) {
        return [];
      }

      return userRoles
        .map((ur: any) => ur.role?.type)
        .filter((type: string | undefined) => type !== undefined) as RoleType[];
    }
  } catch (error) {
    console.error('Error getting user roles:', error);
    return [];
  }
}

/**
 * Check if a user has a specific role
 */
export async function checkUserRole(
  userId: string,
  role: RoleType
): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes(role);
}

/**
 * Check if a user has any of the specified roles
 */
export async function checkUserRoles(
  userId: string,
  roles: RoleType[]
): Promise<boolean> {
  const userRoles = await getUserRoles(userId);
  return roles.some((role) => userRoles.includes(role));
}

/**
 * Check if a user has all of the specified roles
 */
export async function checkUserHasAllRoles(
  userId: string,
  roles: RoleType[]
): Promise<boolean> {
  const userRoles = await getUserRoles(userId);
  return roles.every((role) => userRoles.includes(role));
}

/**
 * Check if user is admin (any admin role)
 */
export async function isAdmin(userId: string): Promise<boolean> {
  return checkUserRoles(userId, [
    'ADMIN_IT',
    'ADMIN_TRAVEL',
    'ADMIN_HR',
    'SUPER_ADMIN',
  ]);
}

/**
 * Check if user is super admin
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  return checkUserRole(userId, 'SUPER_ADMIN');
}

/**
 * Check if user can access IT admin features
 */
export async function canAccessITAdmin(userId: string): Promise<boolean> {
  return checkUserRoles(userId, ['ADMIN_IT', 'SUPER_ADMIN']);
}

/**
 * Check if user can access Travel admin features
 */
export async function canAccessTravelAdmin(userId: string): Promise<boolean> {
  return checkUserRoles(userId, ['ADMIN_TRAVEL', 'SUPER_ADMIN']);
}

/**
 * Check if user can access HR admin features
 */
export async function canAccessHRAdmin(userId: string): Promise<boolean> {
  return checkUserRoles(userId, ['ADMIN_HR', 'SUPER_ADMIN']);
}

/**
 * Check if user is an engineer (IT or Travel)
 */
export async function isEngineer(userId: string): Promise<boolean> {
  return checkUserRoles(userId, ['ENGINEER_IT', 'ENGINEER_TRAVEL']);
}

/**
 * Get roles from current session
 */
export async function getSessionRoles(): Promise<RoleType[]> {
  const session = await getSession();
  if (!session) {
    return [];
  }
  return (session.roles || []) as RoleType[];
}

/**
 * Check if current session has a specific role
 */
export async function checkSessionRole(role: RoleType): Promise<boolean> {
  const roles = await getSessionRoles();
  return roles.includes(role);
}

/**
 * Check if current session has any of the specified roles
 */
export async function checkSessionRoles(roles: RoleType[]): Promise<boolean> {
  const sessionRoles = await getSessionRoles();
  return roles.some((role) => sessionRoles.includes(role));
}

/**
 * Require role middleware helper
 * Returns user info if authorized, throws error if not
 */
export async function requireRole(
  userId: string,
  requiredRoles: RoleType[]
): Promise<{ userId: string; roles: RoleType[] }> {
  const userRoles = await getUserRoles(userId);

  const hasRequiredRole = requiredRoles.some((role) =>
    userRoles.includes(role)
  );

  if (!hasRequiredRole) {
    throw new Error(
      `Access denied. Required roles: ${requiredRoles.join(', ')}`
    );
  }

  return {
    userId,
    roles: userRoles,
  };
}

/**
 * Require role from session
 */
export async function requireSessionRole(
  requiredRoles: RoleType[]
): Promise<{ userId: string; email: string; roles: RoleType[] }> {
  const session = await getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const sessionRoles = (session.roles || []) as RoleType[];
  const hasRequiredRole = requiredRoles.some((role) =>
    sessionRoles.includes(role)
  );

  if (!hasRequiredRole) {
    throw new Error(
      `Access denied. Required roles: ${requiredRoles.join(', ')}`
    );
  }

  return {
    userId: session.userId,
    email: session.email,
    roles: sessionRoles,
  };
}

