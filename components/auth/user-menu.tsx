'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { LogOut, User, Shield } from 'lucide-react';

export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ email: string; name?: string; roles?: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isRetryingRef = useRef(false);
  const cachedUserRef = useRef<{ email: string; name?: string; roles?: string[] } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = window.localStorage.getItem('beacon:user');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.email) {
            cachedUserRef.current = parsed;
            setUser(parsed);
            setLoading(false);
          }
        }
      } catch (error) {
        console.warn('Failed to read cached user:', error);
      }
    }

    // Don't fetch session on login page
    if (pathname === '/login') {
      setLoading(false);
      return;
    }

    const fetchSession = async (): Promise<boolean> => {
      try {
        if (!cachedUserRef.current) {
          setLoading(true);
        }
        const res = await fetch('/api/auth/session', {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = (await res.json()) as {
          isAuthenticated?: boolean;
          authenticated?: boolean;
          user?: { email: string; name?: string; roles?: string[] };
        };

        if ((data.isAuthenticated || data.authenticated) && data.user?.email) {
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
          setUser(cachedUserRef.current);
          return false;
        }
      } catch (error: any) {
        // 401 is expected for unauthenticated users
        if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
          setUser(cachedUserRef.current);
          return false;
        } else {
          console.error('Session fetch error:', error);
          setUser(cachedUserRef.current);
          return false;
        }
      } finally {
        setLoading(false);
      }
    };

    const retrySession = async () => {
      if (isRetryingRef.current) return;
      isRetryingRef.current = true;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        const authenticated = await fetchSession();
        if (authenticated) {
          break;
        }
      }
      isRetryingRef.current = false;
    };

    fetchSession();
    retrySession();

    // Listen for custom event when login succeeds (dispatched from login page)
    const handleLoginSuccess = () => {
      // Small delay to ensure session cookie is set
      setTimeout(() => {
        setLoading(true);
        fetchSession();
        retrySession();
      }, 200);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchSession();
      }
    };

    const handleFocus = () => {
      fetchSession();
    };

    window.addEventListener('beacon:login-success', handleLoginSuccess);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beacon:login-success', handleLoginSuccess);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [pathname]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      // Add fade-out animation
      await new Promise((resolve) => setTimeout(resolve, 200));
      await fetch('/api/auth/logout', { method: 'POST' });
      try {
        window.localStorage.removeItem('beacon:user');
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

  // Hide user menu on login page
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

  // Get user name from email or use email
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
