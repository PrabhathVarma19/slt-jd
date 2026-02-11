import { supabaseServer } from '@/lib/supabase/server';
import {
  CommsTemplate,
  CommsTemplateSection,
  CommsTemplateType,
} from '@/types/comms-templates';

type TemplateRow = CommsTemplate & { sections?: CommsTemplateSection[] };

export async function getPublishedTemplate(type: CommsTemplateType): Promise<TemplateRow | null> {
  const { data, error } = await supabaseServer
    .from('CommsTemplate')
    .select(
      `
      id,
      type,
      scope,
      status,
      version,
      createdBy,
      createdAt,
      publishedAt,
      sections:CommsTemplateSection(
        id,
        templateId:templateId,
        key,
        title,
        order,
        required,
        locked,
        rules
      )
    `
    )
    .eq('type', type)
    .eq('status', 'published')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to load published template:', error);
    return null;
  }
  if (!data) return null;

  const sections = (data.sections || [])
    .map((section: any) => ({
      ...section,
      templateId: section.templateId || data.id,
      order: Number(section.order || 0),
    }))
    .sort((a: any, b: any) => a.order - b.order);

  return { ...(data as any), sections };
}

export async function getTemplatesForAdmin(): Promise<
  Array<{ type: CommsTemplateType; published?: TemplateRow | null; draft?: TemplateRow | null }>
> {
  const { data, error } = await supabaseServer
    .from('CommsTemplate')
    .select(
      `
      id,
      type,
      scope,
      status,
      version,
      createdBy,
      createdAt,
      publishedAt,
      sections:CommsTemplateSection(
        id,
        templateId:templateId,
        key,
        title,
        order,
        required,
        locked,
        rules
      )
    `
    )
    .in('status', ['draft', 'published']);

  if (error) {
    throw error;
  }

  const grouped = new Map<
    CommsTemplateType,
    { published?: TemplateRow | null; draft?: TemplateRow | null }
  >();

  (data || []).forEach((row: any) => {
    const entry = grouped.get(row.type) || {};
    const sections = (row.sections || [])
      .map((section: any) => ({
        ...section,
        templateId: section.templateId || row.id,
        order: Number(section.order || 0),
      }))
      .sort((a: any, b: any) => a.order - b.order);
    const template = { ...(row as any), sections };

    if (row.status === 'published') {
      if (!entry.published || (entry.published?.version || 0) < row.version) {
        entry.published = template;
      }
    } else if (row.status === 'draft') {
      if (!entry.draft || (entry.draft?.version || 0) < row.version) {
        entry.draft = template;
      }
    }
    grouped.set(row.type, entry);
  });

  return Array.from(grouped.entries()).map(([type, entry]) => ({
    type,
    published: entry.published ?? null,
    draft: entry.draft ?? null,
  }));
}

export async function createDraftFromPublished(
  publishedId: string,
  createdBy: string
): Promise<TemplateRow> {
  const { data: published, error: publishedError } = await supabaseServer
    .from('CommsTemplate')
    .select(
      `
      id,
      type,
      scope,
      status,
      version,
      createdBy,
      createdAt,
      publishedAt,
      sections:CommsTemplateSection(
        id,
        templateId:templateId,
        key,
        title,
        order,
        required,
        locked,
        rules
      )
    `
    )
    .eq('id', publishedId)
    .eq('status', 'published')
    .maybeSingle();

  if (publishedError || !published) {
    throw publishedError || new Error('Published template not found');
  }

  const { data: existingDraft } = await supabaseServer
    .from('CommsTemplate')
    .select('id')
    .eq('type', published.type)
    .eq('status', 'draft')
    .maybeSingle();

  if (existingDraft?.id) {
    throw new Error('Draft already exists for this template type');
  }

  const nextVersion = Number(published.version || 0) + 1;
  const { data: draft, error: draftError } = await supabaseServer
    .from('CommsTemplate')
    .insert({
      type: published.type,
      scope: published.scope || 'global',
      status: 'draft',
      version: nextVersion,
      createdBy,
    })
    .select('id, type, scope, status, version, createdBy, createdAt, publishedAt')
    .single();

  if (draftError || !draft) {
    throw draftError || new Error('Failed to create draft');
  }

  const sections = (published.sections || []).map((section: any) => ({
    templateId: draft.id,
    key: section.key,
    title: section.title,
    order: section.order,
    required: section.required,
    locked: section.locked,
    rules: section.rules,
  }));

  if (sections.length > 0) {
    const { error: sectionError } = await supabaseServer
      .from('CommsTemplateSection')
      .insert(sections);
    if (sectionError) {
      throw sectionError;
    }
  }

  const { data: draftSections } = await supabaseServer
    .from('CommsTemplateSection')
    .select('id, templateId:templateId, key, title, order, required, locked, rules')
    .eq('templateId', draft.id)
    .order('order', { ascending: true });

  return { ...(draft as any), sections: draftSections || [] };
}

export async function updateDraftSections(
  templateId: string,
  sections: Array<{
    id: string;
    title: string;
    order: number;
    required: boolean;
    locked: boolean;
    rules?: any;
  }>
): Promise<CommsTemplateSection[]> {
  const { data: template, error } = await supabaseServer
    .from('CommsTemplate')
    .select('id, status')
    .eq('id', templateId)
    .maybeSingle();

  if (error || !template) {
    throw error || new Error('Template not found');
  }

  if (template.status !== 'draft') {
    throw new Error('Only draft templates can be edited');
  }

  for (const section of sections) {
    const payload: any = {
      title: section.title,
      order: section.order,
      required: section.required,
    };

    if (!section.locked) {
      payload.locked = section.locked;
    }

    if (section.rules !== undefined) {
      payload.rules = section.rules;
    }

    const { error: updateError } = await supabaseServer
      .from('CommsTemplateSection')
      .update(payload)
      .eq('id', section.id)
      .eq('templateId', templateId);

    if (updateError) {
      throw updateError;
    }
  }

  const { data: updatedSections, error: updatedError } = await supabaseServer
    .from('CommsTemplateSection')
    .select('id, templateId:templateId, key, title, order, required, locked, rules')
    .eq('templateId', templateId)
    .order('order', { ascending: true });

  if (updatedError) {
    throw updatedError;
  }

  return updatedSections || [];
}

export async function publishTemplate(templateId: string): Promise<TemplateRow> {
  const { data: draft, error: draftError } = await supabaseServer
    .from('CommsTemplate')
    .select(
      `
      id,
      type,
      scope,
      status,
      version,
      createdBy,
      createdAt,
      publishedAt,
      sections:CommsTemplateSection(
        id,
        templateId:templateId,
        key,
        title,
        order,
        required,
        locked,
        rules
      )
    `
    )
    .eq('id', templateId)
    .eq('status', 'draft')
    .maybeSingle();

  if (draftError || !draft) {
    throw draftError || new Error('Draft not found');
  }

  const sections = (draft.sections || [])
    .map((section: any) => ({
      ...section,
      templateId: section.templateId || draft.id,
      order: Number(section.order || 0),
    }))
    .sort((a: any, b: any) => a.order - b.order);

  const missingRequired = sections.filter((section: any) => section.required && !section.title);
  if (missingRequired.length > 0) {
    throw new Error('Required sections must have titles');
  }

  const requiredKeys = sections.filter((section: any) => section.required).map((s: any) => s.key);
  if (requiredKeys.length === 0) {
    throw new Error('Template must have at least one required section');
  }

  if (draft.type === 'security_advisory') {
    const requiredSecurity = ['hard_rules', 'examples', 'mandatory_actions'];
    const missing = requiredSecurity.filter(
      (key) => !sections.some((section: any) => section.key === key && section.required)
    );
    if (missing.length > 0) {
      throw new Error(`Security advisory must include: ${missing.join(', ')}`);
    }
  }

  await supabaseServer
    .from('CommsTemplate')
    .update({ status: 'archived' })
    .eq('type', draft.type)
    .eq('status', 'published');

  const { data: published, error: publishError } = await supabaseServer
    .from('CommsTemplate')
    .update({
      status: 'published',
      publishedAt: new Date().toISOString(),
    })
    .eq('id', draft.id)
    .select('id, type, scope, status, version, createdBy, createdAt, publishedAt')
    .single();

  if (publishError || !published) {
    throw publishError || new Error('Failed to publish template');
  }

  return { ...(published as any), sections };
}

export async function deleteDraft(templateId: string): Promise<void> {
  const { data: template, error } = await supabaseServer
    .from('CommsTemplate')
    .select('id, status')
    .eq('id', templateId)
    .maybeSingle();

  if (error || !template) {
    throw error || new Error('Template not found');
  }

  if (template.status !== 'draft') {
    throw new Error('Only draft templates can be discarded');
  }

  const { error: deleteError } = await supabaseServer
    .from('CommsTemplate')
    .delete()
    .eq('id', templateId);

  if (deleteError) {
    throw deleteError;
  }
}
