'use client';

import Link from 'next/link';
import Button from '@/components/ui/button';

const features = [
  {
    title: 'Create Job Description',
    description: 'Generate, edit, and save JDs with AI assistance for SLT/CXO hiring flows.',
    link: '/jd',
    action: 'Open JD Creator',
  },
  {
    title: 'Weekly Initiatives (CIO)',
    description: 'Ingest team updates, get a digest, run-of-show, and action register for the weekly initiatives call.',
    link: '/weekly-brief',
    action: 'Open Weekly Initiatives',
  },
  {
    title: 'Comms Hub',
    description: 'Turn raw updates into exec newsletters or single-team emails in one click.',
    link: '/comms-hub',
    action: 'Open Comms Hub',
  },
  {
    title: 'Policy Agent',
    description: 'Ask natural-language questions grounded in internal policy documents with citations.',
    link: '/policy-agent',
    action: 'Open Policy Agent',
  },
  {
    title: 'Travel Desk',
    description: 'Capture trip details and generate a clear, policy-aware travel request and email draft for the travel desk.',
    link: '/travel-desk',
    action: 'Open Travel Desk',
  },
];

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">CIO Workspace</p>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              Ship faster with AI copilots for hiring, updates, and exec comms.
            </h1>
            <p className="text-base text-gray-600">
              Choose a tool to start: generate JDs, prep the weekly CIO brief, or craft exec-ready newsletters and team updates.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/jd">
                <Button>Open JD Creator</Button>
              </Link>
              <Link href="/weekly-brief">
                <Button variant="secondary">Weekly Initiatives</Button>
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-5 text-sm text-gray-700 shadow-inner">
            <h3 className="text-base font-semibold text-gray-900">What&apos;s inside</h3>
            <ul className="mt-3 space-y-2">
              <li>• AI-generated JDs with editing and library</li>
              <li>• Weekly digest + run-of-show for CIO calls</li>
              <li>• Exec newsletters or single-team updates</li>
              <li>• One place for SLT-ready outputs</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">Tools</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col justify-between rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:border-gray-300"
            >
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
              <div className="mt-4">
                <Link href={feature.link}>
                  <Button size="md">{feature.action}</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
