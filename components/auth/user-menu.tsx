'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { LogOut, User, Shield } from 'lucide-react';

// Helper function to get initial user from localStorage synchronously
function getInitialUser() {
  if (typeof window === 'undefined') return null;
  try {
    const cached = window.localStorage.getItem('beacon:user');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.email) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('Failed to read cached user:', error);
  }
  return null;
}

export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  // Initialize state from localStorage synchronously - ensures user is available on first render
  const initialUser = getInitialUser();
  const [user, setUser] = useState<{ id?: string; email: string; name?: string; roles?: string[] } | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser); // Only show loading if no initial user
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const cachedUserRef = useRef<{ id?: string; email: string; name?: string; roles?: string[] } | null>(initialUser);
  const inconsistentResponseCountRef = useRef(0);

  // Fetch session function - shared across useEffects
  const fetchSession = async (forceLoading = false): Promise<boolean> => {
    // Don't fetch session on login page
    if (pathname === '/login') {
      setLoading(false);
      return false;
    }

    try {
      // Only show loading if we don't have cached user or if forced
      if ((!cachedUserRef.current && !user) || forceLoading) {
        setLoading(true);
      }

      const res = await fetch('/api/auth/session', {
        credentials: 'include',
        cache: 'no-store',
      });
      
      if (!res.ok) {
        if (res.status >= 500) {
          console.error('[USER_MENU] Session endpoint returned error:', res.status);
        }
        setUser(cachedUserRef.current);
        return false;
      }

      const data = (await res.json()) as {
        isAuthenticated?: boolean;
        authenticated?: boolean;
        user?: { id: string; email: string; name?: string; roles?: string[] };
        error?: string;
      };

      const isAuthenticated = data.isAuthenticated || data.authenticated;
      const hasValidUser = data.user?.email && data.user?.id;

      if (isAuthenticated && !hasValidUser) {
        inconsistentResponseCountRef.current += 1;
        console.error('[USER_MENU] Inconsistent session response detected:', {
          authenticated: isAuthenticated,
          hasUser: !!data.user,
          hasEmail: !!data.user?.email,
          hasId: !!data.user?.id,
          error: data.error,
          count: inconsistentResponseCountRef.current,
        });

        if (inconsistentResponseCountRef.current >= 3) {
          console.warn('[USER_MENU] Multiple inconsistent responses detected. Clearing session.');
          try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.localStorage.removeItem('beacon:user');
            cachedUserRef.current = null;
          } catch (error) {
            console.error('[USER_MENU] Failed to clear session:', error);
          }
          setUser(null);
          return false;
        }

        setUser(cachedUserRef.current);
        return false;
      }

      inconsistentResponseCountRef.current = 0;

      if (isAuthenticated && hasValidUser) {
        setUser(data.user || null);
        if (data.user) {
          try {
            window.localStorage.setItem('beacon:user', JSON.stringify(data.user));
            cachedUserRef.current = data.user;
          } catch (error) {
            console.warn('Failed to cache user:', error);
          }
        }
        return true;
      } else {
        if (!isAuthenticated) {
          setUser(null);
          cachedUserRef.current = null;
          try {
            window.localStorage.removeItem('beacon:user');
          } catch (error) {
            console.warn('Failed to clear cached user:', error);
          }
        }
        return false;
      }
    } catch (error: any) {
      console.error('[USER_MENU] Session fetch error:', error);
      setUser(cachedUserRef.current);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Set up login success event listener
  useEffect(() => {
    const handleLoginSuccess = (event: Event) => {
      inconsistentResponseCountRef.current = 0;
      
      const customEvent = event as CustomEvent;
      const userData = customEvent.detail?.user;
      
      if (userData && userData.email) {
        const userWithId = {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          roles: Array.isArray(userData.roles) ? userData.roles : [],
        };
        
        setUser(userWithId);
        cachedUserRef.current = userWithId;
        setLoading(false);
        
        try {
          window.localStorage.setItem('beacon:user', JSON.stringify(userWithId));
        } catch (error) {
          console.warn('Failed to cache user:', error);
        }
        
        // Verify session in background
        setTimeout(() => {
          fetchSession(false).catch(() => {});
        }, 500);
      } else {
        // Fallback: check localStorage
        const cached = window.localStorage.getItem('beacon:user');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed?.email) {
              setUser(parsed);
              cachedUserRef.current = parsed;
              setLoading(false);
            }
          } catch (error) {
            console.warn('Failed to parse cached user:', error);
          }
        }
        
        setTimeout(() => {
          fetchSession(true).catch(() => {});
        }, 300);
      }
    };

    window.addEventListener('beacon:login-success', handleLoginSuccess);
    
    return () => {
      window.removeEventListener('beacon:login-success', handleLoginSuccess);
    };
  }, []); // Only run once

  // Fetch session when pathname changes
  useEffect(() => {
    if (pathname === '/login') {
      setLoading(false);
      return;
    }

    // CRITICAL FIX: Check localStorage FIRST before calling fetchSession
    // This ensures Avatar shows immediately after login, even if event handler hasn't fired yet
    if (typeof window !== 'undefined' && !user && !cachedUserRef.current) {
      try {
        const cached = window.localStorage.getItem('beacon:user');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.email) {
            cachedUserRef.current = parsed;
            setUser(parsed);
            setLoading(false);
            // Verify session in background without blocking UI
            fetchSession(false).catch(() => {});
            return;
          }
        }
      } catch (error) {
        console.warn('Failed to read cached user in pathname effect:', error);
      }
    }

    // If we already have user, just verify session in background
    if (cachedUserRef.current || user) {
      fetchSession(false).catch(() => {});
    } else {
      // No user yet, fetch session normally
      fetchSession();
    }
  }, [pathname, user]); // Include user in deps to avoid unnecessary runs

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await new Promise((resolve) => setTimeout(resolve, 200));
      await fetch('/api/auth/logout', { method: 'POST' });
      try {
        window.localStorage.removeItem('beacon:user');
        cachedUserRef.current = null;
        inconsistentResponseCountRef.current = 0;
      } catch (error) {
        console.warn('Failed to clear cached user:', error);
      }
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  if (pathname === '/login') {
    return null;
  }

  if (loading || isLoggingOut) {
    return (
      <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200 hover:scale-105"
      >
        Sign In
      </a>
    );
  }

  const isAdmin = user.roles?.some((role) =>
    ['ADMIN_IT', 'ADMIN_TRAVEL', 'ADMIN_HR', 'SUPER_ADMIN'].includes(role)
  );

  const displayName = user.name || user.email.split('@')[0].replace(/\./g, ' ');

  return (
    <div className="transition-all duration-300 ease-in-out">
      <DropdownMenu
        trigger={
          <div className="transition-transform duration-200 hover:scale-110">
            <Avatar email={user.email} name={user.name} size="md" />
          </div>
        }
        align="right"
      >
        <div className="py-2">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="font-semibold text-gray-900">{displayName}</div>
            <div className="text-xs text-gray-500 mt-0.5">{user.email}</div>
            {isAdmin && (
              <div className="flex items-center gap-1 mt-1.5">
                <Shield className="h-3 w-3 text-purple-600" />
                <span className="text-xs text-purple-600 font-medium">Admin</span>
              </div>
            )}
          </div>
          <DropdownMenuItem>
            <Link href="/profile" className="flex items-center gap-2 w-full">
              <User className="h-4 w-4" />
              <span>Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-red-600 hover:bg-red-50"
          >
            <div className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </div>
          </DropdownMenuItem>
        </div>
      </DropdownMenu>
    </div>
  );
}
