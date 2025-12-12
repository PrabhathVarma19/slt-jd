export type CommsMode = 'newsletter' | 'team';

export type CommsAudience = 'exec' | 'org' | 'team';

export type Formality = 'low' | 'medium' | 'high';

export interface CommsRequest {
  mode: CommsMode;
  audience: CommsAudience;
  formality: Formality;
  subject_seed?: string;
  content: string;
  key_dates?: string;
  actions_required?: string;
  links?: string;
  sections?: string[];
  include_deltas?: boolean;
}

export interface CommsSections {
  subject: string;
  summary: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
  html_body: string;
  text_body: string;
}
