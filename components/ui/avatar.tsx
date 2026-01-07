'use client';

import { cn } from '@/lib/utils';

interface AvatarProps {
  name?: string;
  email?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Avatar({ name, email, size = 'md', className }: AvatarProps) {
  // Get initials from name or email
  const getInitials = () => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (email) {
      const username = email.split('@')[0];
      const parts = username.split('.');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return username.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  };

  // Generate color based on email/name for consistent avatar colors
  const getColor = () => {
    const str = email || name || 'user';
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 65%, 50%)`;
  };

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white',
        'transition-all duration-200 hover:scale-105 hover:shadow-md',
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: getColor() }}
    >
      {getInitials()}
    </div>
  );
}

