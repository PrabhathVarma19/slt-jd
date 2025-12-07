export type Tone = 'standard' | 'executive' | 'technical' | 'client-facing';
export type Seniority = 'junior' | 'mid' | 'senior' | 'lead' | 'director+';
export type LengthOption = 'short' | 'standard' | 'detailed';

export interface JDSections {
  job_title: string;
  summary: string;
  key_responsibilities: string[];
  required_skills: string[];
  preferred_skills: string[];
  behavioral_competencies: string[];
  about_company: string;
  diversity_statement: string;
}

export interface JDRecord {
  id: string;
  job_title: string;
  brief_context: string | null;
  tone: Tone;
  seniority: Seniority;
  length: LengthOption;
  full_text: string;
  sections: JDSections;
  created_at: string;
  updated_at: string;
}

// API Request/Response Types
export interface GenerateJDRequest {
  job_title: string;
  context?: string;
  tone: Tone;
  seniority: Seniority;
  length: LengthOption;
  edited_responsibilities?: string[];
  edited_required_skills?: string[];
  edited_preferred_skills?: string[];
}

export interface GenerateJDResponse {
  jd_id: string;
  job_title: string;
  sections: JDSections;
  full_text: string;
}

export interface AutocompleteRequest {
  field: 'responsibility' | 'skill';
  current_line: string;
  job_title: string;
  context?: string;
  tone: Tone;
  seniority: Seniority;
}

export interface AutocompleteResponse {
  suggestion: string;
}

export interface JDSummary {
  jd_id: string;
  job_title: string;
  tone: Tone;
  seniority: Seniority;
  length: LengthOption;
  created_at: string;
}

