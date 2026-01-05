'use client';

import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import { formatDate } from '@/lib/utils';

type View = 'form' | 'review';

export default function TravelDeskPage() {
  // Form state
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [grade, setGrade] = useState('');
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

  const canSubmit =
    name.trim() &&
    employeeId.trim() &&
    mobile.trim() &&
    email.trim() &&
    grade.trim() &&
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
      setError('Please fill the required fields (marked with *).');
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

      // Reset the form, return to form view, and show confirmation popup
      resetForm();
      setView('form');
      setShowSuccessModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit travel request');
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
      <div className="space-y-6">
        <div className="mb-2">
          <Link
            href="/"
            className="inline-flex items-center text-xs font-medium text-blue-700 hover:underline"
          >
            Back to Home
          </Link>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Beacon Travel Desk
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-gray-900">
              Raise a travel request without writing an email.
            </h1>
            <p className="text-sm text-gray-600">
              Fill the trip details and let Beacon prepare a clear, policy-aware request and an email
              draft for the travel desk and your manager.
            </p>
          </div>
        </div>

        <div className="max-w-4xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Name as per Govt ID <span className="text-red-500">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="As printed on passport / Govt ID"
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
              />
            </div>
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
      </div>
    );
  }

  // Review View
  if (view === 'review') {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Beacon Travel Desk
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-gray-900">
              Review your travel request
            </h1>
            <p className="text-sm text-gray-600">
              Please review the details below. Click Confirm to send the request to the Travel Desk.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-3xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="space-y-6">
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
                {isSubmitting ? 'Sending request...' : 'Confirm and send'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

