'use client';

import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/button';
import Input from '@/components/ui/input';
import { BackToHome } from '@/components/ui/back-to-home';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type TemplateStatus = 'draft' | 'published' | 'archived';

type TemplateSection = {
  id: string;
  key: string;
  title: string;
  order: number;
  required: boolean;
  locked: boolean;
  rules?: Record<string, any> | null;
};

type TemplateRow = {
  id: string;
  type: string;
  status: TemplateStatus;
  version: number;
  createdAt: string;
  publishedAt?: string | null;
  sections?: TemplateSection[];
};

type TemplateGroup = {
  type: string;
  published?: TemplateRow | null;
  draft?: TemplateRow | null;
};

const TEMPLATE_LABELS: Record<string, string> = {
  security_advisory: 'Security Advisory',
  it_incident: 'IT Incident / Outage',
  policy_update: 'Policy Update',
  travel_advisory: 'Travel Advisory',
  leadership_update: 'Leadership / Org Update',
};

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [draftSections, setDraftSections] = useState<TemplateSection[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/templates');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load templates');
      }
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const selectedGroup = useMemo(
    () => templates.find((t) => t.type === selectedType) || null,
    [templates, selectedType]
  );

  useEffect(() => {
    if (selectedGroup?.draft?.sections) {
      setDraftSections(
        selectedGroup.draft.sections
          .slice()
          .sort((a, b) => a.order - b.order)
      );
    } else {
      setDraftSections([]);
    }
  }, [selectedGroup]);

  const createDraft = async (publishedId?: string) => {
    if (!publishedId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/templates/${publishedId}/draft`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create draft');
      }
      await fetchTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to create draft');
    } finally {
      setCreating(false);
    }
  };

  const saveDraft = async () => {
    if (!selectedGroup?.draft) return;
    setSaving(true);
    setError(null);
    try {
      const payload = draftSections.map((section, index) => ({
        ...section,
        order: index + 1,
      }));
      const res = await fetch(
        `/api/admin/templates/${selectedGroup.draft.id}/sections`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sections: payload }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save sections');
      }
      await fetchTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to save sections');
    } finally {
      setSaving(false);
    }
  };

  const publishDraft = async () => {
    if (!selectedGroup?.draft) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/templates/${selectedGroup.draft.id}/publish`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to publish template');
      }
      await fetchTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to publish template');
    } finally {
      setPublishing(false);
    }
  };

  const discardDraft = async () => {
    if (!selectedGroup?.draft) return;
    setDiscarding(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/templates/${selectedGroup.draft.id}/draft`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to discard draft');
      }
      await fetchTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to discard draft');
    } finally {
      setDiscarding(false);
    }
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    setDraftSections((prev) => {
      const next = prev.slice();
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const draftWarnings = useMemo(() => {
    if (!selectedGroup?.draft?.sections) return [];
    const warnings: string[] = [];
    const sections = selectedGroup.draft.sections;
    const missingTitle = sections.filter((section) => section.required && !section.title?.trim());
    if (missingTitle.length > 0) {
      warnings.push('Required sections must have titles.');
    }
    if (selectedGroup.type === 'security_advisory') {
      const requiredSecurity = ['hard_rules', 'examples', 'mandatory_actions'];
      const missing = requiredSecurity.filter(
        (key) => !sections.some((section) => section.key === key && section.required)
      );
      if (missing.length > 0) {
        warnings.push(`Security advisory must include: ${missing.join(', ')}`);
      }
    }
    return warnings;
  }, [selectedGroup]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 py-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Comms Templates</h1>
          <p className="text-sm text-muted-foreground">
            Edit headers and section order for Beacon comms outputs.
          </p>
        </div>
        <BackToHome />
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Template Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {templates.map((template) => (
              <button
                key={template.type}
                type="button"
                className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                  selectedType === template.type
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedType(template.type)}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-gray-900">
                    {TEMPLATE_LABELS[template.type] || template.type}
                  </div>
                  <div className="flex items-center gap-2">
                    {template.published && (
                      <Badge className="bg-green-100 text-green-800">
                        v{template.published.version} Published
                      </Badge>
                    )}
                    {template.draft && (
                      <Badge className="bg-yellow-100 text-yellow-800">
                        v{template.draft.version} Draft
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedGroup
                ? TEMPLATE_LABELS[selectedGroup.type] || selectedGroup.type
                : 'Select a template'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedGroup && (
              <p className="text-sm text-gray-600">
                Choose a template type to edit sections.
              </p>
            )}

            {selectedGroup && !selectedGroup.draft && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  No draft exists. Create a draft to edit headers and section order.
                </p>
                <Button
                  onClick={() => createDraft(selectedGroup.published?.id)}
                  disabled={creating}
                >
                  {creating ? 'Creating...' : 'Create Draft'}
                </Button>
              </div>
            )}

            {selectedGroup?.draft && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-yellow-100 text-yellow-800">
                    Draft v{selectedGroup.draft.version}
                  </Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={discardDraft}
                    disabled={discarding}
                  >
                    {discarding ? 'Discarding...' : 'Discard Draft'}
                  </Button>
                </div>
                {draftWarnings.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 space-y-1">
                    {draftWarnings.map((warning) => (
                      <div key={warning}>{warning}</div>
                    ))}
                  </div>
                )}

                <div className="space-y-3">
                  {draftSections.map((section, index) => (
                    <div
                      key={section.id}
                      className="rounded-md border border-gray-200 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase text-gray-500">
                          {section.key}
                        </span>
                        <div className="flex items-center gap-2">
                          {section.locked && (
                            <Badge className="bg-gray-100 text-gray-700">Locked</Badge>
                          )}
                          {section.required && (
                            <Badge className="bg-blue-100 text-blue-700">Required</Badge>
                          )}
                        </div>
                      </div>
                      <Input
                        value={section.title}
                        onChange={(e) =>
                          setDraftSections((prev) =>
                            prev.map((s) =>
                              s.id === section.id ? { ...s, title: e.target.value } : s
                            )
                          )
                        }
                        disabled={section.locked}
                      />
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={section.required}
                            disabled={section.locked}
                            onChange={(e) =>
                              setDraftSections((prev) =>
                                prev.map((s) =>
                                  s.id === section.id
                                    ? { ...s, required: e.target.checked }
                                    : s
                                )
                              )
                            }
                          />
                          Required
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={section.locked}
                            disabled={section.locked}
                            onChange={(e) =>
                              setDraftSections((prev) =>
                                prev.map((s) =>
                                  s.id === section.id
                                    ? { ...s, locked: e.target.checked }
                                    : s
                                )
                              )
                            }
                          />
                          Locked
                        </label>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => moveSection(index, 'up')}
                            disabled={index === 0}
                          >
                            Up
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => moveSection(index, 'down')}
                            disabled={index === draftSections.length - 1}
                          >
                            Down
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={saveDraft} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Draft'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={publishDraft}
                    disabled={publishing}
                  >
                    {publishing ? 'Publishing...' : 'Publish Draft'}
                  </Button>
                </div>
              </div>
            )}

            {selectedGroup?.published && (
              <div className="space-y-3 border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Published Preview
                  </h3>
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setShowPreview((prev) => !prev)}
                  >
                    {showPreview ? 'Hide' : 'Show'}
                  </button>
                </div>
                {showPreview && (
                  <div className="space-y-3">
                    {(selectedGroup.published.sections || [])
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((section) => {
                        const rules = (section.rules || {}) as Record<string, any>;
                        const body =
                          rules.defaultBody ||
                          (section.required ? '[Generated content]' : '[Optional content]');
                        if (section.key === 'greeting') {
                          return (
                            <div
                              key={section.id}
                              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                            >
                              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Greeting Line
                              </div>
                              <p className="mt-1 text-xs text-gray-700 whitespace-pre-wrap">
                                {section.title}
                              </p>
                            </div>
                          );
                        }
                        return (
                          <div
                            key={section.id}
                            className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                          >
                            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              {section.title}
                            </div>
                            <p className="mt-1 text-xs text-gray-700 whitespace-pre-wrap">
                              {body}
                            </p>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
