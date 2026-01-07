'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/button';

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; roles?: string[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return null;
  }

  if (!user) {
    return (
      <Button asChild variant="outline" size="sm">
        <a href="/login">Sign In</a>
      </Button>
    );
  }

  const isAdmin = user.roles?.some((role) =>
    ['ADMIN_IT', 'ADMIN_TRAVEL', 'ADMIN_HR', 'SUPER_ADMIN'].includes(role)
  );

  return (
    <div className="flex items-center gap-3">
      <div className="text-right hidden sm:block">
        <div className="text-sm font-medium text-gray-900">{user.email}</div>
        {isAdmin && (
          <div className="text-xs text-gray-500">Admin</div>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={handleLogout}>
        Sign Out
      </Button>
    </div>
  );
}

