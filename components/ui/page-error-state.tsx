'use client';

import Link from 'next/link';
import Button from '@/components/ui/button';

type PageErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export function PageErrorState({
  title = 'Something went wrong',
  message = 'Beacon hit an unexpected error while loading this page.',
  onRetry,
}: PageErrorStateProps) {
  return (
    <div className="mx-auto my-10 max-w-2xl rounded-lg border border-red-200 bg-red-50 p-6">
      <h2 className="text-lg font-semibold text-red-900">{title}</h2>
      <p className="mt-2 text-sm text-red-800">{message}</p>
      <div className="mt-4 flex items-center gap-3">
        {onRetry && (
          <Button onClick={onRetry} size="sm">
            Retry
          </Button>
        )}
        <Link href="/">
          <Button variant="secondary" size="sm">
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
