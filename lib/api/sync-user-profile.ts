/**
 * Sync user profile from external API to database
 * Called on login and can be scheduled for nightly sync
 */

import { prisma } from '@/lib/prisma';
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
    let user: any = null;
    let userProfile: any = null;

    if (prisma) {
      // Use Prisma
      user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        include: { profile: true },
      });
      userProfile = user?.profile;
    } else {
      // Use Supabase
      const { data: userData } = await supabaseServer
        .from('User')
        .select('id, email')
        .eq('email', normalizedEmail)
        .single();

      if (userData) {
        user = userData;
        const { data: profileData } = await supabaseServer
          .from('UserProfile')
          .select('*')
          .eq('userId', userData.id)
          .single();
        userProfile = profileData;
      }
    }

    const profileData = transformProfileData(apiData, user?.id || '');

    // If user doesn't exist, create them
    if (!user) {
      // Create user with default EMPLOYEE role
      if (prisma) {
        // Create user
        user = await prisma.user.create({
          data: {
            email: normalizedEmail,
            status: 'ACTIVE',
            profile: {
              create: profileData,
            },
          },
        });

        // Assign EMPLOYEE role
        const employeeRole = await prisma.role.findUnique({
          where: { type: 'EMPLOYEE' },
        });

        if (employeeRole) {
          await prisma.userRole.create({
            data: {
              userId: user.id,
              roleId: employeeRole.id,
            },
          });
        }
      } else {
        // Use Supabase
        const { data: newUser } = await supabaseServer
          .from('User')
          .insert({
            email: normalizedEmail,
            status: 'ACTIVE',
          })
          .select('id')
          .single();

        if (newUser) {
          user = newUser;
          
          // Create profile
          await supabaseServer
            .from('UserProfile')
            .insert({
              ...profileData,
              userId: newUser.id,
            });

          // Assign EMPLOYEE role
          const { data: employeeRole } = await supabaseServer
            .from('Role')
            .select('id')
            .eq('type', 'EMPLOYEE')
            .single();

          if (employeeRole) {
            await supabaseServer
              .from('UserRole')
              .insert({
                userId: newUser.id,
                roleId: employeeRole.id,
              });
          }
        }
      }

      return {
        success: true,
        created: true,
        updated: false,
      };
    }

    // Update existing profile
    if (prisma) {
      if (userProfile) {
        await prisma.userProfile.update({
          where: { userId: user.id },
          data: profileData,
        });
      } else {
        await prisma.userProfile.create({
          data: profileData,
        });
      }
    } else {
      // Use Supabase
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

