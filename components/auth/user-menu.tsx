'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { LogOut, User, Shield } from 'lucide-react';

type UserData = {
  id: string;
  email: string;
  name?: string;
  roles?: string[];
};

// Get user from localStorage synchronously for immediate display
function getCachedUser(): UserData | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = window.localStorage.getItem('beacon:user');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.email && parsed?.id) {
        return parsed;
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

// Save user to localStorage
function saveUserToCache(user: UserData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('beacon:user', JSON.stringify(user));
  } catch {
    // Ignore errors
  }
}

// Clear user from localStorage
function clearUserCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('beacon:user');
  } catch {
    // Ignore errors
  }
}

export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  
  // Initialize from localStorage for immediate display
  const cachedUser = getCachedUser();
  const [user, setUser] = useState<UserData | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Fetch session from API and update state
  const fetchSession = async (showLoading = false): Promise<void> => {
    if (pathname === '/login') {
      setLoading(false);
      return;
    }

    try {
      if (showLoading) {
        setLoading(true);
      }

      const res = await fetch('/api/auth/session', {
        credentials: 'include',
        cache: 'no-store',
      });

      if (!res.ok) {
        // If we have cached user, keep it; otherwise clear
        if (!user) {
          setUser(null);
          clearUserCache();
        }
        return;
      }

      const data = await res.json() as {
        isAuthenticated?: boolean;
        authenticated?: boolean;
        user?: UserData;
      };

      const isAuthenticated = data.isAuthenticated || data.authenticated;
      
      if (isAuthenticated && data.user?.email && data.user?.id) {
        // Update state and cache
        setUser(data.user);
        saveUserToCache(data.user);
      } else {
        // Not authenticated - clear everything
        setUser(null);
        clearUserCache();
      }
    } catch (error) {
      console.error('[USER_MENU] Session fetch error:', error);
      // On error, keep cached user if it exists
      if (!user) {
        setUser(null);
        clearUserCache();
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial load: fetch session on mount
  useEffect(() => {
    fetchSession();
  }, []); // Only run once on mount

  // Listen for login success event
  useEffect(() => {
    const handleLoginSuccess = (event: Event) => {
      const customEvent = event as CustomEvent;
      const userData = customEvent.detail?.user as UserData | undefined;
      
      if (userData?.email && userData?.id) {
        // Update immediately from event data
        setUser(userData);
        saveUserToCache(userData);
        setLoading(false);
        
        // Verify session in background after a short delay
        setTimeout(() => {
          fetchSession(false);
        }, 300);
      } else {
        // Fallback: check localStorage
        const cached = getCachedUser();
        if (cached) {
          setUser(cached);
          setLoading(false);
        }
        // Fetch session to verify
        setTimeout(() => {
          fetchSession(true);
        }, 300);
      }
    };

    window.addEventListener('beacon:login-success', handleLoginSuccess);
    return () => {
      window.removeEventListener('beacon:login-success', handleLoginSuccess);
    };
  }, []); // Only run once

  // Silent background check on pathname change (only if we have user)
  useEffect(() => {
    if (pathname === '/login') {
      setLoading(false);
      return;
    }

    // If we have a user, verify silently in background
    // If we don't have a user, fetch normally
    if (user) {
      fetchSession(false);
    } else {
      // Check localStorage first before fetching
      const cached = getCachedUser();
      if (cached) {
        setUser(cached);
        setLoading(false);
        // Verify in background
        fetchSession(false);
      } else {
        fetchSession(true);
      }
    }
  }, [pathname]); // Re-run when pathname changes

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      clearUserCache();
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  // Hide on login page
  if (pathname === '/login') {
    return null;
  }

  // Show loading spinner
  if (loading || isLoggingOut) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
        <Spinner className="h-4 w-4" />
      </div>
    );
  }

  // Show sign in button if no user
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
          <div className="transition-transform duration-200 hover:scale-110 cursor-pointer">
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
              {isLoggingOut ? (
                <>
                  <Spinner className="h-4 w-4" />
                  <span>Signing out...</span>
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </>
              )}
            </div>
          </DropdownMenuItem>
        </div>
      </DropdownMenu>
    </div>
  );
}
