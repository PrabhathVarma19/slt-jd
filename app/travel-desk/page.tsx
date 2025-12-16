'use client';

import { useState } from 'react';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';

interface TravelDeskResponse {
  summary: string;
  emailBody: string;
  policyNotes: string;
}

export default function TravelDeskPage() {
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

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TravelDeskResponse | null>(null);

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

  const handleGenerate = async () => {
    if (!canSubmit) {
      setError('Please fill the required fields (marked with *).');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/travel-desk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          employeeId,
          mobile,
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
        throw new Error(data.error || 'Failed to generate travel request');
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate travel request');
    } finally {
      setIsLoading(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore copy failures
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Travel Desk</p>
          <h1 className="text-2xl font-semibold text-gray-900">
            Raise a travel request without writing an email.
          </h1>
          <p className="text-sm text-gray-600">
            Fill the trip details and let Beacon prepare a clear, policy-aware request and an email draft for the travel desk and your manager.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
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
            <div className="space-y-1 sm:col-span-1">
              <label className="text-sm font-medium text-gray-700">
                Grade <span className="text-red-500">*</span>
              </label>
              <Input
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="e.g., 5, 7, 9"
              />
            </div>
            <div className="space-y-1 sm:col-span-1">
              <label className="text-sm font-medium text-gray-700">
                Onward from (city) <span className="text-red-500">*</span>
              </label>
              <Input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g., Bangalore"
              />
            </div>
            <div className="space-y-1 sm:col-span-1">
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
              placeholder="e.g., Client presentation for XYZ, internal workshop, implementation go-live, etc."
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
            <label className="text-sm font-medium text-gray-700">Additional details (optional)</label>
            <Textarea
              rows={3}
              value={extraDetails}
              onChange={(e) => setExtraDetails(e.target.value)}
              placeholder="Any constraints, client SLAs, cost considerations, or approvals already taken."
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleGenerate} disabled={isLoading || !canSubmit}>
              {isLoading ? 'Preparing request...' : 'Prepare travel request'}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Output</h2>
          {!result && (
            <p className="text-sm text-gray-600">
              Fill the form and click &quot;Prepare travel request&quot; to see the summary, policy notes, and email draft.
            </p>
          )}
          {result && (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Summary</span>
                  <Button size="sm" variant="secondary" onClick={() => copyText(result.summary)}>
                    Copy summary
                  </Button>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{result.summary}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Policy check</span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {result.policyNotes || 'No specific policy constraints detected for this request.'}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Email draft</span>
                  <Button size="sm" variant="secondary" onClick={() => copyText(result.emailBody)}>
                    Copy email
                  </Button>
                </div>
                <Textarea
                  readOnly
                  rows={8}
                  className="text-sm text-gray-800"
                  value={result.emailBody}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
