'use client';

import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import { CommsMode, CommsAudience, Formality, CommsTemplate } from '@/types/comms';
import { CommsAgentMode, CommsAgentAudience, CommsAgentTone, CommsAgentResponse } from '@/types/comms-agent';
import { Spinner } from '@/components/ui/spinner';

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
  "What's changing",
  'Who is impacted',
  'When',
  'Actions required',
  'Contacts',
];

const defaultChangeNoticeNewsletter = [
  'Topline summary',
  "What's changing",
  'Impact',
  'Actions required',
  'Key dates',
  'Links/Resources',
  'Contacts',
];

const defaultChangeNoticeTeam = [
  'Context',
  "What's changing",
  'Impacted teams/systems',
  'When',
  'Actions required',
  'Links/Resources',
  'Contacts',
];

const defaultAwarenessNewsletter = [
  'Theme',
  'Threat overview',
  'Why it matters',
  'Do',
  "Don’t",
  'Verification steps',
  'Report & Contacts',
  'Resources',
];

const defaultAwarenessTeam = [
  'Theme',
  'What to watch for',
  'Do',
  "Don’t",
  'How to verify',
  'Report & Contacts',
  'Resources',
];

const getDefaultSections = (mode: CommsMode, template: CommsTemplate) => {
  if (template === 'change_notice') {
    return mode === 'newsletter' ? defaultChangeNoticeNewsletter : defaultChangeNoticeTeam;
  }
   if (template === 'awareness') {
    return mode === 'newsletter' ? defaultAwarenessNewsletter : defaultAwarenessTeam;
  }
  return mode === 'newsletter' ? defaultNewsletterSections : defaultTeamSections;
};

export default function CommsHubPage() {
  const [mode, setMode] = useState<CommsMode>('newsletter');
  const [template, setTemplate] = useState<CommsTemplate>('default');
  const [audience, setAudience] = useState<CommsAudience>('org');
  const [formality, setFormality] = useState<Formality>('medium');
  const [subjectSeed, setSubjectSeed] = useState('');
  const [content, setContent] = useState('');
  const [keyDates, setKeyDates] = useState('');
  const [actionsRequired, setActionsRequired] = useState('');
  const [links, setLinks] = useState('');
  const [includeLinks, setIncludeLinks] = useState(true);
  const [includeSectionHeaders, setIncludeSectionHeaders] = useState(true);
  const [includeDeltas, setIncludeDeltas] = useState(false);
  const [sections, setSections] = useState<string[]>(getDefaultSections('newsletter', 'default'));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<GeneratedOutput | null>(null);
  const [agentMode, setAgentMode] = useState<CommsAgentMode>('incident_update');
  const [agentAudience, setAgentAudience] = useState<CommsAgentAudience>('org');
  const [agentTone, setAgentTone] = useState<CommsAgentTone>('neutral');
  const [ticketId, setTicketId] = useState('');
  const [incidentTitle, setIncidentTitle] = useState('');
  const [impact, setImpact] = useState('');
  const [eta, setEta] = useState('');
  const [context, setContext] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [agentOutput, setAgentOutput] = useState<CommsAgentResponse | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'agent' | 'builder'>('agent');

  const toggleSection = (section: string) => {
    setSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
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
          template,
          audience,
          formality,
          subject_seed: subjectSeed || undefined,
          content,
          key_dates: keyDates || undefined,
          actions_required: actionsRequired || undefined,
          links: links || undefined,
          include_links: includeLinks,
          include_section_headers: includeSectionHeaders,
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

  const handleAgentSubmit = async () => {
    setAgentError(null);
    setAgentOutput(null);
    if (agentMode === 'incident_update' && !incidentTitle.trim() && !context.trim()) {
      setAgentError('Add at least an incident title or context.');
      return;
    }
    if (agentMode === 'reply_assistant' && !emailContent.trim()) {
      setAgentError('Paste the email content first.');
      return;
    }
    setAgentLoading(true);
    try {
      const response = await fetch('/api/comms-hub/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: agentMode,
          tone: agentTone,
          audience: agentMode === 'incident_update' ? agentAudience : undefined,
          ticketId: ticketId || undefined,
          title: incidentTitle || undefined,
          impact: impact || undefined,
          eta: eta || undefined,
          context: context || undefined,
          emailContent: emailContent || undefined,
          desiredOutcome: desiredOutcome || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate comms');
      }
      const data = await response.json();
      setAgentOutput(data);
    } catch (err: any) {
      setAgentError(err.message || 'Failed to generate comms');
    } finally {
      setAgentLoading(false);
    }
  };

  const openInOutlookDraft = (subject: string, body: string) => {
    const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Beacon · Comms Hub</p>
          <h1 className="text-2xl font-semibold text-gray-900 mt-1">Generate newsletters or single-team emails.</h1>
          <p className="text-sm text-gray-600">
            Paste your updates, pick mode and audience, and get HTML + text outputs ready to send.
          </p>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="mb-2">
          <Link
            href="/"
            className="inline-flex items-center text-xs font-medium text-blue-700 hover:underline"
          >
            ← Back to Home
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={activePanel === 'agent' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActivePanel('agent')}
          >
            Comms Agent
          </Button>
          <Button
            variant={activePanel === 'builder' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActivePanel('builder')}
          >
            Comms Builder
          </Button>
        </div>
        {activePanel === 'agent' && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Comms Agent</p>
              <h2 className="text-lg font-semibold text-gray-900">Incident updates & reply assistant</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={agentMode === 'incident_update' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setAgentMode('incident_update')}
              >
                Incident update
              </Button>
              <Button
                variant={agentMode === 'reply_assistant' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setAgentMode('reply_assistant')}
              >
                Reply assistant
              </Button>
            </div>
          </div>

          {agentError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {agentError}
            </div>
          )}

          {agentMode === 'incident_update' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Ticket ID (optional)</label>
                <Input
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  placeholder="UUID from ticket"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Audience</label>
                <div className="flex flex-wrap gap-2">
                  {(['org', 'team', 'exec'] as CommsAgentAudience[]).map((value) => (
                    <Button
                      key={value}
                      variant={agentAudience === value ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => setAgentAudience(value)}
                    >
                      {value.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Incident title</label>
                <Input
                  value={incidentTitle}
                  onChange={(e) => setIncidentTitle(e.target.value)}
                  placeholder="Short summary of the incident"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Impact</label>
                <Input
                  value={impact}
                  onChange={(e) => setImpact(e.target.value)}
                  placeholder="Who/what is impacted"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">ETA / Next update</label>
                <Input
                  value={eta}
                  onChange={(e) => setEta(e.target.value)}
                  placeholder="Example: Next update in 30 mins"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Additional context</label>
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="What happened, workaround, or details to include"
                  rows={4}
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Email content</label>
                <Textarea
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                  placeholder="Paste the email you received"
                  rows={6}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Desired outcome</label>
                <Input
                  value={desiredOutcome}
                  onChange={(e) => setDesiredOutcome(e.target.value)}
                  placeholder="What should the reply achieve?"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600">Tone</span>
            {(['neutral', 'formal', 'casual', 'executive'] as CommsAgentTone[]).map((value) => (
              <Button
                key={value}
                variant={agentTone === value ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setAgentTone(value)}
              >
                {value}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleAgentSubmit} disabled={agentLoading}>
              {agentLoading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Generating...
                </>
              ) : (
                'Generate draft'
              )}
            </Button>
            {agentOutput && (
              <Button
                variant="secondary"
                onClick={() => openInOutlookDraft(agentOutput.subject, agentOutput.body)}
              >
                Open in Outlook
              </Button>
            )}
          </div>

          {agentOutput && (
            <div className="grid gap-4 rounded-lg border border-gray-200 bg-slate-50 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Subject</p>
                <p className="text-sm text-gray-900">{agentOutput.subject}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Summary</p>
                <p className="text-sm text-gray-900">{agentOutput.summary}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Draft</p>
                <pre className="whitespace-pre-wrap text-sm text-gray-900">{agentOutput.body}</pre>
              </div>
              {agentOutput.followUpQuestions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Follow-up questions</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-gray-900">
                    {agentOutput.followUpQuestions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          </div>
        )}
        {activePanel === 'builder' && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-6">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Template</label>
              <div className="flex flex-wrap gap-2">
                {(['default', 'change_notice', 'awareness'] as CommsTemplate[]).map((t) => (
                  <Button
                    key={t}
                    variant={template === t ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => {
                      setTemplate(t);
                      setSections(getDefaultSections(mode, t));
                    }}
                  >
                    {t === 'default' ? 'Default' : t === 'change_notice' ? 'Change Notice' : 'Awareness'}
                  </Button>
                ))}
              </div>
            </div>

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
                      setSections(getDefaultSections(m, template));
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
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Include links in outputs?</label>
              <div className="flex items-center gap-3">
                <Button
                  variant={includeLinks ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setIncludeLinks(true)}
                  >
                    Yes
                  </Button>
                <Button
                  variant={!includeLinks ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setIncludeLinks(false)}
                  >
                    No
                  </Button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Include section headers in outputs?</label>
              <div className="flex items-center gap-3">
                <Button
                  variant={includeSectionHeaders ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setIncludeSectionHeaders(true)}
                >
                  Yes
                </Button>
                <Button
                  variant={!includeSectionHeaders ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setIncludeSectionHeaders(false)}
                >
                  No
                </Button>
              </div>
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
              {getDefaultSections(mode, template).map((sec) => (
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
                {links && (
                  <div className="rounded-md border border-gray-200 p-4">
                    <h3 className="text-sm font-semibold text-gray-900">Links / Resources</h3>
                    <ul className="mt-2 space-y-1">
                      {links
                        .split('\n')
                        .map((l) => l.trim())
                        .filter(Boolean)
                        .map((l, idx) => {
                          const isUrl = /^https?:\/\//i.test(l);
                          return (
                            <li key={idx} className="text-sm text-gray-700 break-words">
                              {isUrl ? (
                                <a
                                  className="text-blue-700 hover:underline"
                                  href={l}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {l}
                                </a>
                              ) : (
                                l
                              )}
                            </li>
                          );
                        })}
                    </ul>
                  </div>
                )}
                {output.sections
                  ?.filter((sec) => (sec.heading && sec.heading.trim()) || (sec.body && sec.body.trim()))
                  .map((sec, idx) => {
                    const cleanHeading = sec.heading ? sec.heading.replace(/[:\s]+$/, '') : '';
                    return (
                      <div key={idx} className="rounded-md border border-gray-200 p-4">
                        {cleanHeading && (
                          <h3 className="text-sm font-semibold text-gray-900">{cleanHeading}</h3>
                        )}
                        {sec.body && (
                          <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{sec.body}</p>
                        )}
                      </div>
                    );
                  })}
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
