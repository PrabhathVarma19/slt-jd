/**
 * Authentication and Authorization Middleware Helpers
 * For use in API routes and server components
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from './session';
import { requireSessionRole, RoleType } from './rbac';

/**
 * Require authentication middleware
 * Returns session data if authenticated, throws error if not
 */
export async function requireAuth(): Promise<{
  userId: string;
  email: string;
  roles: string[];
}> {
  const session = await getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  return {
    userId: session.userId,
    email: session.email,
    roles: session.roles || [],
  };
}

/**
 * Require specific role(s) middleware
 * Returns session data if authorized, throws error if not
 */
export async function requireRole(
  roles: RoleType[]
): Promise<{
  userId: string;
  email: string;
  roles: string[];
}> {
  return requireSessionRole(roles);
}

/**
 * API route wrapper for authenticated endpoints
 */
export function withAuth<T = any>(
  handler: (req: NextRequest, auth: { userId: string; email: string; roles: string[] }) => Promise<NextResponse<T>>
) {
  return async (req: NextRequest) => {
    try {
      const auth = await requireAuth();
      return handler(req, auth);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Unauthorized' },
        { status: 401 }
      );
    }
  };
}

/**
 * API route wrapper for role-protected endpoints
 */
export function withRole<T = any>(
  roles: RoleType[],
  handler: (req: NextRequest, auth: { userId: string; email: string; roles: string[] }) => Promise<NextResponse<T>>
) {
  return async (req: NextRequest) => {
    try {
      const auth = await requireRole(roles);
      return handler(req, auth);
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Forbidden' },
        { status: 403 }
      );
    }
  };
}

