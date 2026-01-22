'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
}

export function DropdownMenu({ trigger, children, align = 'right' }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, mounted]);

  if (!mounted) {
    return (
      <div className="relative">
        <div className="cursor-pointer">
          {trigger}
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>
      {isOpen && (
        <div
          className={cn(
            'absolute z-50 mt-2 min-w-[200px] rounded-lg border border-gray-200 bg-white shadow-lg',
            'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2',
            align === 'right' ? 'right-0' : 'left-0'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors',
        className
      )}
    >
      {children}
    </div>
  );
}

export function DropdownMenuSeparator() {
  return <div className="h-px bg-gray-200 my-1" />;
}

