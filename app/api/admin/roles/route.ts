import { NextRequest, NextResponse } from 'next/server';
import { requireSessionRole } from '@/lib/auth/rbac';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * GET /api/admin/roles
 * List all available roles
 * Requires: SUPER_ADMIN or ADMIN_HR
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireSessionRole(['SUPER_ADMIN', 'ADMIN_HR']);

    try {
      // Use Supabase
      const { data: roles, error } = await supabaseServer
        .from('Role')
        .select('*')
        .order('type', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({ roles: roles || [] });
    } catch (dbError: any) {
      console.error('Database error fetching roles:', dbError);
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error fetching roles:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch roles' },
      { status: error.message?.includes('Access denied') ? 403 : 500 }
    );
  }
}

