'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import { BackToHome } from '@/components/ui/back-to-home';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/lib/hooks/useToast';
import { ViewToggle } from '@/components/service-desk/view-toggle';
import { ChatInterface } from '@/components/service-desk/chat-interface';
import { authenticatedFetch } from '@/lib/api/fetch-utils';

type RequestType =
  | ''
  | 'access'
  | 'hardware'
  | 'software'
  | 'subscription'
  | 'password'
  | 'other';
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
  projectCode: string;
  projectName: string;
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
  requestType: '',
  system: '',
  project: '',
  projectCode: '',
  projectName: '',
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
  const [viewMode, setViewMode] = useState<'chat' | 'form'>('chat');
  const [form, setForm] = useState<ItServiceFormState>(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [shouldAutoSuggest, setShouldAutoSuggest] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSubmitAt, setLastSubmitAt] = useState<string | null>(null);
  const [lastSubmitOutcome, setLastSubmitOutcome] = useState<'success' | 'error' | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [userProjects, setUserProjects] = useState<Array<{ code: string; name: string }>>([]);
  const { showToast, ToastContainer } = useToast();

  // Fetch user profile and auto-fill form
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await authenticatedFetch<{ user?: { profile?: any; email?: string } }>('/api/profile');
        const profile = data.user?.profile;
        if (profile) {
          // Extract projects from rawPayloadJson if multiple, or use single projectCode
          let projects: Array<{ code: string; name: string }> = [];
          if (profile.rawPayloadJson && Array.isArray(profile.rawPayloadJson) && profile.rawPayloadJson.length > 1) {
            // Multiple projects
            projects = profile.rawPayloadJson.map((p: any) => ({
              code: p.ProjectCode || p.projectCode || '',
              name: p.ProjectName || p.projectName || '',
            }));
          } else if (profile.projectCode) {
            // Single project
            projects = [{
              code: profile.projectCode,
              name: profile.projectName || '',
            }];
          }

          setUserProjects(projects);

          // Auto-select first project if only one
          if (projects.length === 1) {
            setForm((prev) => ({
              ...prev,
              projectCode: projects[0].code,
              projectName: projects[0].name,
            }));
          }

          setForm((prev) => ({
            ...prev,
            name: profile.empName || prev.name,
            employeeId: profile.employeeId?.toString() || prev.employeeId,
            email: data.user?.email || prev.email,
            grade: profile.gradeCode || prev.grade,
            managerEmail: profile.supervisorEmail || prev.managerEmail,
          }));
        } else if (data.user?.email) {
          // Even without profile, we have email from session
          setForm((prev) => ({
            ...prev,
            email: data.user?.email || prev.email,
          }));
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, []);

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

  const handleChange = (
    field: keyof ItServiceFormState,
    value: string | RequestType | ImpactLevel | DurationType | boolean
  ) => {
    setForm((prev) => ({ ...prev, [field]: value as any }));
  };

  const runSuggestion = async () => {
    setIsSuggesting(true);
    setError(null);

    try {
      const data = await authenticatedFetch<{
        requestType?: string | null;
        system?: string | null;
        impact?: string | null;
        reason?: string | null;
        isSubscription?: boolean;
        error?: string;
      }>('/api/service-desk/it/classify', {
        method: 'POST',
        body: JSON.stringify({ details: form.details }),
      });

      if (data.error) {
        throw new Error(data.error);
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

  const isVpnRequest =
    form.requestType === 'access' && form.system.trim().toLowerCase().includes('vpn');
  const isSubscriptionRequest = form.requestType === 'subscription' || form.isSubscription;
  const requiresDuration = isSubscriptionRequest || isVpnRequest;
  const requiresReason =
    form.requestType === 'software' || isSubscriptionRequest || isVpnRequest;

  const canSubmit =
    !!form.details.trim() &&
    !!form.requestType &&
    !!form.system.trim() &&
    !!form.employeeId.trim() &&
    !!form.email.trim() &&
    (!requiresReason || !!form.reason.trim()) &&
    (!requiresDuration ||
      (form.durationType === 'permanent' ||
        (form.durationType === 'temporary' && !!form.durationUntil.trim()))) &&
    (userProjects.length <= 1 || !!form.projectCode.trim()) && // Project required if multiple projects
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (!form.employeeId.trim() || !form.email.trim()) {
        throw new Error('Your profile is missing employee details. Please contact IT support.');
      }

      const payload: ItServiceFormState = { ...form };

      const data = await authenticatedFetch<ApiResponse>('/api/service-desk/it', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      setLastSubmitAt(
        new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      );
      setLastSubmitOutcome('success');
      showToast('Request emailed to Service Desk. A copy was sent to you.', 'success');

      // On success, reset the form completely and show a confirmation modal
      setForm(initialFormState);
      setShowSuccessModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit IT request.');
      setLastSubmitAt(
        new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      );
      setLastSubmitOutcome('error');
      showToast('Could not send request. Check VPN or try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-4 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-1 flex-1">
          <BackToHome label="" className="mt-1 text-xs" />
          <h1 className="text-2xl font-semibold text-slate-900">Service Desk</h1>
          <p className="col-start-2 text-sm text-slate-600">
            {viewMode === 'chat' 
              ? 'Chat with Beacon to submit IT requests or get help with self-service actions.'
              : 'Raise structured IT and access requests. Beacon can suggest category, system and impact.'}
          </p>
        </div>
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      {viewMode === 'chat' ? (
        <ChatInterface />
      ) : (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* Left: form */}
          <div className="bg-card rounded-3xl shadow-sm p-6 space-y-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Request details
            </p>
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
                {isSuggesting ? 'Let Beacon suggest fields...' : 'Let Beacon suggest fields'}
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.requestType}
                onChange={(e) => handleChange('requestType', e.target.value as RequestType)}
                disabled={isSubmitting}
              >
                <option value="" disabled>
                  Choose a category
                </option>
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
                Subcategory / system or application <span className="text-red-500">*</span>
              </label>
              <Input
                autoComplete="off"
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
                onChange={(e) => handleChange('isSubscription', e.target.checked)}
                disabled={isSubmitting}
              />
              <label htmlFor="isSubscription">
                This request is about a paid subscription or license.
              </label>
            </div>
          </div>

          {userProjects.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">
                Project Code <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.projectCode}
                onChange={(e) => {
                  const selected = userProjects.find(p => p.code === e.target.value);
                  setForm((prev) => ({
                    ...prev,
                    projectCode: e.target.value,
                    projectName: selected?.name || '',
                  }));
                }}
                disabled={isSubmitting}
              >
                <option value="">Select a project</option>
                {userProjects.map((project) => (
                  <option key={project.code} value={project.code}>
                    {project.code}{project.name ? ` - ${project.name}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500">
                Select which project this request is for
              </p>
            </div>
          )}

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
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-700">
              Reason / use case {requiresReason && <span className="text-red-500">*</span>}
            </label>
            <Textarea
              rows={2}
              value={form.reason}
              onChange={(e) => handleChange('reason', e.target.value)}
              placeholder="Why do you need this? (e.g., project requirement, client delivery, onboarding)"
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Impact {requiresDuration ? '& duration' : ''}
            </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Impact</label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={form.impact}
                onChange={(e) => handleChange('impact', e.target.value as ImpactLevel)}
                disabled={isSubmitting}
              >
                  <option value="blocker">Blocker - cannot work</option>
                  <option value="high">High - severely impacts work</option>
                  <option value="medium">Medium - can work with difficulty</option>
                  <option value="low">Low - minor issue</option>
              </select>
            </div>

            {requiresDuration && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700">
                  Duration <span className="text-red-500">*</span>
                </label>
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
                    <label className="text-xs font-medium text-gray-700">
                      Requested until <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={form.durationUntil}
                      onChange={(e) => handleChange('durationUntil', e.target.value)}
                    />
                  </div>
                )}
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
                Beacon will send this request to the IT Service Desk with your email as reply-to.
            </p>
            <Button size="sm" onClick={handleSubmit} disabled={!canSubmit} className="rounded-full">
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Submitting...
                </span>
              ) : (
                'Submit IT request'
              )}
            </Button>
          </div>
        </div>

        {/* Right: status & guidance */}
        <div className="space-y-4">
          <div className="bg-card rounded-3xl shadow-sm p-4 space-y-3 text-sm text-gray-700">
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

          <div className="bg-card rounded-3xl shadow-sm p-4 space-y-3 text-sm text-gray-700">
            <p className="text-sm font-semibold text-gray-900">What happens next</p>
            <p className="text-sm text-gray-600">
              Beacon formats your request and emails it to the IT Service Desk. You are CC&apos;d on the email.
            </p>

            <h2 className="text-sm font-semibold text-gray-900">Submission status</h2>
            {!lastSubmitAt && (
              <p className="text-sm text-gray-600">
                No requests sent from this page yet.
              </p>
            )}
            {lastSubmitAt && (
              <div className="space-y-1">
                <p className="text-sm text-gray-700">
                  Last submission: <span className="font-medium text-gray-900">{lastSubmitAt}</span>
                </p>
                {lastSubmitOutcome === 'success' && (
                  <p className="text-sm text-green-700">Last request sent successfully.</p>
                )}
                {lastSubmitOutcome === 'error' && (
                  <p className="text-sm text-red-700">Last attempt failed. Please try again.</p>
                )}
              </div>
            )}
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

          <div className="rounded-2xl bg-muted px-4 py-3 text-[11px] text-gray-500">
            Beacon does not override IT or security policies. It only formats and routes your request
            to the right team. For questions on what is allowed, ask Beacon about the relevant policy
            or contact IT / InfoSec.
          </div>
        </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-900">Request sent</h2>
            <p className="mt-2 text-sm text-gray-700">
              {result?.message ||
                'Your IT request has been submitted. The IT Service Desk will reach out.'}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              You&apos;ll also receive a copy of the request by email.
            </p>
            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={() => setShowSuccessModal(false)}>
                OK
              </Button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}
