'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Button from '@/components/ui/button';
import { BackToHome } from '@/components/ui/back-to-home';
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

const RELEASE_TEMPLATES = ['Trianz Standard', 'Customer Safe', 'Technical Internal'] as const;
const PR_TEMPLATES = ['Reviewer Checklist', 'QA Focus', 'Exec Summary'] as const;
const POSTMORTEM_TEMPLATES = ['SRE Standard', 'Short', 'Detailed RCA'] as const;

type DraftHistoryItem = {
  id: string;
  tool: EngineeringToolType;
  createdAt: string;
  input: Record<string, string>;
  output: EngineeringToolResponse;
};

type PresetItem = {
  id: string;
  tool: EngineeringToolType;
  name: string;
  data: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

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

const detectRiskAreas = (filesTouched: string) => {
  const flags: string[] = [];
  const lower = filesTouched.toLowerCase();
  if (/(auth|login|sso|oauth|session)/.test(lower)) flags.push('Authentication');
  if (/(billing|payment|invoice|stripe|charge)/.test(lower)) flags.push('Billing/Payments');
  if (/(db|database|migration|schema|sql)/.test(lower)) flags.push('Data/Schema');
  if (/(infra|k8s|terraform|cloud|aws|azure|gcp)/.test(lower)) flags.push('Infrastructure');
  if (/(security|acl|permission|rbac|policy)/.test(lower)) flags.push('Security/Access');
  if (/(api|route|endpoint|controller)/.test(lower)) flags.push('API Surface');
  return flags;
};

const markdownList = (items: string[]) =>
  items && items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '- None';

const buildMarkdown = (response: EngineeringToolResponse) => {
  if (response.tool === 'release_notes') {
    const output = response.output as ReleaseNotesOutput;
    return [
      `# ${output.headline || 'Release Notes'}`,
      '',
      '## Highlights',
      markdownList(output.highlights),
      '',
      '## Improvements',
      markdownList(output.improvements),
      '',
      '## Fixes',
      markdownList(output.fixes),
      '',
      '## Known Issues',
      markdownList(output.known_issues),
      '',
      '## Rollbacks / Workarounds',
      markdownList(output.rollbacks),
    ].join('\n');
  }
  if (response.tool === 'pr_summary') {
    const output = response.output as PRSummaryOutput;
    return [
      `# PR Summary`,
      '',
      `**Risk Level:** ${output.risk_level}`,
      '',
      '## Summary',
      output.summary || 'None',
      '',
      '## Risk Areas',
      markdownList(output.risk_areas),
      '',
      '## Suggested Tests',
      markdownList(output.suggested_tests),
      '',
      '## QA Checklist',
      markdownList(output.qa_checklist),
      '',
      '## Rollback Notes',
      markdownList(output.rollback_notes),
    ].join('\n');
  }
  const output = response.output as PostMortemOutput;
  return [
    `# Post-Mortem`,
    '',
    '## Summary',
    output.summary || 'None',
    '',
    '## Impact',
    output.impact || 'None',
    '',
    '## Timeline',
    markdownList(output.timeline),
    '',
    '## Root Cause',
    output.root_cause || 'Under investigation',
    '',
    '## Resolution',
    output.resolution || 'None',
    '',
    '## Follow-up Actions',
    markdownList(output.follow_up_actions),
    '',
    '## Lessons Learned',
    markdownList(output.lessons_learned),
  ].join('\n');
};

function EngineeringToolsContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<EngineeringToolType>('release_notes');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<EngineeringToolResponse | null>(null);
  const [history, setHistory] = useState<DraftHistoryItem[]>([]);
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [releaseName, setReleaseName] = useState('');
  const [releaseAudience, setReleaseAudience] = useState<'customer' | 'internal'>('internal');
  const [changeList, setChangeList] = useState('');
  const [knownIssues, setKnownIssues] = useState('');
  const [rollbackSteps, setRollbackSteps] = useState('');
  const [releaseTemplate, setReleaseTemplate] =
    useState<(typeof RELEASE_TEMPLATES)[number]>(RELEASE_TEMPLATES[0]);

  const [prTitle, setPrTitle] = useState('');
  const [prDescription, setPrDescription] = useState('');
  const [filesTouched, setFilesTouched] = useState('');
  const [keyDiffs, setKeyDiffs] = useState('');
  const [testsRun, setTestsRun] = useState('');
  const [prTemplate, setPrTemplate] =
    useState<(typeof PR_TEMPLATES)[number]>(PR_TEMPLATES[0]);

  const [incidentTitle, setIncidentTitle] = useState('');
  const [impact, setImpact] = useState('');
  const [timeline, setTimeline] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [mitigation, setMitigation] = useState('');
  const [preventiveActions, setPreventiveActions] = useState('');
  const [postMortemTemplate, setPostMortemTemplate] =
    useState<(typeof POSTMORTEM_TEMPLATES)[number]>(POSTMORTEM_TEMPLATES[0]);
  const autoRunTriggeredRef = useRef(false);
  const [handoffReady, setHandoffReady] = useState(false);

  const updateReleaseOutput = (
    updater: (current: ReleaseNotesOutput) => ReleaseNotesOutput
  ) => {
    setOutput((prev) => {
      if (!prev || prev.tool !== 'release_notes') return prev;
      return {
        ...prev,
        output: updater(prev.output as ReleaseNotesOutput),
      };
    });
  };

  const updatePrOutput = (updater: (current: PRSummaryOutput) => PRSummaryOutput) => {
    setOutput((prev) => {
      if (!prev || prev.tool !== 'pr_summary') return prev;
      return {
        ...prev,
        output: updater(prev.output as PRSummaryOutput),
      };
    });
  };

  const updatePostMortemOutput = (
    updater: (current: PostMortemOutput) => PostMortemOutput
  ) => {
    setOutput((prev) => {
      if (!prev || prev.tool !== 'post_mortem') return prev;
      return {
        ...prev,
        output: updater(prev.output as PostMortemOutput),
      };
    });
  };

  useEffect(() => {
    const tool = searchParams.get('tool');
    if (tool === 'release_notes' || tool === 'pr_summary' || tool === 'post_mortem') {
      setActiveTab(tool);
    }

    if (tool === 'release_notes') {
      setReleaseName(searchParams.get('release_name') || '');
      setReleaseAudience(
        (searchParams.get('audience') as 'customer' | 'internal') || 'internal'
      );
      setChangeList(searchParams.get('change_list') || '');
      setKnownIssues(searchParams.get('known_issues') || '');
      setRollbackSteps(searchParams.get('rollback_steps') || '');
    }

    if (tool === 'pr_summary') {
      setPrTitle(searchParams.get('pr_title') || '');
      setPrDescription(searchParams.get('pr_description') || '');
      setFilesTouched(searchParams.get('files_touched') || '');
      setKeyDiffs(searchParams.get('key_diffs') || '');
      setTestsRun(searchParams.get('tests_run') || '');
    }

    if (tool === 'post_mortem') {
      setIncidentTitle(searchParams.get('incident_title') || '');
      setImpact(searchParams.get('impact') || '');
      setTimeline(searchParams.get('timeline') || '');
      setRootCause(searchParams.get('root_cause') || '');
      setMitigation(searchParams.get('mitigation') || '');
      setPreventiveActions(searchParams.get('preventive_actions') || '');
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const hydrateFromRun = async () => {
      const handoffRunId = searchParams.get('handoffRunId');
      if (!handoffRunId) {
        if (!cancelled) setHandoffReady(true);
        return;
      }

      try {
        const res = await fetch(`/api/home/command/run/${encodeURIComponent(handoffRunId)}`);
        const data = await res.json();
        const runOutput = data?.run?.output?.result;
        if (
          !cancelled &&
          runOutput &&
          typeof runOutput === 'object' &&
          typeof runOutput.tool === 'string' &&
          runOutput.output
        ) {
          setOutput(runOutput);
          autoRunTriggeredRef.current = true;
        }
      } catch (error) {
        console.error('Failed to hydrate engineering output from handoff run:', error);
      } finally {
        if (!cancelled) setHandoffReady(true);
      }
    };

    hydrateFromRun();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/engineering-tools/history?tool=${activeTab}`);
        const data = await res.json();
        setHistory(data.items || []);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    const loadPresets = async () => {
      setLoadingPresets(true);
      try {
        const res = await fetch(`/api/engineering-tools/presets?tool=${activeTab}`);
        const data = await res.json();
        setPresets(data.items || []);
      } catch (err) {
        console.error('Failed to load presets:', err);
      } finally {
        setLoadingPresets(false);
      }
    };

    loadHistory();
    loadPresets();
  }, [activeTab]);

  const riskFlags = useMemo(() => detectRiskAreas(filesTouched), [filesTouched]);
  const testsMissing = useMemo(() => activeTab === 'pr_summary' && !testsRun.trim(), [activeTab, testsRun]);

  const handleGenerate = async (focusSection?: string) => {
    setError(null);
    if (!focusSection) {
      setOutput(null);
    }

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
              template: releaseTemplate,
              focus_section: focusSection,
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
                template: prTemplate,
                focus_section: focusSection,
                key_diffs: keyDiffs || undefined,
                tests_run: testsRun || undefined,
              }
            : {
                tool: 'post_mortem',
                incident_title: incidentTitle,
                impact,
                timeline,
                template: postMortemTemplate,
                focus_section: focusSection,
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
      if (focusSection && output) {
        const nextOutput: EngineeringToolResponse = {
          ...output,
          output: { ...(output.output as any), ...(data.output as any) },
        };
        if (output.tool === 'release_notes') {
          const merged = output.output as ReleaseNotesOutput;
          const updated = data.output as ReleaseNotesOutput;
          const sectionKey = focusSection;
          if (sectionKey === 'headline') merged.headline = updated.headline;
          if (sectionKey === 'highlights') merged.highlights = updated.highlights;
          if (sectionKey === 'improvements') merged.improvements = updated.improvements;
          if (sectionKey === 'fixes') merged.fixes = updated.fixes;
          if (sectionKey === 'known_issues') merged.known_issues = updated.known_issues;
          if (sectionKey === 'rollbacks') merged.rollbacks = updated.rollbacks;
          nextOutput.output = merged;
        } else if (output.tool === 'pr_summary') {
          const merged = output.output as PRSummaryOutput;
          const updated = data.output as PRSummaryOutput;
          if (focusSection === 'summary') merged.summary = updated.summary;
          if (focusSection === 'risk_areas') merged.risk_areas = updated.risk_areas;
          if (focusSection === 'suggested_tests') merged.suggested_tests = updated.suggested_tests;
          if (focusSection === 'qa_checklist') merged.qa_checklist = updated.qa_checklist;
          if (focusSection === 'rollback_notes') merged.rollback_notes = updated.rollback_notes;
          if (focusSection === 'risk_level') merged.risk_level = updated.risk_level;
          nextOutput.output = merged;
        } else if (output.tool === 'post_mortem') {
          const merged = output.output as PostMortemOutput;
          const updated = data.output as PostMortemOutput;
          if (focusSection === 'summary') merged.summary = updated.summary;
          if (focusSection === 'impact') merged.impact = updated.impact;
          if (focusSection === 'timeline') merged.timeline = updated.timeline;
          if (focusSection === 'root_cause') merged.root_cause = updated.root_cause;
          if (focusSection === 'resolution') merged.resolution = updated.resolution;
          if (focusSection === 'follow_up_actions') merged.follow_up_actions = updated.follow_up_actions;
          if (focusSection === 'lessons_learned') merged.lessons_learned = updated.lessons_learned;
          nextOutput.output = merged;
        }
        setOutput(nextOutput);
      } else {
        setOutput(data);
      }
      if (!focusSection) {
        const res = await fetch(`/api/engineering-tools/history?tool=${activeTab}`);
        const historyData = await res.json();
        setHistory(historyData.items || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate output');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const shouldAutoRun = searchParams.get('autorun') === '1';
    if (!shouldAutoRun || autoRunTriggeredRef.current) return;
    if (!handoffReady) return;

    const readyForAutoRun =
      (activeTab === 'release_notes' && !!changeList.trim()) ||
      (activeTab === 'pr_summary' && !!prTitle.trim()) ||
      (activeTab === 'post_mortem' && !!incidentTitle.trim() && !!timeline.trim());

    if (!readyForAutoRun) return;
    if (output) return;

    autoRunTriggeredRef.current = true;
    void handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, activeTab, changeList, prTitle, incidentTitle, timeline, handoffReady, output]);

  const copyMarkdown = async () => {
    if (!output) return;
    const markdown = buildMarkdown(output);
    try {
      await navigator.clipboard.writeText(markdown);
    } catch (err) {
      console.error('Failed to copy markdown:', err);
    }
  };

  const downloadMarkdown = () => {
    if (!output) return;
    const markdown = buildMarkdown(output);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `engineering-${output.tool}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const savePreset = async () => {
    if (!presetName.trim()) {
      setError('Add a preset name before saving.');
      return;
    }
    setSavingPreset(true);
    try {
      const data =
        activeTab === 'release_notes'
          ? {
              release_name: releaseName,
              audience: releaseAudience,
              template: releaseTemplate,
              change_list: changeList,
              known_issues: knownIssues,
              rollback_steps: rollbackSteps,
            }
          : activeTab === 'pr_summary'
            ? {
                pr_title: prTitle,
                pr_description: prDescription,
                files_touched: filesTouched,
                key_diffs: keyDiffs,
                tests_run: testsRun,
                template: prTemplate,
              }
            : {
                incident_title: incidentTitle,
                impact,
                timeline,
                root_cause: rootCause,
                mitigation,
                preventive_actions: preventiveActions,
                template: postMortemTemplate,
              };

      const res = await fetch('/api/engineering-tools/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: activeTab, name: presetName, data }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to save preset');
      }
      setPresetName('');
      const refreshed = await fetch(`/api/engineering-tools/presets?tool=${activeTab}`);
      const refreshedData = await refreshed.json();
      setPresets(refreshedData.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to save preset');
    } finally {
      setSavingPreset(false);
    }
  };

  const applyPreset = (preset: PresetItem) => {
    if (preset.tool !== activeTab) return;
    if (activeTab === 'release_notes') {
      setReleaseName(preset.data.release_name || '');
      setReleaseAudience((preset.data.audience as 'customer' | 'internal') || 'internal');
      setReleaseTemplate(
        (preset.data.template as (typeof RELEASE_TEMPLATES)[number]) || RELEASE_TEMPLATES[0]
      );
      setChangeList(preset.data.change_list || '');
      setKnownIssues(preset.data.known_issues || '');
      setRollbackSteps(preset.data.rollback_steps || '');
    } else if (activeTab === 'pr_summary') {
      setPrTitle(preset.data.pr_title || '');
      setPrDescription(preset.data.pr_description || '');
      setFilesTouched(preset.data.files_touched || '');
      setKeyDiffs(preset.data.key_diffs || '');
      setTestsRun(preset.data.tests_run || '');
      setPrTemplate(
        (preset.data.template as (typeof PR_TEMPLATES)[number]) || PR_TEMPLATES[0]
      );
    } else {
      setIncidentTitle(preset.data.incident_title || '');
      setImpact(preset.data.impact || '');
      setTimeline(preset.data.timeline || '');
      setRootCause(preset.data.root_cause || '');
      setMitigation(preset.data.mitigation || '');
      setPreventiveActions(preset.data.preventive_actions || '');
      setPostMortemTemplate(
        (preset.data.template as (typeof POSTMORTEM_TEMPLATES)[number]) || POSTMORTEM_TEMPLATES[0]
      );
    }
  };

  const deletePreset = async (id: string) => {
    try {
      const res = await fetch(`/api/engineering-tools/presets?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to delete preset');
      }
      setPresets((prev) => prev.filter((item) => item.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete preset');
    }
  };

  const loadHistoryItem = (item: DraftHistoryItem) => {
    setActiveTab(item.tool);
    setOutput(item.output);
    setError(null);
    if (item.tool === 'release_notes') {
      setReleaseName(item.input.release_name || '');
      setReleaseAudience((item.input.audience as 'customer' | 'internal') || 'internal');
      setReleaseTemplate(
        (item.input.template as (typeof RELEASE_TEMPLATES)[number]) || RELEASE_TEMPLATES[0]
      );
      setChangeList(item.input.change_list || '');
    } else if (item.tool === 'pr_summary') {
      setPrTitle(item.input.pr_title || '');
      setPrTemplate(
        (item.input.template as (typeof PR_TEMPLATES)[number]) || PR_TEMPLATES[0]
      );
      setFilesTouched(item.input.files_touched || '');
    } else {
      setIncidentTitle(item.input.incident_title || '');
      setPostMortemTemplate(
        (item.input.template as (typeof POSTMORTEM_TEMPLATES)[number]) || POSTMORTEM_TEMPLATES[0]
      );
      setTimeline(item.input.timeline || '');
    }
  };

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Beacon - Engineering Tools</p>
        <h1 className="text-2xl font-semibold text-gray-900">Release notes, PR summaries, and post-mortems.</h1>
        <p className="text-sm text-gray-600">
          Inputs, Generate, Output. Manual input for now; integrations can be added later.
        </p>
      </div>

      <div className="mb-2">
        <BackToHome label="" className="mt-1 text-xs" />
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
                  <label className="text-sm font-medium text-gray-700">Template</label>
                  <div className="flex flex-wrap gap-2">
                    {RELEASE_TEMPLATES.map((value) => (
                      <Button
                        key={value}
                        variant={releaseTemplate === value ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setReleaseTemplate(value)}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
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
                  <label className="text-sm font-medium text-gray-700">Template</label>
                  <div className="flex flex-wrap gap-2">
                    {PR_TEMPLATES.map((value) => (
                      <Button
                        key={value}
                        variant={prTemplate === value ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setPrTemplate(value)}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
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
                {(riskFlags.length > 0 || testsMissing) && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 space-y-1">
                    {riskFlags.length > 0 && (
                      <div>Risk areas detected: {riskFlags.join(', ')}</div>
                    )}
                    {testsMissing && <div>Tests missing: add tests run for QA review.</div>}
                  </div>
                )}
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
                  <label className="text-sm font-medium text-gray-700">Template</label>
                  <div className="flex flex-wrap gap-2">
                    {POSTMORTEM_TEMPLATES.map((value) => (
                      <Button
                        key={value}
                        variant={postMortemTemplate === value ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setPostMortemTemplate(value)}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
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

            <Button onClick={() => handleGenerate()} disabled={loading}>
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
            {output && (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" size="sm" onClick={copyMarkdown}>
                  Copy Markdown (Confluence)
                </Button>
                <Button variant="secondary" size="sm" onClick={downloadMarkdown}>
                  Download .md
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setEditMode((prev) => !prev)}>
                  {editMode ? 'Done Editing' : 'Edit Output'}
                </Button>
              </div>
            )}

            {output?.tool === 'release_notes' && (
              <>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Headline</p>
                  <Button variant="secondary" size="sm" onClick={() => handleGenerate('headline')}>
                    Regenerate
                  </Button>
                </div>
                {editMode ? (
                  <Textarea
                    value={(output.output as ReleaseNotesOutput).headline}
                    onChange={(e) =>
                      updateReleaseOutput((current) => ({ ...current, headline: e.target.value }))
                    }
                    rows={2}
                  />
                ) : (
                  <p className="text-sm text-gray-900">{(output.output as ReleaseNotesOutput).headline}</p>
                )}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Highlights</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('highlights')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Textarea
                      value={(output.output as ReleaseNotesOutput).highlights.join('\n')}
                      onChange={(e) =>
                        updateReleaseOutput((current) => ({
                          ...current,
                          highlights: e.target.value
                            .split(/\r?\n/)
                            .map((line) => line.trim())
                            .filter(Boolean),
                        }))
                      }
                      rows={4}
                    />
                  ) : (
                    renderList((output.output as ReleaseNotesOutput).highlights)
                  )}
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Improvements</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('improvements')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Textarea
                      value={(output.output as ReleaseNotesOutput).improvements.join('\n')}
                      onChange={(e) =>
                        updateReleaseOutput((current) => ({
                          ...current,
                          improvements: e.target.value
                            .split(/\r?\n/)
                            .map((line) => line.trim())
                            .filter(Boolean),
                        }))
                      }
                      rows={4}
                    />
                  ) : (
                    renderList((output.output as ReleaseNotesOutput).improvements)
                  )}
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Fixes</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('fixes')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Textarea
                      value={(output.output as ReleaseNotesOutput).fixes.join('\n')}
                      onChange={(e) =>
                        updateReleaseOutput((current) => ({
                          ...current,
                          fixes: e.target.value
                            .split(/\r?\n/)
                            .map((line) => line.trim())
                            .filter(Boolean),
                        }))
                      }
                      rows={4}
                    />
                  ) : (
                    renderList((output.output as ReleaseNotesOutput).fixes)
                  )}
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Known Issues</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('known_issues')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Textarea
                      value={(output.output as ReleaseNotesOutput).known_issues.join('\n')}
                      onChange={(e) =>
                        updateReleaseOutput((current) => ({
                          ...current,
                          known_issues: e.target.value
                            .split(/\r?\n/)
                            .map((line) => line.trim())
                            .filter(Boolean),
                        }))
                      }
                      rows={4}
                    />
                  ) : (
                    renderList((output.output as ReleaseNotesOutput).known_issues)
                  )}
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rollbacks</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('rollbacks')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Textarea
                      value={(output.output as ReleaseNotesOutput).rollbacks.join('\n')}
                      onChange={(e) =>
                        updateReleaseOutput((current) => ({
                          ...current,
                          rollbacks: e.target.value
                            .split(/\r?\n/)
                            .map((line) => line.trim())
                            .filter(Boolean),
                        }))
                      }
                      rows={4}
                    />
                  ) : (
                    renderList((output.output as ReleaseNotesOutput).rollbacks)
                  )}
                </div>
              </>
            )}

            {output?.tool === 'pr_summary' && (
              <>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Summary</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('summary')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Textarea
                      value={(output.output as PRSummaryOutput).summary}
                      onChange={(e) =>
                        updatePrOutput((current) => ({ ...current, summary: e.target.value }))
                      }
                      rows={4}
                    />
                  ) : (
                    <p className="text-sm text-gray-900">{(output.output as PRSummaryOutput).summary}</p>
                  )}
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Risk Level</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('risk_level')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Input
                      value={(output.output as PRSummaryOutput).risk_level}
                      onChange={(e) =>
                        updatePrOutput((current) => ({
                          ...current,
                          risk_level: e.target.value as any,
                        }))
                      }
                    />
                  ) : (
                    <p className="text-sm text-gray-900">{(output.output as PRSummaryOutput).risk_level}</p>
                  )}
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Risk Areas</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('risk_areas')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Textarea
                      value={(output.output as PRSummaryOutput).risk_areas.join('\n')}
                      onChange={(e) =>
                        updatePrOutput((current) => ({
                          ...current,
                          risk_areas: e.target.value
                            .split(/\r?\n/)
                            .map((line) => line.trim())
                            .filter(Boolean),
                        }))
                      }
                      rows={4}
                    />
                  ) : (
                    renderList((output.output as PRSummaryOutput).risk_areas)
                  )}
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Suggested Tests</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('suggested_tests')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Textarea
                      value={(output.output as PRSummaryOutput).suggested_tests.join('\n')}
                      onChange={(e) =>
                        updatePrOutput((current) => ({
                          ...current,
                          suggested_tests: e.target.value
                            .split(/\r?\n/)
                            .map((line) => line.trim())
                            .filter(Boolean),
                        }))
                      }
                      rows={4}
                    />
                  ) : (
                    renderList((output.output as PRSummaryOutput).suggested_tests)
                  )}
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">QA Checklist</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('qa_checklist')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Textarea
                      value={(output.output as PRSummaryOutput).qa_checklist.join('\n')}
                      onChange={(e) =>
                        updatePrOutput((current) => ({
                          ...current,
                          qa_checklist: e.target.value
                            .split(/\r?\n/)
                            .map((line) => line.trim())
                            .filter(Boolean),
                        }))
                      }
                      rows={4}
                    />
                  ) : (
                    renderList((output.output as PRSummaryOutput).qa_checklist)
                  )}
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rollback Notes</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('rollback_notes')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Textarea
                      value={(output.output as PRSummaryOutput).rollback_notes.join('\n')}
                      onChange={(e) =>
                        updatePrOutput((current) => ({
                          ...current,
                          rollback_notes: e.target.value
                            .split(/\r?\n/)
                            .map((line) => line.trim())
                            .filter(Boolean),
                        }))
                      }
                      rows={3}
                    />
                  ) : (
                    renderList((output.output as PRSummaryOutput).rollback_notes)
                  )}
                </div>
              </>
            )}

            {output?.tool === 'post_mortem' && (
              <>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Summary</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('summary')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Textarea
                      value={(output.output as PostMortemOutput).summary}
                      onChange={(e) =>
                        updatePostMortemOutput((current) => ({
                          ...current,
                          summary: e.target.value,
                        }))
                      }
                      rows={4}
                    />
                  ) : (
                    <p className="text-sm text-gray-900">{(output.output as PostMortemOutput).summary}</p>
                  )}
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Impact</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('impact')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Textarea
                      value={(output.output as PostMortemOutput).impact}
                      onChange={(e) =>
                        updatePostMortemOutput((current) => ({
                          ...current,
                          impact: e.target.value,
                        }))
                      }
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm text-gray-900">{(output.output as PostMortemOutput).impact}</p>
                  )}
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Timeline</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('timeline')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Textarea
                      value={(output.output as PostMortemOutput).timeline.join('\n')}
                      onChange={(e) =>
                        updatePostMortemOutput((current) => ({
                          ...current,
                          timeline: e.target.value
                            .split(/\r?\n/)
                            .map((line) => line.trim())
                            .filter(Boolean),
                        }))
                      }
                      rows={5}
                    />
                  ) : (
                    renderList((output.output as PostMortemOutput).timeline)
                  )}
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Root Cause</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('root_cause')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Textarea
                      value={(output.output as PostMortemOutput).root_cause}
                      onChange={(e) =>
                        updatePostMortemOutput((current) => ({
                          ...current,
                          root_cause: e.target.value,
                        }))
                      }
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm text-gray-900">{(output.output as PostMortemOutput).root_cause}</p>
                  )}
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resolution</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('resolution')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Textarea
                      value={(output.output as PostMortemOutput).resolution}
                      onChange={(e) =>
                        updatePostMortemOutput((current) => ({
                          ...current,
                          resolution: e.target.value,
                        }))
                      }
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm text-gray-900">{(output.output as PostMortemOutput).resolution}</p>
                  )}
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Follow-up Actions</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('follow_up_actions')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Textarea
                      value={(output.output as PostMortemOutput).follow_up_actions.join('\n')}
                      onChange={(e) =>
                        updatePostMortemOutput((current) => ({
                          ...current,
                          follow_up_actions: e.target.value
                            .split(/\r?\n/)
                            .map((line) => line.trim())
                            .filter(Boolean),
                        }))
                      }
                      rows={4}
                    />
                  ) : (
                    renderList((output.output as PostMortemOutput).follow_up_actions)
                  )}
                </div>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Lessons Learned</p>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerate('lessons_learned')}>
                      Regenerate
                    </Button>
                  </div>
                  {editMode ? (
                    <Textarea
                      value={(output.output as PostMortemOutput).lessons_learned.join('\n')}
                      onChange={(e) =>
                        updatePostMortemOutput((current) => ({
                          ...current,
                          lessons_learned: e.target.value
                            .split(/\r?\n/)
                            .map((line) => line.trim())
                            .filter(Boolean),
                        }))
                      }
                      rows={4}
                    />
                  ) : (
                    renderList((output.output as PostMortemOutput).lessons_learned)
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Presets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="Preset name"
            />
            <Button onClick={savePreset} disabled={savingPreset}>
              {savingPreset ? 'Saving...' : 'Save Preset'}
            </Button>
          </div>
          {loadingPresets && <p className="text-sm text-gray-600">Loading presets...</p>}
          {!loadingPresets && presets.length === 0 && (
            <p className="text-sm text-gray-600">No presets saved yet.</p>
          )}
          {presets.map((item) => (
            <div
              key={item.id}
              className="rounded-md border border-gray-200 px-3 py-2 flex items-center justify-between gap-2"
            >
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">
                  {item.tool.replace('_', ' ')}
                </p>
                <p className="text-sm text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">
                  {new Date(item.updatedAt || item.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => applyPreset(item)}>
                  Load
                </Button>
                <Button variant="secondary" size="sm" onClick={() => deletePreset(item.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Drafts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingHistory && <p className="text-sm text-gray-600">Loading drafts...</p>}
          {!loadingHistory && history.length === 0 && (
            <p className="text-sm text-gray-600">No drafts yet.</p>
          )}
          {history.map((item) => (
            <div
              key={item.id}
              className="rounded-md border border-gray-200 px-3 py-2 flex items-center justify-between gap-2"
            >
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">
                  {item.tool.replace('_', ' ')}
                </p>
                <p className="text-sm text-gray-900">
                  {item.input.release_name ||
                    item.input.pr_title ||
                    item.input.incident_title ||
                    'Draft'}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => loadHistoryItem(item)}>
                  Load
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function EngineeringToolsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Spinner /></div>}>
      <EngineeringToolsContent />
    </Suspense>
  );
}
