'use client';

import { PageErrorState } from '@/components/ui/page-error-state';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <PageErrorState
      title="We could not load this page"
      message={error?.message || 'Try again in a moment.'}
      onRetry={() => reset()}
    />
  );
}
