'use client';

import { PageErrorState } from '@/components/ui/page-error-state';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <PageErrorState
          title="Beacon encountered an application error"
          message={error?.message || 'Please retry. If the issue persists, contact support.'}
          onRetry={() => reset()}
        />
      </body>
    </html>
  );
}
