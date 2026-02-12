export type EngineeringToolType = 'release_notes' | 'pr_summary' | 'post_mortem';

export interface ReleaseNotesRequest {
  tool: 'release_notes';
  release_name: string;
  audience: 'customer' | 'internal';
  change_list: string;
  template?: string;
  focus_section?: string;
  known_issues?: string;
  rollback_steps?: string;
}

export interface ReleaseNotesOutput {
  headline: string;
  highlights: string[];
  improvements: string[];
  fixes: string[];
  known_issues: string[];
  rollbacks: string[];
}

export interface PRSummaryRequest {
  tool: 'pr_summary';
  pr_title: string;
  pr_description: string;
  files_touched: string;
  template?: string;
  focus_section?: string;
  key_diffs?: string;
  tests_run?: string;
}

export interface PRSummaryOutput {
  summary: string;
  risk_level: 'Low' | 'Medium' | 'High';
  risk_areas: string[];
  suggested_tests: string[];
  qa_checklist: string[];
  rollback_notes: string[];
}

export interface PostMortemRequest {
  tool: 'post_mortem';
  incident_title: string;
  impact: string;
  timeline: string;
  template?: string;
  focus_section?: string;
  root_cause?: string;
  mitigation: string;
  preventive_actions?: string;
}

export interface PostMortemOutput {
  summary: string;
  impact: string;
  timeline: string[];
  root_cause: string;
  resolution: string;
  follow_up_actions: string[];
  lessons_learned: string[];
}

export type EngineeringToolRequest =
  | ReleaseNotesRequest
  | PRSummaryRequest
  | PostMortemRequest;

export type EngineeringToolResponse =
  | { tool: 'release_notes'; output: ReleaseNotesOutput }
  | { tool: 'pr_summary'; output: PRSummaryOutput }
  | { tool: 'post_mortem'; output: PostMortemOutput };
