// R8 Phase 3 redesign — terse, controlled question script for the wizard's
// ICP discovery step. Each question maps directly to a field in IcpStructured
// so we can build the canonical record client-side without an extra extractor.

import type { IcpStructured } from '@lad/frontend-features/ai-icp-assistant';

export type QuestionType = 'chips' | 'pills' | 'range' | 'text';

export interface IcpQuestion {
  id: string;
  prompt: string;
  /** Short helper shown under the prompt for ambiguous questions. */
  helper?: string;
  type: QuestionType;
  placeholder?: string;
  /** For `pills` type — the fixed option list. */
  options?: Array<{ value: string; label: string }>;
  /** Which IcpStructured field this answer writes to. */
  apply: (value: string | string[] | { min?: number; max?: number }, icp: IcpStructured) => IcpStructured;
  /** Reads back the current answer from a partial ICP so we can pre-fill. */
  read?: (icp: IcpStructured) => string | string[] | { min?: number; max?: number } | undefined;
}

const SENIORITY_OPTIONS = [
  { value: 'c_level',   label: 'C-Level' },
  { value: 'vp',        label: 'VP' },
  { value: 'director',  label: 'Director' },
  { value: 'head',      label: 'Head' },
  { value: 'manager',   label: 'Manager' },
  { value: 'senior_ic', label: 'Senior IC' },
  { value: 'ic',        label: 'IC' },
];

const CHANNEL_OPTIONS = [
  { value: 'linkedin',  label: 'LinkedIn' },
  { value: 'email',     label: 'Email' },
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'voice',     label: 'Voice' },
  { value: 'instagram', label: 'Instagram' },
];

export const ICP_QUESTIONS: IcpQuestion[] = [
  {
    id: 'industries',
    prompt: 'Which industries?',
    helper: 'Comma-separate any number — e.g. Healthtech, B2B SaaS.',
    type: 'chips',
    placeholder: 'Healthtech, B2B SaaS',
    apply: (v, icp) => ({ ...icp, company: { ...icp.company, industries: v as string[] } }),
    read: (icp) => icp.company.industries,
  },
  {
    id: 'countries',
    prompt: 'Which countries?',
    helper: 'Where your buyers are based.',
    type: 'chips',
    placeholder: 'United Arab Emirates, Saudi Arabia',
    apply: (v, icp) => ({ ...icp, company: { ...icp.company, countries: v as string[] } }),
    read: (icp) => icp.company.countries,
  },
  {
    id: 'size',
    prompt: 'Company size?',
    helper: 'Employee count range.',
    type: 'range',
    apply: (v, icp) => ({ ...icp, company: { ...icp.company, size_employees: v as { min?: number; max?: number } } }),
    read: (icp) => icp.company.size_employees,
  },
  {
    id: 'seniorities',
    prompt: 'Which seniorities?',
    helper: 'Pick all that apply.',
    type: 'pills',
    options: SENIORITY_OPTIONS,
    apply: (v, icp) => ({ ...icp, person: { ...icp.person, seniorities: v as string[] } }),
    read: (icp) => icp.person.seniorities,
  },
  {
    id: 'jobTitles',
    prompt: 'Job titles?',
    helper: 'Free text — partial matches are fine.',
    type: 'chips',
    placeholder: 'Head of Growth, VP Marketing',
    apply: (v, icp) => ({ ...icp, person: { ...icp.person, job_titles_includes: v as string[] } }),
    read: (icp) => icp.person.job_titles_includes,
  },
  {
    id: 'departments',
    prompt: 'Departments?',
    helper: 'Skip if titles already capture this.',
    type: 'chips',
    placeholder: 'Marketing, Growth, Sales',
    apply: (v, icp) => ({ ...icp, person: { ...icp.person, departments: v as string[] } }),
    read: (icp) => icp.person.departments,
  },
  {
    id: 'channels',
    prompt: 'Preferred outreach channels?',
    helper: 'Pick where you want Mr LAD to reach prospects.',
    type: 'pills',
    options: CHANNEL_OPTIONS,
    apply: (v, icp) => ({
      ...icp,
      outreach_preferences: {
        ...icp.outreach_preferences,
        preferred_channels: v as IcpStructured['outreach_preferences'] extends infer P
          ? P extends { preferred_channels?: infer C } ? C : never
          : never,
      },
    }),
    read: (icp) => icp.outreach_preferences?.preferred_channels as string[] | undefined,
  },
];

export function emptyIcp(): IcpStructured {
  return {
    version: '1.0',
    company: {},
    person: {},
    outreach_preferences: {},
    fit_weights: {
      industry_match: 0.7,
      size_match: 0.5,
      seniority_match: 0.7,
      title_match: 0.8,
      geo_match: 0.6,
      tech_stack_match: 0.3,
    },
    // All three discovery backends enabled by default so the search dispatcher
    // has the widest possible reach out of the box. The tenant can disable
    // anything they don't want in the Review step.
    search_strategy: {
      discovery_order: ['apollo', 'sales_navigator', 'abm'],
      apollo:          { enabled: true, max_results_per_run: 500 },
      sales_navigator: { enabled: true, max_results_per_run: 200 },
      abm:             { enabled: true, target_accounts: [] },
    },
    metadata: { captured_at: new Date().toISOString() },
  };
}

export function parseChips(raw: string): string[] {
  return raw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
}

export function parseRange(raw: string): { min?: number; max?: number } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const range = trimmed.match(/(\d{1,7})\s*[-–to]+\s*(\d{1,7})/i);
  if (range) return { min: parseInt(range[1], 10), max: parseInt(range[2], 10) };
  const plus = trimmed.match(/(\d{1,7})\s*\+/);
  if (plus) return { min: parseInt(plus[1], 10) };
  const single = trimmed.match(/^(\d{1,7})$/);
  if (single) {
    const n = parseInt(single[1], 10);
    return { min: n, max: n };
  }
  return null;
}
