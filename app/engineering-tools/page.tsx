'use client';

import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import Textarea from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  EngineeringToolType,
  EngineeringToolResponse,
  ReleaseNotesOutput,
  PRSummaryOutput,
  PostMortemOutput,
} from '@/types/engineering-tools';

const TOOL_TABS: Array<{ key: EngineeringToolType; label: string }> = [
  { key: 'release_notes', label: 'Release Notes' },
  { key: 'pr_summary', label: 'PR Summary + QA' },
  { key: 'post_mortem', label: 'Post-Mortem' },
];

const renderList = (items: string[]) => {
  if (!items || items.length === 0) return <p className="text-sm text-gray-600">None</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-gray-900">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
};

export default function EngineeringToolsPage() {
  const [activeTab, setActiveTab] = useState<EngineeringToolType>('release_notes');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<EngineeringToolResponse | null>(null);

  const [releaseName, setReleaseName] = useState('');
  const [releaseAudience, setReleaseAudience] = useState<'customer' | 'internal'>('internal');
  const [changeList, setChangeList] = useState('');
  const [knownIssues, setKnownIssues] = useState('');
  const [rollbackSteps, setRollbackSteps] = useState('');

  const [prTitle, setPrTitle] = useState('');
  const [prDescription, setPrDescription] = useState('');
  const [filesTouched, setFilesTouched] = useState('');
  const [keyDiffs, setKeyDiffs] = useState('');
  const [testsRun, setTestsRun] = useState('');

  const [incidentTitle, setIncidentTitle] = useState('');
  const [impact, setImpact] = useState('');
  const [timeline, setTimeline] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [mitigation, setMitigation] = useState('');
  const [preventiveActions, setPreventiveActions] = useState('');

  const handleGenerate = async () => {
    setError(null);
    setOutput(null);

    if (activeTab === 'release_notes' && !changeList.trim()) {
      setError('Please paste the change list.');
      return;
    }
    if (activeTab === 'pr_summary' && !prTitle.trim()) {
      setError('Please add a PR title.');
      return;
    }
    if (activeTab === 'post_mortem' && (!incidentTitle.trim() || !timeline.trim())) {
      setError('Please add an incident title and timeline.');
      return;
    }

    setLoading(true);
    try {
      const payload =
        activeTab === 'release_notes'
          ? {
              tool: 'release_notes',
              release_name: releaseName,
              audience: releaseAudience,
              change_list: changeList,
              known_issues: knownIssues || undefined,
              rollback_steps: rollbackSteps || undefined,
            }
          : activeTab === 'pr_summary'
            ? {
                tool: 'pr_summary',
                pr_title: prTitle,
                pr_description: prDescription,
                files_touched: filesTouched,
                key_diffs: keyDiffs || undefined,
                tests_run: testsRun || undefined,
              }
            : {
                tool: 'post_mortem',
                incident_title: incidentTitle,
                impact,
                timeline,
                root_cause: rootCause || undefined,
                mitigation,
                preventive_actions: preventiveActions || undefined,
              };

      const response = await fetch('/api/engineering-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate output');
      }

      const data = await response.json();
      setOutput(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate output');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Beacon · Engineering Tools</p>
        <h1 className="text-2xl font-semibold text-gray-900">Release notes, PR summaries, and post-mortems.</h1>
        <p className="text-sm text-gray-600">
          Manual input for now. Integrations can be added later.
        </p>
      </div>

      <div>
        <Link href="/" className="text-xs text-blue-600 hover:underline">
          ← Back to Home
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {TOOL_TABS.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => {
              setActiveTab(tab.key);
              setOutput(null);
              setError(null);
            }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeTab === 'release_notes' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Release name / version</label>
                  <Input
                    value={releaseName}
                    onChange={(e) => setReleaseName(e.target.value)}
                    placeholder="e.g., Sprint 24.6 / v2.3"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Audience</label>
                  <div className="flex flex-wrap gap-2">
                    {(['internal', 'customer'] as const).map((value) => (
                      <Button
                        key={value}
                        variant={releaseAudience === value ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setReleaseAudience(value)}
                      >
                        {value === 'internal' ? 'Internal' : 'Customer'}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Change list</label>
                  <Textarea
                    value={changeList}
                    onChange={(e) => setChangeList(e.target.value)}
                    placeholder="Paste PRs, tickets, or bullet points"
                    rows={6}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Known issues (optional)</label>
                  <Textarea
                    value={knownIssues}
                    onChange={(e) => setKnownIssues(e.target.value)}
                    placeholder="List any known issues"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Rollback steps (optional)</label>
                  <Textarea
                    value={rollbackSteps}
                    onChange={(e) => setRollbackSteps(e.target.value)}
                    placeholder="Provide rollback steps if needed"
                    rows={3}
                  />
                </div>
              </>
            )}

            {activeTab === 'pr_summary' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">PR title</label>
                  <Input
                    value={prTitle}
                    onChange={(e) => setPrTitle(e.target.value)}
                    placeholder="e.g., Add MFA prompt to login flow"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">PR description</label>
                  <Textarea
                    value={prDescription}
                    onChange={(e) => setPrDescription(e.target.value)}
                    placeholder="Paste the PR description"
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Files touched</label>
                  <Textarea
                    value={filesTouched}
                    onChange={(e) => setFilesTouched(e.target.value)}
                    placeholder="Paste file list"
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Key diffs (optional)</label>
                  <Textarea
                    value={keyDiffs}
                    onChange={(e) => setKeyDiffs(e.target.value)}
                    placeholder="Paste diff summary or highlights"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Tests run (optional)</label>
                  <Textarea
                    value={testsRun}
                    onChange={(e) => setTestsRun(e.target.value)}
                    placeholder="Unit / integration / e2e"
                    rows={3}
                  />
                </div>
              </>
            )}

            {activeTab === 'post_mortem' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Incident title</label>
                  <Input
                    value={incidentTitle}
                    onChange={(e) => setIncidentTitle(e.target.value)}
                    placeholder="e.g., VPN outage for remote employees"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Impact</label>
                  <Input
                    value={impact}
                    onChange={(e) => setImpact(e.target.value)}
                    placeholder="Who/what was impacted"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Timeline</label>
                  <Textarea
                    value={timeline}
                    onChange={(e) => setTimeline(e.target.value)}
                    placeholder="Paste timeline events, one per line"
                    rows={5}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Root cause (optional)</label>
                  <Textarea
                    value={rootCause}
                    onChange={(e) => setRootCause(e.target.value)}
                    placeholder="If known, add root cause"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Mitigation / resolution</label>
                  <Textarea
                    value={mitigation}
                    onChange={(e) => setMitigation(e.target.value)}
                    placeholder="What actions resolved the incident?"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Preventive actions (optional)</label>
                  <Textarea
                    value={preventiveActions}
                    onChange={(e) => setPreventiveActions(e.target.value)}
                    placeholder="Future prevention steps"
                    rows={3}
                  />
                </div>
              </>
            )}

            <Button onClick={handleGenerate} disabled={loading}>
              {loading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Generating...
                </>
              ) : (
                'Generate'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Output</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!output && (
              <p className="text-sm text-gray-600">
                Generate an output to preview results.
              </p>
            )}

            {output?.tool === 'release_notes' && (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Headline</p>
                  <p className="text-sm text-gray-900">{output.output.headline}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Highlights</p>
                  {renderList((output.output as ReleaseNotesOutput).highlights)}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Improvements</p>
                  {renderList((output.output as ReleaseNotesOutput).improvements)}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fixes</p>
                  {renderList((output.output as ReleaseNotesOutput).fixes)}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Known Issues</p>
                  {renderList((output.output as ReleaseNotesOutput).known_issues)}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rollbacks</p>
                  {renderList((output.output as ReleaseNotesOutput).rollbacks)}
                </div>
              </>
            )}

            {output?.tool === 'pr_summary' && (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Summary</p>
                  <p className="text-sm text-gray-900">{(output.output as PRSummaryOutput).summary}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Risk Level</p>
                  <p className="text-sm text-gray-900">{(output.output as PRSummaryOutput).risk_level}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Risk Areas</p>
                  {renderList((output.output as PRSummaryOutput).risk_areas)}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Suggested Tests</p>
                  {renderList((output.output as PRSummaryOutput).suggested_tests)}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">QA Checklist</p>
                  {renderList((output.output as PRSummaryOutput).qa_checklist)}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rollback Notes</p>
                  {renderList((output.output as PRSummaryOutput).rollback_notes)}
                </div>
              </>
            )}

            {output?.tool === 'post_mortem' && (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Summary</p>
                  <p className="text-sm text-gray-900">{(output.output as PostMortemOutput).summary}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Impact</p>
                  <p className="text-sm text-gray-900">{(output.output as PostMortemOutput).impact}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Timeline</p>
                  {renderList((output.output as PostMortemOutput).timeline)}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Root Cause</p>
                  <p className="text-sm text-gray-900">{(output.output as PostMortemOutput).root_cause}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resolution</p>
                  <p className="text-sm text-gray-900">{(output.output as PostMortemOutput).resolution}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Follow-up Actions</p>
                  {renderList((output.output as PostMortemOutput).follow_up_actions)}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Lessons Learned</p>
                  {renderList((output.output as PostMortemOutput).lessons_learned)}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
