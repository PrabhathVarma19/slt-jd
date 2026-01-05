'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';

type RequestType = 'access' | 'hardware' | 'software' | 'subscription' | 'password' | 'other';
type ImpactLevel = 'blocker' | 'high' | 'medium' | 'low';
type DurationType = 'permanent' | 'temporary';

interface ItServiceFormState {
  name: string;
  employeeId: string;
  email: string;
  grade: string;
  requestType: RequestType;
  system: string;
  project: string;
  managerEmail: string;
  impact: ImpactLevel;
  durationType: DurationType;
  durationUntil: string;
  details: string;
  reason: string;
  isSubscription: boolean;
}

interface ApiResponse {
  status?: string;
  message?: string;
  error?: string;
}

const initialFormState: ItServiceFormState = {
  name: '',
  employeeId: '',
  email: '',
  grade: '',
  requestType: 'other',
  system: '',
  project: '',
  managerEmail: '',
  impact: 'medium',
  durationType: 'temporary',
  durationUntil: '',
  details: '',
  reason: '',
  isSubscription: false,
};

function normalizeImpact(details: string, impact: ImpactLevel): ImpactLevel {
  const text = details.toLowerCase();

  const looksBlocker =
    text.includes('cannot work') ||
    text.includes("can't work") ||
    text.includes('blocked') ||
    text.includes('production down') ||
    text.includes('prod down') ||
    text.includes('sev1') ||
    text.includes('sev 1');

  if (looksBlocker) return 'blocker';

  const looksHigh =
    text.includes('urgent') ||
    text.includes('asap') ||
    text.includes('immediately') ||
    text.includes('today') ||
    text.includes('before eod') ||
    text.includes('deadline') ||
    text.includes('client meeting') ||
    text.includes('go-live') ||
    text.includes('golive');

  if (looksHigh) return 'high';

  if (impact === 'blocker' || impact === 'high') return 'medium';

  return impact;
}

function requestTypeLabel(rt: RequestType): string {
  switch (rt) {
    case 'access':
      return 'System / application access';
    case 'hardware':
      return 'Hardware / devices';
    case 'software':
      return 'Software install';
    case 'subscription':
      return 'Subscription / SaaS access';
    case 'password':
      return 'Password / account issue';
    case 'other':
    default:
      return 'Other IT request';
  }
}

export default function ServiceDeskPage() {
  const [form, setForm] = useState<ItServiceFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [shouldAutoSuggest, setShouldAutoSuggest] = useState(false);

  // Seed Details when navigated from Ask Beacon with ?details=...
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (form.details) return;
    try {
      const url = new URL(window.location.href);
      const qpDetails = url.searchParams.get('details');
      if (qpDetails) {
        setForm((prev) => ({ ...prev, details: qpDetails }));
        setShouldAutoSuggest(true);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (field: keyof ItServiceFormState, value: string | RequestType | ImpactLevel | DurationType) => {
    setForm((prev) => ({ ...prev, [field]: value as any }));
  };

  const runSuggestion = async () => {
    setIsSuggesting(true);
    setError(null);

    try {
      const res = await fetch('/api/service-desk/it/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ details: form.details }),
      });

      const data = (await res.json()) as {
        requestType?: string | null;
        system?: string | null;
        impact?: string | null;
        reason?: string | null;
        isSubscription?: boolean;
        error?: string;
      };

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to classify request');
      }

      setForm((prev) => {
        const rawImpact = ((data.impact as ImpactLevel | null) ?? prev.impact) || prev.impact;
        const normalized = normalizeImpact(prev.details, rawImpact);

        const detailsLower = prev.details.toLowerCase();
        const looksSubscription =
          /subscription|license|licence/.test(detailsLower) ||
          data.requestType === 'subscription';

        return {
          ...prev,
          requestType: (data.requestType as RequestType) || prev.requestType,
          system: (data.system as string | null) ?? prev.system,
          impact: normalized,
          reason: (data.reason as string | null) ?? prev.reason,
          isSubscription: data.isSubscription ?? looksSubscription ?? prev.isSubscription,
        };
      });
    } catch (err: any) {
      setError(err.message || 'Failed to classify request from Details.');
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleSuggestFromDetails = async () => {
    if (!form.details.trim()) {
      setError('Please describe the request in Details before asking Beacon to suggest fields.');
      return;
    }
    await runSuggestion();
  };

  // If we arrived with ?details=..., auto-suggest once.
  useEffect(() => {
    if (!shouldAutoSuggest) return;
    if (!form.details.trim()) return;
    setShouldAutoSuggest(false);
    runSuggestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoSuggest, form.details]);

  const canSubmit =
    !!form.name.trim() &&
    !!form.employeeId.trim() &&
    !!form.email.trim() &&
    !!form.details.trim() &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const payload: ItServiceFormState = { ...form };

      const res = await fetch('/api/service-desk/it', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as ApiResponse;
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to submit IT request');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to submit IT request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-2">
        <Link
          href="/"
          className="inline-flex items-center text-xs font-medium text-blue-700 hover:underline"
        >
          ← Back to Home
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Service Desk · IT &amp; access
          </p>
          <h1 className="text-2xl font-semibold text-gray-900">
            Raise structured IT and access requests.
          </h1>
          <p className="text-sm text-gray-600">
            Describe the issue in your own words and let Beacon suggest the right category and
            system. Your request is formatted into a clear email and routed to the IT Service Desk.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
        <div className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Request details</h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Name as per Govt ID"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">
                Employee ID <span className="text-red-500">*</span>
              </label>
              <Input
                value={form.employeeId}
                onChange={(e) => handleChange('employeeId', e.target.value)}
                placeholder="e.g., 12345"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="you@trianz.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">
              Details <span className="text-red-500">*</span>
            </label>
            <Textarea
              rows={4}
              value={form.details}
              onChange={(e) => handleChange('details', e.target.value)}
              placeholder="Explain the request in simple language. Include any error messages, systems, or links if relevant."
            />
            <p className="text-[11px] text-gray-500">
              You can fill this first in your own words. Beacon can then suggest category, system,
              impact and other fields.
            </p>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={handleSuggestFromDetails}
              disabled={isSuggesting || !form.details.trim()}
            >
              {isSuggesting ? 'Let Beacon suggest fields…' : 'Let Beacon suggest fields'}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Category</label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.requestType}
                onChange={(e) => handleChange('requestType', e.target.value as RequestType)}
                disabled={isSubmitting}
              >
                <option value="access">System / application access</option>
                <option value="hardware">Hardware / devices</option>
                <option value="software">Software install</option>
                <option value="subscription">Subscription / SaaS access</option>
                <option value="password">Password / account issue</option>
                <option value="other">Other IT request</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">
                Subcategory / system or application
              </label>
              <Input
                value={form.system}
                onChange={(e) => handleChange('system', e.target.value)}
                placeholder="e.g., VPN, Cursor, GitLab, ERP"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">Subscription / license?</label>
            <div className="flex items-center gap-2 text-xs text-gray-700">
              <input
                id="isSubscription"
                type="checkbox"
                className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={form.isSubscription}
                onChange={(e) => handleChange('isSubscription', e.target.checked ? 'true' : 'false')}
                disabled={isSubmitting}
              />
              <label htmlFor="isSubscription">
                This request is about a paid subscription or license.
              </label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Project / client (optional)</label>
              <Input
                value={form.project}
                onChange={(e) => handleChange('project', e.target.value)}
                placeholder="For billing / context"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">
                Manager / approver email (optional)
              </label>
              <Input
                type="email"
                value={form.managerEmail}
                onChange={(e) => handleChange('managerEmail', e.target.value)}
                placeholder="manager@trianz.com"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Impact</label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.impact}
                onChange={(e) => handleChange('impact', e.target.value as ImpactLevel)}
                disabled={isSubmitting}
              >
                <option value="blocker">Blocker – cannot work</option>
                <option value="high">High – severely impacts work</option>
                <option value="medium">Medium – can work with difficulty</option>
                <option value="low">Low – minor issue</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Duration</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleChange('durationType', 'permanent')}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    form.durationType === 'permanent'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                  }`}
                  disabled={isSubmitting}
                >
                  Permanent
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('durationType', 'temporary')}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    form.durationType === 'temporary'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                  }`}
                  disabled={isSubmitting}
                >
                  Temporary
                </button>
              </div>
              {form.durationType === 'temporary' && (
                <div className="mt-2 space-y-1">
                  <label className="text-xs font-medium text-gray-700">Requested until</label>
                  <Input
                    type="date"
                    value={form.durationUntil}
                    onChange={(e) => handleChange('durationUntil', e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-500">
              Beacon will send this request to the IT Service Desk with your email as reply‑to.
            </p>
            <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
              {isSubmitting ? 'Submitting…' : 'Submit IT request'}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-3 text-sm text-gray-700">
            <h2 className="text-sm font-semibold text-gray-900">What this covers</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Access to internal systems (VPN, GitLab, ERP, BI tools, etc.).</li>
              <li>New laptop / hardware or changes to existing hardware.</li>
              <li>Software installations and license requests.</li>
              <li>Password and account issues that block your work.</li>
            </ul>
            <p className="text-xs text-gray-500">
              For urgent production incidents, please also follow your normal escalation process
              (phone bridge / critical incident channel) in addition to raising this request.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-3 text-sm text-gray-700">
            <h2 className="text-sm font-semibold text-gray-900">Submission status</h2>
            {!result && !error && (
              <p className="text-sm text-gray-600">
                After you submit, you&apos;ll see whether Beacon successfully emailed your request to
                the IT Service Desk.
              </p>
            )}
            {result && (
              <div className="space-y-1">
                <p className="font-medium text-gray-900">
                  {result.status === 'queued'
                    ? 'Request sent'
                    : result.status === 'accepted'
                    ? 'Request captured'
                    : 'Status'}
                </p>
                {result.message && <p className="text-sm text-gray-700">{result.message}</p>}
              </div>
            )}
            {error && (
              <p className="text-sm text-red-700">
                {error} If this continues, please reach out to the IT Service Desk directly.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-[11px] text-gray-500">
            Beacon does not override IT or security policies. It only formats and routes your request
            to the right team. For questions on what is allowed, ask Beacon about the relevant policy
            or contact IT / InfoSec.
          </div>
        </div>
      </div>
    </div>
  );
}
