'use client';

import Link from 'next/link';
import Button from '@/components/ui/button';

export default function WeeklyBriefPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">CIO Weekly Brief</p>
          <h1 className="text-2xl font-semibold text-gray-900">Prep and publish the Thursday call in minutes.</h1>
          <p className="text-sm text-gray-600">
            Paste the team updates or the consolidated email to generate a digest, run-of-show, and action/risk register.
          </p>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <Button asChild>
            <Link href="/weekly-brief">Start Weekly Brief</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700">
        This is a placeholder. Hook up the ingest form and API here to parse updates, generate the digest/run-of-show, and save the action register in Supabase.
      </div>
    </div>
  );
}
