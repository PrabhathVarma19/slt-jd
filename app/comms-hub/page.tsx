'use client';

import { useState } from 'react';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import { CommsMode, CommsAudience, Formality } from '@/types/comms';

interface GeneratedOutput {
  subject: string;
  summary: string;
  sections: { heading: string; body: string }[];
  html_body: string;
  text_body: string;
}

const defaultNewsletterSections = [
  'Top Updates',
  'AI/Tech Highlights',
  'Company News',
  'Risks & Actions',
  'Upcoming Dates',
  'Resources & Links',
];

const defaultTeamSections = [
  'Context',
  "What’s changing",
  'Who is impacted',
  'When',
  'Actions required',
  'Contacts',
];

export default function CommsHubPage() {
  const [mode, setMode] = useState<CommsMode>('newsletter');
  const [audience, setAudience] = useState<CommsAudience>('org');
  const [formality, setFormality] = useState<Formality>('medium');
  const [subjectSeed, setSubjectSeed] = useState('');
  const [content, setContent] = useState('');
  const [keyDates, setKeyDates] = useState('');
  const [actionsRequired, setActionsRequired] = useState('');
  const [links, setLinks] = useState('');
  const [includeDeltas, setIncludeDeltas] = useState(false);
  const [sections, setSections] = useState<string[]>(defaultNewsletterSections);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<GeneratedOutput | null>(null);

  const toggleSection = (section: string) => {
    setSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const resetSections = (nextMode: CommsMode) => {
    setSections(nextMode === 'newsletter' ? defaultNewsletterSections : defaultTeamSections);
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('Please paste some content to generate comms.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setOutput(null);

    try {
      const response = await fetch('/api/comms-hub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          audience,
          formality,
          subject_seed: subjectSeed || undefined,
          content,
          key_dates: keyDates || undefined,
          actions_required: actionsRequired || undefined,
          links: links || undefined,
          sections,
          include_deltas: includeDeltas,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate comms');
      }

      const data = await response.json();
      setOutput(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate comms');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Comms Hub</p>
          <h1 className="text-2xl font-semibold text-gray-900">Generate newsletters or single-team emails.</h1>
          <p className="text-sm text-gray-600">
            Paste your updates, pick mode and audience, and get HTML + text outputs ready to send.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2 space-y-6">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Mode</label>
              <div className="flex flex-wrap gap-2">
                {(['newsletter', 'team'] as CommsMode[]).map((m) => (
                  <Button
                    key={m}
                    variant={mode === m ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => {
                      setMode(m);
                      resetSections(m);
                    }}
                  >
                    {m === 'newsletter' ? 'Newsletter' : 'Single Team Email'}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Audience</label>
              <div className="flex flex-wrap gap-2">
                {(['exec', 'org', 'team'] as CommsAudience[]).map((a) => (
                  <Button
                    key={a}
                    variant={audience === a ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setAudience(a)}
                  >
                    {a === 'exec' ? 'Exec/SLT' : a === 'org' ? 'Org-wide' : 'Team-level'}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Formality</label>
              <div className="flex flex-wrap gap-2">
                {(['low', 'medium', 'high'] as Formality[]).map((f) => (
                  <Button
                    key={f}
                    variant={formality === f ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setFormality(f)}
                  >
                    {f === 'low' ? 'Low' : f === 'high' ? 'High' : 'Medium'}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Include deltas vs last issue?</label>
              <div className="flex items-center gap-3">
                <Button
                  variant={includeDeltas ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setIncludeDeltas(true)}
                >
                  Yes
                </Button>
                <Button
                  variant={!includeDeltas ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setIncludeDeltas(false)}
                >
                  No
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Subject seed</label>
              <Input
                value={subjectSeed}
                onChange={(e) => setSubjectSeed(e.target.value)}
                placeholder="e.g., This week in AI @ Trianz"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Key dates</label>
              <Input
                value={keyDates}
                onChange={(e) => setKeyDates(e.target.value)}
                placeholder="e.g., Cutover on Jan 22"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Actions required</label>
              <Input
                value={actionsRequired}
                onChange={(e) => setActionsRequired(e.target.value)}
                placeholder="e.g., Update LinkedIn visibility; switch to Zoho Sign"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Links / resources</label>
              <Input
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                placeholder="e.g., policy link, how-to video"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Source content (paste consolidated updates)
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste the team updates or draft text here..."
              rows={12}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Sections</label>
            <div className="flex flex-wrap gap-2">
              {(mode === 'newsletter' ? defaultNewsletterSections : defaultTeamSections).map((sec) => (
                <Button
                  key={sec}
                  variant={sections.includes(sec) ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => toggleSection(sec)}
                >
                  {sec}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Generating...' : 'Generate Comms'}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Output</h2>
          {!output && <p className="mt-2 text-sm text-gray-600">Run a generation to see results.</p>}

          {output && (
            <div className="mt-4 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-wide text-blue-700 font-semibold">Subject</p>
                  <p className="text-base font-semibold text-gray-900">{output.subject || 'Untitled'}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => copyToClipboard(output.html_body)}>
                    Copy HTML
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => copyToClipboard(output.text_body)}>
                    Copy Text
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-blue-700 font-semibold">Summary</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{output.summary}</p>
              </div>

              <div className="space-y-4">
                {output.sections?.map((sec, idx) => (
                  <div key={idx} className="rounded-md border border-gray-200 p-4">
                    <h3 className="text-sm font-semibold text-gray-900">{sec.heading}</h3>
                    <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{sec.body}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-blue-700 font-semibold">HTML Preview</p>
                <div
                  className="prose prose-sm max-w-none border border-gray-200 rounded-md p-3 bg-gray-50"
                  dangerouslySetInnerHTML={{ __html: output.html_body || '<p>No HTML returned.</p>' }}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-blue-700 font-semibold">Plain Text</p>
                <pre className="whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
                  {output.text_body || 'No text returned.'}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
