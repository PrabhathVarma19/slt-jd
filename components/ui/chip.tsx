import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export default function Chip({
  className,
  selected = false,
  ...props
}: ChipProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150',
        selected
          ? 'bg-gray-900 text-white hover:bg-gray-800'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
        className
      )}
      {...props}
    />
  );
}

