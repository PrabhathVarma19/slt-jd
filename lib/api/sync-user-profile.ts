/**
 * Sync user profile from external API to database
 * Called on login and can be scheduled for nightly sync
 */

import { supabaseServer } from '@/lib/supabase/server';
import { fetchUserProfile, transformProfileData, UserProfileApiResponse } from './user-profile';

export interface SyncResult {
  success: boolean;
  created: boolean;
  updated: boolean;
  error?: string;
}

/**
 * Sync user profile for a given email
 */
export async function syncUserProfile(email: string): Promise<SyncResult> {
  try {
    // Fetch from external API
    const apiData = await fetchUserProfile({ email });
    
    if (!apiData) {
      return {
        success: false,
        created: false,
        updated: false,
        error: 'Profile not found in external API',
      };
    }

    // Normalize email
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const { data: userData } = await supabaseServer
      .from('User')
      .select('id, email')
      .eq('email', normalizedEmail)
      .single();

    let user: any = userData || null;
    let userProfile: any = null;

    if (userData) {
      const { data: profileData } = await supabaseServer
        .from('UserProfile')
        .select('*')
        .eq('userId', userData.id)
        .single();
      userProfile = profileData;
    }

    const profileData = transformProfileData(apiData, user?.id || '');

    // If user doesn't exist, create them
    if (!user) {
      // Create user with default EMPLOYEE role and default password
      // Default password: test123 (for non-prod) - users should change on first login
      const { hashPassword } = await import('@/lib/auth/password');
      const defaultPassword = process.env.DEFAULT_USER_PASSWORD || 'test123';
      const passwordHash = await hashPassword(defaultPassword);

      // Use Supabase
      const { data: newUser, error: userError } = await supabaseServer
        .from('User')
        .insert({
          email: normalizedEmail,
          passwordHash,
          status: 'ACTIVE',
        })
        .select('id')
        .single();

      if (userError || !newUser) {
        console.error('Error creating user:', userError);
        return {
          success: false,
          created: false,
          updated: false,
          error: userError?.message || 'Failed to create user',
        };
      }

      user = newUser;
      
      // Create profile
      const { error: profileError } = await supabaseServer
        .from('UserProfile')
        .insert({
          ...profileData,
          userId: newUser.id,
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
      }

      // Assign EMPLOYEE role
      const { data: employeeRole } = await supabaseServer
        .from('Role')
        .select('id')
        .eq('type', 'EMPLOYEE')
        .single();

      if (employeeRole) {
        const { error: roleError } = await supabaseServer
          .from('UserRole')
          .insert({
            userId: newUser.id,
            roleId: employeeRole.id,
          });

        if (roleError) {
          console.error('Error assigning role:', roleError);
        }
      }

      return {
        success: true,
        created: true,
        updated: false,
      };
    }

    // Update existing profile
    if (userProfile) {
      await supabaseServer
        .from('UserProfile')
        .update(profileData)
        .eq('userId', user.id);
    } else {
      await supabaseServer
        .from('UserProfile')
        .insert({
          ...profileData,
          userId: user.id,
        });
    }

    return {
      success: true,
      created: false,
      updated: true,
    };
  } catch (error: any) {
    console.error('Error syncing user profile:', error);
    return {
      success: false,
      created: false,
      updated: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Sync all users from API (for nightly sync)
 * This would be called by a scheduled job
 */
export async function syncAllUsers(): Promise<{
  synced: number;
  errors: number;
}> {
  // This would require an API endpoint that returns all users
  // For now, this is a placeholder
  // TODO: Implement when API supports listing all users
  
  return {
    synced: 0,
    errors: 0,
  };
}

