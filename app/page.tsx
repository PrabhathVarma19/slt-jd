'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import Button from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';

type ToolBucket = 'Ask' | 'Requests' | 'Outputs';

interface Tool {
  title: string;
  description: string;
  href: string;
  bucket: ToolBucket;
  initials: string;
  accent: string;
}

const TOOLS: Tool[] = [
  {
    title: 'Ask Beacon',
    description: 'Get policy and "how do I..." answers with citations.',
    href: '/policy-agent',
    bucket: 'Ask',
    initials: 'AB',
    accent: 'bg-sky-100 text-sky-700',
  },
  {
    title: 'New Joiner Buddy',
    description: 'Help new joiners through their first 90 days.',
    href: '/new-joiner',
    bucket: 'Ask',
    initials: 'NJ',
    accent: 'bg-emerald-100 text-emerald-700',
  },
  {
    title: 'Service Desk',
    description: 'Format and email IT / access requests.',
    href: '/service-desk',
    bucket: 'Requests',
    initials: 'SD',
    accent: 'bg-slate-100 text-slate-700',
  },
  {
    title: 'Travel Desk',
    description: 'Create travel request emails with all required details.',
    href: '/travel-desk',
    bucket: 'Requests',
    initials: 'TD',
    accent: 'bg-cyan-100 text-cyan-700',
  },
  {
    title: 'Comms Hub',
    description: 'Draft newsletters and change notices from updates.',
    href: '/comms-hub',
    bucket: 'Outputs',
    initials: 'CH',
    accent: 'bg-fuchsia-100 text-fuchsia-700',
  },
  {
    title: 'Weekly Initiatives',
    description: 'Turn weekly updates into a CIO / SLT brief.',
    href: '/weekly-brief',
    bucket: 'Outputs',
    initials: 'WI',
    accent: 'bg-amber-100 text-amber-700',
  },
  {
    title: 'Create JD',
    description: 'Generate structured role descriptions and skill requirements.',
    href: '/jd',
    bucket: 'Outputs',
    initials: 'JD',
    accent: 'bg-indigo-100 text-indigo-700',
  },
  {
    title: 'Expenses & Fusion Coach',
    description: 'Explain reimbursable expenses and Fusion steps in clear actions.',
    href: '/expenses-coach',
    bucket: 'Outputs',
    initials: 'EX',
    accent: 'bg-teal-100 text-teal-700',
  },
];

const BUCKET_LABELS: Record<ToolBucket, string> = {
  Ask: 'Ask',
  Requests: 'Requests',
  Outputs: 'Outputs',
};

export default function Home() {
  const buckets: ToolBucket[] = ['Ask', 'Requests', 'Outputs'];

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Text column */}
        <div className="space-y-6">
          <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            Beacon
          </div>

          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
            Beacon - the Trianz AI desk for answers and requests.
          </h1>

          <p className="max-w-xl text-base text-slate-600">
            Ask policy questions with citations, raise IT and travel requests, and generate
            leadership updates - all in one place, grounded in Trianz policies and systems.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild className="rounded-full px-5">
              <Link href="/policy-agent">Ask Beacon</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-5">
              <Link href="/service-desk">Raise IT request</Link>
            </Button>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('tools');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="text-sm text-slate-500 underline-offset-4 hover:underline"
            >
              See all tools
            </button>
          </div>

          <p className="text-xs text-slate-400">Built for Trianz. Content updated Dec 2025.</p>
        </div>

        {/* Preview cluster */}
        <div className="relative h-64 md:h-72">
          <div className="absolute inset-0 rounded-full bg-indigo-100/40 blur-3xl" />

          <Card className="absolute left-0 top-4 w-64 rounded-2xl bg-white/90 shadow-md backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-900">Ask Beacon</CardTitle>
              <CardDescription className="text-[11px] text-slate-500">
                Policy and &quot;how do I...&quot; answers with citations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-slate-800">
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                How many days do I need to be in office?
              </div>
              <div className="rounded-2xl bg-indigo-50 px-3 py-2 text-[11px]">
                Beacon: Minimum three days per week as per roster, unless you have an approved
                exception. See Return to Office Policy, section 3.
              </div>
            </CardContent>
          </Card>

          <Card className="absolute right-0 bottom-2 w-64 rounded-2xl bg-white/90 shadow-md backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-slate-900">
                Raise an IT request
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-500">
                Type one sentence about what you need.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] text-slate-800">
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                My laptop is not turning on, please arrange support.
              </div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2">
                I need Power BI Pro subscription access for client reporting.
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* What Beacon helps with */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">What you can do with Beacon</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="rounded-2xl bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                  Q
                </span>
                Ask Beacon
              </CardTitle>
              <CardDescription className="text-sm text-slate-600">
                Get policy and &quot;how do I...&quot; answers with citations from internal docs.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="rounded-2xl bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                  IT
                </span>
                Service Desk &amp; Travel Desk
              </CardTitle>
              <CardDescription className="text-sm text-slate-600">
                Turn plain language into structured IT and travel requests, emailed to the right
                queues.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="rounded-2xl bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                  C
                </span>
                Comms &amp; updates
              </CardTitle>
              <CardDescription className="text-sm text-slate-600">
                Turn weekly updates into briefs, newsletters and change notices for teams.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Tools launcher */}
      <section id="tools" className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Tools in Beacon</h2>
        <p className="text-sm text-slate-600">Organized by how you use them.</p>

        <div className="space-y-4">
          {buckets.map((bucket) => {
            const tools = TOOLS.filter((t) => t.bucket === bucket);
            return (
              <div key={bucket} className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  {BUCKET_LABELS[bucket]}
                </h3>
                <div className="space-y-2">
                  {tools.map((tool) => (
                    <Link
                      key={tool.title}
                      href={tool.href}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-card px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${tool.accent}`}
                        >
                          {tool.initials}
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-slate-900">{tool.title}</p>
                          <p className="text-xs text-slate-600">{tool.description}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Trust strip */}
      <section className="pb-4">
        <div className="rounded-2xl bg-card px-4 py-4 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            How Beacon answers
          </p>
          <ul className="mt-2 space-y-1 list-disc pl-5 text-xs text-slate-600 md:text-sm">
            <li>Grounded in internal sources (policies, HR/IT docs).</li>
            <li>Citations included (document and section).</li>
            <li>Uses approved email workflows; does not bypass approvals.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
