'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import { formatDate } from '@/lib/utils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { BackToHome } from '@/components/ui/back-to-home';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/lib/hooks/useToast';

type View = 'form' | 'review';

export default function TravelDeskPage() {
  // Form state
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [grade, setGrade] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [projectName, setProjectName] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departDate, setDepartDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [isOneWay, setIsOneWay] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [modePreference, setModePreference] = useState('');
  const [extraDetails, setExtraDetails] = useState('');

  // UI state
  const [view, setView] = useState<View>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSubmitAt, setLastSubmitAt] = useState<string | null>(null);
  const [lastSubmitOutcome, setLastSubmitOutcome] = useState<'success' | 'error' | null>(null);
  const [isEditingUserInfo, setIsEditingUserInfo] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [userProjects, setUserProjects] = useState<Array<{ code: string; name: string }>>([]);
  const { showToast, ToastContainer } = useToast();

  // Fetch user profile and auto-fill form
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
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
              setProjectCode(projects[0].code);
              setProjectName(projects[0].name);
            }

            setName(profile.empName || name);
            setEmployeeId(profile.employeeId?.toString() || employeeId);
            setEmail(data.user.email || email);
            setGrade(profile.gradeCode || grade);
          } else if (data.user?.email) {
            // Even without profile, we have email from session
            setEmail(data.user.email || email);
          }
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit =
    name.trim() &&
    employeeId.trim() &&
    mobile.trim() &&
    email.trim() &&
    grade.trim() &&
    (userProjects.length <= 1 || projectCode.trim()) && // Project required if multiple projects
    origin.trim() &&
    destination.trim() &&
    departDate.trim() &&
    purpose.trim();

  const resetForm = () => {
    setName('');
    setEmployeeId('');
    setMobile('');
    setEmail('');
    setGrade('');
    setProjectCode('');
    setProjectName('');
    setOrigin('');
    setDestination('');
    setDepartDate('');
    setReturnDate('');
    setIsOneWay(false);
    setPurpose('');
    setModePreference('');
    setExtraDetails('');
    setError(null);
    setSubmitMessage(null);
  };

  const handlePrepareRequest = () => {
    if (!canSubmit) {
      if (userProjects.length > 1 && !projectCode.trim()) {
        setError('Please select a project code.');
      } else {
        setError('Please fill the required fields (marked with *).');
      }
      return;
    }
    setError(null);
    setView('review');
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    setSubmitMessage(null);

    try {
      const res = await fetch('/api/actions/travel-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          employeeId,
          mobile,
          email,
          grade,
          origin,
          destination,
          departDate,
          returnDate: isOneWay ? null : returnDate || null,
          isOneWay,
          purpose,
          modePreference: modePreference || null,
          extraDetails: extraDetails || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to submit travel request');
      }

      setSubmitMessage(data.message || 'Travel request emailed to the Travel Desk.');
      setLastSubmitAt(
        new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      );
      setLastSubmitOutcome('success');
      showToast('Travel request emailed to Travel Desk. A copy was sent to you.', 'success');

      // Reset the form, return to form view, and show confirmation popup
      resetForm();
      setView('form');
      setShowSuccessModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit travel request');
      setLastSubmitAt(
        new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      );
      setLastSubmitOutcome('error');
      showToast('Could not send request. Check VPN or try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateDisplay = (dateString: string) => {
    if (!dateString) return '';
    try {
      return formatDate(dateString);
    } catch {
      return dateString;
    }
  };

  // Form View
  if (view === 'form') {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-4 space-y-6">
        <div className="grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-1">
          <BackToHome label="" className="mt-1 text-xs" />
          <h1 className="text-2xl font-semibold text-slate-900">Travel Desk</h1>
          <p className="col-start-2 text-sm text-slate-600">
            Prepare and send structured travel requests. Beacon formats your ask into a clear email.
            </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* Left: form */}
          <Card>
          <CardHeader>
            <CardTitle>Travel Desk</CardTitle>
            <CardDescription>
              Prepare and send structured travel requests; Beacon helps summarise and format your ask.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Employee Information
              </p>
              {!isEditingUserInfo && (name || email) && (
                <button
                  type="button"
                  onClick={() => setIsEditingUserInfo(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Name as per Govt ID <span className="text-red-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="As printed on passport / Govt ID"
                disabled={!isEditingUserInfo && !!name}
                className={!isEditingUserInfo && name ? 'bg-gray-50' : ''}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Employee ID <span className="text-red-500">*</span>
              </label>
              <Input
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g., 12345"
                disabled={!isEditingUserInfo && !!employeeId}
                className={!isEditingUserInfo && employeeId ? 'bg-gray-50' : ''}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Mobile number <span className="text-red-500">*</span>
              </label>
              <Input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="e.g., +91-9876543210"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium text-gray-700">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@trianz.com"
                disabled={!isEditingUserInfo && !!email}
                className={!isEditingUserInfo && email ? 'bg-gray-50' : ''}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Grade <span className="text-red-500">*</span>
              </label>
              <Input
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="e.g., 5, 7, 9"
                disabled={!isEditingUserInfo && !!grade}
                className={!isEditingUserInfo && grade ? 'bg-gray-50' : ''}
              />
            </div>
            {isEditingUserInfo && (
              <div className="sm:col-span-3">
                <button
                  type="button"
                  onClick={() => setIsEditingUserInfo(false)}
                  className="text-xs text-gray-600 hover:text-gray-700 hover:underline"
                >
                  Cancel editing
                </button>
              </div>
            )}
          </div>

          {userProjects.length > 1 && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Project Code <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                value={projectCode}
                onChange={(e) => {
                  const selected = userProjects.find(p => p.code === e.target.value);
                  setProjectCode(e.target.value);
                  setProjectName(selected?.name || '');
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
              <p className="text-xs text-gray-500">
                Select which project this request is for
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Onward from (city) <span className="text-red-500">*</span>
              </label>
              <Input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g., Bangalore"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Destination city <span className="text-red-500">*</span>
              </label>
              <Input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g., Dubai"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Onward date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={departDate}
                onChange={(e) => setDepartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Return date</label>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-gray-300"
                    checked={isOneWay}
                    onChange={(e) => setIsOneWay(e.target.checked)}
                  />
                  One-way (no return yet)
                </label>
              </div>
              {!isOneWay && (
                <Input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  min={departDate || new Date().toISOString().split('T')[0]}
                />
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Purpose of travel <span className="text-red-500">*</span>
            </label>
            <Textarea
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g., Client presentation, internal workshop, implementation go-live, etc."
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Preferred mode (optional)</label>
            <Input
              value={modePreference}
              onChange={(e) => setModePreference(e.target.value)}
              placeholder="e.g., Air, Rail (overnight train), Road"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Additional details (optional)
            </label>
            <Textarea
              rows={3}
              value={extraDetails}
              onChange={(e) => setExtraDetails(e.target.value)}
              placeholder="Any constraints, client SLAs, cost considerations, or approvals already taken."
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handlePrepareRequest} disabled={!canSubmit}>
              Prepare travel request
            </Button>
            </div>
          </CardContent>
        </Card>

          {/* Right: status & guidance */}
          <div className="space-y-4">
            <div className="bg-card rounded-3xl shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">What happens next</h2>
              <p className="text-sm text-slate-600">
                Beacon formats your travel request and emails it to the Travel Desk. You are CC&apos;d on the email.
              </p>
            </div>
            <div className="bg-card rounded-3xl shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">Submission status</h2>
              {!lastSubmitAt && (
                <p className="text-sm text-slate-600">No requests sent from this page yet.</p>
              )}
              {lastSubmitAt && (
                <div className="space-y-1 text-sm">
                  <p className="text-slate-700">
                    Last submission: <span className="font-medium text-slate-900">{lastSubmitAt}</span>
                  </p>
                  {lastSubmitOutcome === 'success' && (
                    <p className="text-green-700">Last travel request sent successfully.</p>
                  )}
                  {lastSubmitOutcome === 'error' && (
                    <p className="text-red-700">Last attempt failed. Please try again.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {showSuccessModal && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
              <h2 className="text-lg font-semibold text-gray-900">Travel request submitted!</h2>
              <p className="mt-2 text-sm text-gray-700">
                {submitMessage || 'Your travel request has been sent to the Travel Desk.'}
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

  // Review View
  if (view === 'review') {
    return (
      <div className="mx-auto w-full max-w-screen-2xl px-4 py-4 space-y-6">
        <div className="grid grid-cols-[auto_1fr] items-start gap-x-2 gap-y-1">
          <BackToHome label="" className="mt-1 text-xs" />
          <h1 className="text-2xl font-semibold text-slate-900">Review travel request</h1>
          <p className="col-start-2 text-sm text-slate-600">
              Please review the details below. Click Confirm to send the request to the Travel Desk.
            </p>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Review your travel request</CardTitle>
              <CardDescription>
                Please review the details below. Click Confirm to send the request to the Travel Desk.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
          {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

            {/* Employee Details */}
            <div className="space-y-3">
              <h2 className="border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
                Employee details
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Name as per Govt ID
                  </p>
                  <p className="mt-1 text-sm text-gray-900">{name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Employee ID
                  </p>
                  <p className="mt-1 text-sm text-gray-900">{employeeId}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Mobile</p>
                  <p className="mt-1 text-sm text-gray-900">{mobile}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Email</p>
                  <p className="mt-1 text-sm text-gray-900">{email}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Grade</p>
                  <p className="mt-1 text-sm text-gray-900">{grade}</p>
                </div>
              </div>
            </div>

            {/* Trip Details */}
            <div className="space-y-3">
              <h2 className="border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
                Trip details
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Origin</p>
                  <p className="mt-1 text-sm text-gray-900">{origin}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Destination
                  </p>
                  <p className="mt-1 text-sm text-gray-900">{destination}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Departure date
                  </p>
                  <p className="mt-1 text-sm text-gray-900">{formatDateDisplay(departDate)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Return date
                  </p>
                  <p className="mt-1 text-sm text-gray-900">
                    {isOneWay ? (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        One-way trip
                      </span>
                    ) : returnDate ? (
                      formatDateDisplay(returnDate)
                    ) : (
                      'Not specified'
                    )}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Purpose
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{purpose}</p>
                </div>
              </div>
            </div>

            {/* Additional Information */}
            {(modePreference || extraDetails) && (
              <div className="space-y-3">
                <h2 className="border-b border-gray-200 pb-2 text-lg font-semibold text-gray-900">
                  Additional information
                </h2>
                {modePreference && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Preferred mode
                    </p>
                    <p className="mt-1 text-sm text-gray-900">{modePreference}</p>
                  </div>
                )}
                {extraDetails && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Additional details
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">
                      {extraDetails}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 border-t border-gray-200 pt-4">
              <Button variant="secondary" onClick={() => setView('form')} disabled={isSubmitting}>
                Back
              </Button>
              <Button onClick={handleConfirm} disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    Submitting...
                  </span>
                ) : (
                  'Confirm and send'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

          <div className="space-y-4">
            <div className="bg-card rounded-3xl shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">Submission status</h2>
              {!lastSubmitAt && (
                <p className="text-sm text-slate-600">No requests sent from this page yet.</p>
              )}
              {lastSubmitAt && (
                <div className="space-y-1 text-sm">
                  <p className="text-slate-700">
                    Last submission: <span className="font-medium text-slate-900">{lastSubmitAt}</span>
                  </p>
                  {lastSubmitOutcome === 'success' && (
                    <p className="text-green-700">Last travel request sent successfully.</p>
                  )}
                  {lastSubmitOutcome === 'error' && (
                    <p className="text-red-700">Last attempt failed. Please try again.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <ToastContainer />
      </div>
    );
  }

  return null;
}

