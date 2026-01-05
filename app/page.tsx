'use client';

import Link from 'next/link';
import Button from '@/components/ui/button';

type AgentCategory = 'Leadership' | 'Org-wide';

interface AgentCard {
  title: string;
  description: string;
  link: string;
  category: AgentCategory;
  accent: string;
  label: string;
}

const AGENTS: AgentCard[] = [
  {
    title: 'Ask Beacon',
    description: 'Policy and how-to assistant with grounded answers and key rules.',
    link: '/policy-agent',
    category: 'Org-wide',
    accent: 'from-sky-500 to-blue-600',
    label: 'Policy & how-to',
  },
  {
    title: 'New Joiner Buddy',
    description: 'Day-1 and week-1 helper for new associates: setup, RTO, leave and basics.',
    link: '/new-joiner',
    category: 'Org-wide',
    accent: 'from-emerald-500 to-teal-600',
    label: 'Onboarding',
  },
  {
    title: 'Create JD',
    description: 'Generate, edit and save SLT/CXO-ready job descriptions with AI.',
    link: '/jd',
    category: 'Leadership',
    accent: 'from-indigo-500 to-purple-600',
    label: 'Hiring',
  },
  {
    title: 'Weekly Initiatives',
    description: 'Turn team updates into CIO-ready digest, run-of-show and action register.',
    link: '/weekly-brief',
    category: 'Leadership',
    accent: 'from-amber-500 to-orange-500',
    label: 'CIO brief',
  },
  {
    title: 'Comms Hub',
    description: 'Convert raw notes into exec newsletters or targeted team emails.',
    link: '/comms-hub',
    category: 'Leadership',
    accent: 'from-fuchsia-500 to-pink-500',
    label: 'Exec comms',
  },
  {
    title: 'Travel Desk',
    description: 'Prepare policy-aware travel summaries and email drafts for the travel desk.',
    link: '/travel-desk',
    category: 'Org-wide',
    accent: 'from-cyan-500 to-sky-500',
    label: 'Travel & expenses',
  },
  {
    title: 'Expenses & Fusion Coach',
    description: 'Explain reimbursable expenses and Fusion steps in clear, numbered actions.',
    link: '/expenses-coach',
    category: 'Org-wide',
    accent: 'from-teal-500 to-emerald-600',
    label: 'Expenses',
  },
  {
    title: 'Service Desk',
    description: 'Raise IT and access requests in a structured, policy-aware format.',
    link: '/service-desk',
    category: 'Org-wide',
    accent: 'from-slate-500 to-gray-700',
    label: 'IT & access',
  },
];

const leadershipAgents = AGENTS.filter((a) => a.category === 'Leadership');
const orgAgents = AGENTS.filter((a) => a.category === 'Org-wide');

export default function Home() {
  return (
    <div className="space-y-12">
      <section className="rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
              Beacon workspace
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
              AI agents for leaders and teams at Trianz.
            </h1>
            <p className="text-base text-gray-600">
              Use Beacon to draft JDs, prep CIO initiatives, generate exec-ready comms, answer policy
              questions, and guide new joiners—without digging through email threads and PDFs.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/policy-agent">
                <Button>Ask Beacon</Button>
              </Link>
              <Link href="/jd">
                <Button variant="secondary">Create JD</Button>
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-5 text-sm text-gray-700 shadow-inner max-w-md">
            <h3 className="text-base font-semibold text-gray-900">What Beacon helps with</h3>
            <ul className="mt-3 space-y-2">
              <li>• Draft and refine SLT/CXO job descriptions</li>
              <li>• Turn weekly updates into a CIO-ready brief</li>
              <li>• Generate newsletters and single-team updates</li>
              <li>• Answer policy and “how do I…” questions with citations</li>
              <li>• Guide new joiners through their first days</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {AGENTS.map((agent) => (
            <Link
              key={agent.title}
              href={agent.link}
              className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${agent.accent} text-xs font-semibold text-white`}
                >
                  {agent.label.slice(0, 2).toUpperCase()}
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    {agent.label}
                  </p>
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-gray-950">
                    {agent.title}
                  </h3>
                  <p className="text-xs text-gray-600">{agent.description}</p>
                </div>
              </div>
              <div className="mt-4 text-xs font-medium text-blue-700 group-hover:underline">
                {agent.title}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
