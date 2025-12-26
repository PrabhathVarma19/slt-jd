'use client';

import { useState } from 'react';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';

type RequestType = 'access' | 'laptop' | 'software' | 'password' | 'other';

interface ItServiceFormState {
  name: string;
  employeeId: string;
  email: string;
  location: string;
  grade: string;
  requestType: RequestType;
  system: string;
  environment: string;
  accessType: string;
  reason: string;
  durationType: 'permanent' | 'temporary';
  durationUntil: string;
  project: string;
  managerEmail: string;
  impact: 'blocker' | 'high' | 'medium' | 'low';
  details: string;
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
  location: '',
  grade: '',
  requestType: 'access',
  system: '',
  environment: '',
  accessType: '',
  reason: '',
  durationType: 'permanent',
  durationUntil: '',
  project: '',
  managerEmail: '',
  impact: 'medium',
  details: '',
};

export default function ServiceDeskPage() {
  const [form, setForm] = useState<ItServiceFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const handleChange = (
    field: keyof ItServiceFormState,
    value: string | RequestType | ItServiceFormState['impact'] | ItServiceFormState['durationType']
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    const payload: any = {
      ...form,
    };

    if (form.durationType === 'permanent') {
      payload.durationUntil = '';
    }

    try {
      const res = await fetch('/api/service-desk/it', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: ApiResponse = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to submit IT service request');
      }
      setResult(data);
      setForm(initialFormState);
    } catch (err: any) {
      setError(err.message || 'Failed to submit IT service request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuggestFromDetails = async () => {
    if (!form.details.trim()) {
      setError('Please describe the issue in Details before asking Beacon to suggest fields.');
      return;
    }

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
        environment?: string | null;
        accessType?: string | null;
        impact?: string | null;
        reason?: string | null;
        error?: string;
      };
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to classify request');
      }

      setForm((prev) => ({
        ...prev,
        requestType:
          (prev.requestType === 'other' || !prev.requestType) && data.requestType
            ? (data.requestType as RequestType)
            : prev.requestType,
        system: prev.system || data.system || '',
        environment: prev.environment || data.environment || '',
        accessType: prev.accessType || data.accessType || '',
        impact:
          prev.impact ||
          ((data.impact as ItServiceFormState['impact']) ?? prev.impact) ||
          prev.impact,
        reason: prev.reason || data.reason || '',
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to classify request from details.');
    } finally {
      setIsSuggesting(false);
    }
  };

  const requestTypeLabel = (rt: RequestType) => {
    switch (rt) {
      case 'access':
        return 'System / application access';
      case 'laptop':
        return 'New laptop / hardware';
      case 'software':
        return 'Software install / license';
      case 'password':
        return 'Password / account issue';
      case 'other':
      default:
        return 'Other IT request';
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Beacon · Service Desk
          </p>
          <h1 className="text-2xl font-semibold text-gray-900 mt-1">
            Raise IT and access requests from one place.
          </h1>
          <p className="text-sm text-gray-600">
            Use this form for system access, laptops, software installs, password issues and other IT
            help. You can just describe the issue in your own words—Beacon will categorise it and send
            a structured request to the IT Service Desk with the right details.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Request type</p>
            <div className="flex flex-wrap gap-2">
              {(['access', 'laptop', 'software', 'password', 'other'] as RequestType[]).map((rt) => (
                <button
                  key={rt}
                  type="button"
                  onClick={() => handleChange('requestType', rt)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    form.requestType === rt
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
                  }`}
                  disabled={isSubmitting}
                >
                  {requestTypeLabel(rt)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Location</label>
              <Input
                value={form.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="City / Country"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Grade</label>
              <Input
                value={form.grade}
                onChange={(e) => handleChange('grade', e.target.value)}
                placeholder="e.g., Grade 5"
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
              placeholder="Explain the request in simple language. Include any error messages, systems involved, and urgency."
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-gray-500">
                You can fill this first in your own words. Beacon can then suggest system, impact and
                other fields.
              </p>
              <Button
                size="xs"
                variant="secondary"
                type="button"
                onClick={handleSuggestFromDetails}
                disabled={isSuggesting || !form.details.trim()}
              >
                {isSuggesting ? 'Suggesting…' : 'Let Beacon suggest fields'}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">
                System / application {form.requestType === 'access' ? <span className="text-red-500">*</span> : null}
              </label>
              <Input
                value={form.system}
                onChange={(e) => handleChange('system', e.target.value)}
                placeholder="e.g., VPN, GitLab, ERP"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Environment</label>
              <Input
                value={form.environment}
                onChange={(e) => handleChange('environment', e.target.value)}
                placeholder="Prod / UAT / Dev"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Access level</label>
              <Input
                value={form.accessType}
                onChange={(e) => handleChange('accessType', e.target.value)}
                placeholder="View only / Standard / Admin"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Project / client</label>
              <Input
                value={form.project}
                onChange={(e) => handleChange('project', e.target.value)}
                placeholder="Optional – for billing / context"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Manager / approver email</label>
              <Input
                type="email"
                value={form.managerEmail}
                onChange={(e) => handleChange('managerEmail', e.target.value)}
                placeholder="manager@trianz.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Impact</label>
              <select
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.impact}
                onChange={(e) =>
                  handleChange('impact', e.target.value as ItServiceFormState['impact'])
                }
              >
                <option value="blocker">Blocker – cannot work</option>
                <option value="high">High – major impact</option>
                <option value="medium">Medium – can work around</option>
                <option value="low">Low – minor</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Reason / use case</label>
              <Textarea
                rows={2}
                value={form.reason}
                onChange={(e) => handleChange('reason', e.target.value)}
                placeholder="Brief reason for this request"
              />
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

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-500">
              Beacon will send this request to the IT Service Desk with your email as reply-to.
            </p>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || !form.name.trim() || !form.employeeId.trim() || !form.email.trim() || !form.details.trim()}
            >
              {isSubmitting ? 'Submitting…' : 'Submit IT request'}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-3 text-sm text-gray-700">
            <h2 className="text-sm font-semibold text-gray-900">What this covers</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Access to internal systems (VPN, GitLab, ERP, BI tools, etc.).</li>
              <li>New laptop / hardware or changes to existing hardware.</li>
              <li>Software installations and license requests.</li>
              <li>Password and account issues that block your work.</li>
            </ul>
            <p className="text-xs text-gray-500">
              For urgent production incidents, please also follow your normal escalation process (phone
              bridge / critical incident channel) in addition to raising this request.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-3 text-sm text-gray-700">
            <h2 className="text-sm font-semibold text-gray-900">Submission status</h2>
            {!result && !error && (
              <p className="text-sm text-gray-600">
                After you submit, you&apos;ll see whether Beacon successfully emailed your request to the
                IT Service Desk.
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
            Beacon does not override IT or security policies. It only formats and routes your request to
            the right team. For questions on what is allowed, ask Beacon about the relevant policy or
            contact IT / InfoSec.
          </div>
        </div>
      </div>
    </div>
  );
}
