import { supabaseServer } from '@/lib/supabase/server';
import { syncUserProfile } from '@/lib/api/sync-user-profile';

export interface ResolvedLoginUser {
  id: string;
  email: string;
  status: string;
  roles: string[];
}

async function fetchUserByEmail(normalizedEmail: string): Promise<ResolvedLoginUser | null> {
  const { data: userData, error: userError } = await supabaseServer
    .from('User')
    .select('id, email, status')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!userData) return null;

  const { data: userRoles, error: rolesError } = await supabaseServer
    .from('UserRole')
    .select(`
      roleId,
      role:Role!inner(type)
    `)
    .eq('userId', userData.id)
    .is('revokedAt', null);

  if (rolesError) {
    throw new Error(rolesError.message);
  }

  const roles = Array.isArray(userRoles)
    ? userRoles
        .map((ur: any) => ur.role?.type)
        .filter((type: string | undefined) => type !== undefined)
    : [];

  return {
    id: userData.id,
    email: userData.email,
    status: userData.status,
    roles,
  };
}

export async function resolveLoginUser(
  email: string
): Promise<{ user: ResolvedLoginUser; newlyCreated: boolean }> {
  const normalizedEmail = email.toLowerCase().trim();

  let user = await fetchUserByEmail(normalizedEmail);
  let newlyCreated = false;

  if (!user) {
    const syncResult = await syncUserProfile(normalizedEmail);
    if (!syncResult.success || !syncResult.created) {
      throw new Error('Account not found. Please contact IT support to create your account.');
    }

    user = await fetchUserByEmail(normalizedEmail);
    newlyCreated = true;
  }

  if (!user) {
    throw new Error('Account not found. Please contact IT support.');
  }

  if (user.status !== 'ACTIVE') {
    throw new Error('Account is not active. Please contact support.');
  }

  return { user, newlyCreated };
}
