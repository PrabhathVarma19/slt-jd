'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Avatar } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { LogOut, User, Shield } from 'lucide-react';

export function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ email: string; name?: string; roles?: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    // Don't fetch session on login page
    if (pathname === '/login') {
      setLoading(false);
      return;
    }

    fetch('/api/auth/session')
      .then((res) => res.json())
      .then((data) => {
        if (data.isAuthenticated || data.authenticated) {
          setUser(data.user);
        }
      })
      .catch(() => {
        // Not logged in
      })
      .finally(() => {
        setLoading(false);
      });
  }, [pathname]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      // Add fade-out animation
      await new Promise((resolve) => setTimeout(resolve, 200));
      await fetch('/api/auth/logout', { method: 'POST' });
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
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>Profile</span>
            </div>
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

