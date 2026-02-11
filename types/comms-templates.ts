export type CommsTemplateType =
  | 'security_advisory'
  | 'it_incident'
  | 'policy_update'
  | 'travel_advisory'
  | 'leadership_update';

export type CommsTemplateStatus = 'draft' | 'published' | 'archived';

export interface CommsTemplateSectionRules {
  maxSentences?: number;
  verbatim?: boolean;
  defaultBody?: string;
}

export interface CommsTemplateSection {
  id: string;
  templateId: string;
  key: string;
  title: string;
  order: number;
  required: boolean;
  locked: boolean;
  rules?: CommsTemplateSectionRules | null;
}

export interface CommsTemplate {
  id: string;
  type: CommsTemplateType;
  scope: 'global';
  status: CommsTemplateStatus;
  version: number;
  createdBy?: string | null;
  createdAt: string;
  publishedAt?: string | null;
  sections?: CommsTemplateSection[];
}
