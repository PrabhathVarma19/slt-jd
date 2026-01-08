/**
 * Sync user profile from external API to database
 * Called on login and can be scheduled for nightly sync
 */

import { supabaseServer } from '@/lib/supabase/server';
import { fetchAllUserProfiles, transformProfileData, UserProfileApiResponse } from './user-profile';

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
    // Skip profile sync for test/fake emails
    const normalizedEmail = email.toLowerCase().trim();
    const testEmails = ['user@trianz.com', 'test@trianz.com', 'admin@trianz.com'];
    
    if (testEmails.includes(normalizedEmail)) {
      console.log(`Skipping profile sync for test email: ${normalizedEmail}`);
      return {
        success: true,
        created: false,
        updated: false,
        error: 'Test email - profile sync skipped',
      };
    }

    // Fetch ALL profiles from external API (user can have multiple projects)
    const allApiData = await fetchAllUserProfiles({ email });
    
    if (!allApiData || allApiData.length === 0) {
      return {
        success: false,
        created: false,
        updated: false,
        error: 'Profile not found in external API',
      };
    }

    // Use the first record as primary (for backward compatibility)
    const primaryApiData = allApiData[0];
    
    // Double-check email matches (API might return wrong user)
    if (primaryApiData.Email?.toLowerCase() !== normalizedEmail) {
      console.warn(`Email mismatch: requested ${normalizedEmail}, API returned ${primaryApiData.Email}`);
      return {
        success: false,
        created: false,
        updated: false,
        error: 'Email mismatch - API returned different user',
      };
    }


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

    // Transform primary profile data (for backward compatibility)
    const profileData = transformProfileData(primaryApiData, user?.id || '');
    
    // Store ALL projects in rawPayloadJson for multiple project support
    profileData.rawPayloadJson = allApiData.length > 1 ? allApiData : primaryApiData;

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

