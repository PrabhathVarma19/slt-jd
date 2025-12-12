'use client';

import Link from 'next/link';
import Button from '@/components/ui/button';

export default function CommsHubPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Comms Hub</p>
          <h1 className="text-2xl font-semibold text-gray-900">Turn raw updates into exec newsletters or team emails.</h1>
          <p className="text-sm text-gray-600">
            Paste consolidated updates and generate polished comms in two tones: exec newsletter or single-team status email.
          </p>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Link href="/comms-hub">
            <Button>Start Comms Hub</Button>
          </Link>
          <Link href="/">
            <Button variant="secondary">Back to Home</Button>
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700">
        Placeholder: wire in the ingest form and API to produce newsletter and single-team email outputs, store issues/history, and offer copy/export actions.
      </div>
    </div>
  );
}
