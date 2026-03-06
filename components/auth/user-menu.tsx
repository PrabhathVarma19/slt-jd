'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

function saveUserToCache(user: UserData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('beacon:user', JSON.stringify(user));
  } catch {
    // Ignore errors
  }
}

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

  const cachedUser = getCachedUser();
  const [user, setUser] = useState<UserData | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const userRef = useRef<UserData | null>(cachedUser);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const fetchSession = useCallback(
    async (showLoading = false): Promise<void> => {
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
          if (!userRef.current) {
            setUser(null);
            clearUserCache();
          }
          return;
        }

        const data = (await res.json()) as {
          isAuthenticated?: boolean;
          authenticated?: boolean;
          user?: UserData;
        };

        const isAuthenticated = data.isAuthenticated || data.authenticated;

        if (isAuthenticated && data.user?.email && data.user?.id) {
          setUser(data.user);
          saveUserToCache(data.user);
        } else {
          setUser(null);
          clearUserCache();
        }
      } catch (error) {
        console.error('[USER_MENU] Session fetch error:', error);
        if (!userRef.current) {
          setUser(null);
          clearUserCache();
        }
      } finally {
        setLoading(false);
      }
    },
    [pathname]
  );

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const handleLoginSuccess = (event: Event) => {
      const customEvent = event as CustomEvent;
      const userData = customEvent.detail?.user as UserData | undefined;

      if (userData?.email && userData?.id) {
        setUser(userData);
        saveUserToCache(userData);
        setLoading(false);

        setTimeout(() => {
          fetchSession(false);
        }, 300);
      } else {
        const cached = getCachedUser();
        if (cached) {
          setUser(cached);
          setLoading(false);
        }

        setTimeout(() => {
          fetchSession(true);
        }, 300);
      }
    };

    window.addEventListener('beacon:login-success', handleLoginSuccess);
    return () => {
      window.removeEventListener('beacon:login-success', handleLoginSuccess);
    };
  }, [fetchSession]);

  useEffect(() => {
    if (pathname === '/login') {
      setLoading(false);
      return;
    }

    if (user) {
      fetchSession(false);
      return;
    }

    const cached = getCachedUser();
    if (cached) {
      setUser(cached);
      setLoading(false);
      fetchSession(false);
    } else {
      fetchSession(true);
    }
  }, [pathname, user, fetchSession]);

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

  if (pathname === '/login') {
    return null;
  }

  if (loading) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
        <Spinner className="h-4 w-4" />
      </div>
    );
  }

  const logoutOverlay =
    isLoggingOut && portalReady
      ? createPortal(
          <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/40">
            <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm text-gray-700 shadow-lg">
              <Spinner className="h-4 w-4" />
              Signing out...
            </div>
          </div>,
          document.body
        )
      : null;

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
      {logoutOverlay}
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
