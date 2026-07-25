/**
 * Workflow templates ("Roles") — one-click pipeline recipes shared by:
 *   - CustomWorkflowBuilder's "Start from a template" gallery
 *   - the advanced-search chat panel's Roles dropdown (conversational wizard)
 *
 * Each node is either an OUTREACH step (the builder assigns a generated id) or
 * a single-instance macro (uses its fixed *_STEP_ID so the builder's drawers
 * and launch emit find its config). `cfg` seeds the node's drawer.
 *
 * `inputs` drives the chat wizard: each entry is asked as a question and the
 * answer is written onto the template's SOURCE config under `key` — the same
 * keys the builder's source drawer edits, so chat answers and drawer edits are
 * interchangeable.
 */
import type { StepType } from '@/types/campaign';

// Single-instance macro node ids. The builder imports these — keep the strings
// stable, they key drawer configs and the launch emit.
export const SOURCE_STEP_ID = 'src-node';
export const FOLLOWUP_STEP_ID = 'followup-node';
export const ANALYTICS_STEP_ID = 'analytics-node';
export const ZOHO_UPDATE_STEP_ID = 'zoho-update-node';
export const MEDIA_STEP_ID = 'media-gen-node';
export const MULTICOND_STEP_ID = 'multicond-node';
export const AI_STEP_ID = 'ai-agent-node';
export const ENRICH_STEP_ID = 'data-enrich-node';
export const EXPORT_STEP_ID = 'export-results-node';
export const AUTOPOST_STEP_ID = 'linkedin-post-node';

export const AI_DEFAULT_INSTRUCTION =
  'If the job title has multiple or mixed roles, keep the single best-fit, most senior title. Split the full name into first/last and tidy the company name.';

export const EXPORT_DEFAULT_COLUMNS = [
  'full_name', 'title', 'company_name', 'email', 'phone', 'linkedin_url', 'status', 'last_action', 'last_action_at',
];

export type TemplateSourceKey = 'zoho_recurring' | 'zoho_once' | 'ghl_once' | 'linkedin_search' | 'linkedin_signal' | 'file_import';

export type TemplateNode = {
  type: StepType;
  /** Fixed macro id (MEDIA_STEP_ID, AUTOPOST_STEP_ID, …); omit for outreach steps. */
  macroId?: string;
  title: string;
  description: string;
  cfg?: any;
};

export type TemplateInput = {
  /** Source-config key the answer is stored under (matches the builder's source drawer). */
  key: string;
  /** Question asked in the chat wizard. */
  question: string;
  placeholder?: string;
  optional?: boolean;
};

export type WorkflowTemplate = {
  key: string;
  name: string;
  tagline: string;
  /** Chip labels shown on cards / in chat so users see the pipeline up front. */
  chain: string[];
  source: { key: TemplateSourceKey; cfg?: any; title: string; description: string };
  nodes: TemplateNode[];
  /** Chat-wizard questions; empty means nothing to collect conversationally. */
  inputs: TemplateInput[];
  /** Needs a file upload (chat routes these to the builder instead of launching directly). */
  requiresFile?: boolean;
  /** Brand accent used by the chat Roles UI (cards, chips, CTAs). */
  accent: string;
  /** Small card badge (e.g. Popular / Daily). */
  badge?: { label: string; tone: 'blue' | 'violet' };
  /** Overview stats shown on template cards and the overview drawer. */
  meta: { cycleDays: number; channels: number };
};

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: 'linkedin_accelerator',
    badge: { label: 'Popular', tone: 'blue' },
    meta: { cycleDays: 14, channels: 3 },
    accent: '#0A66C2',
    name: 'LinkedIn Accelerator',
    tagline: 'Warm up, connect, message — while daily AI posts build your presence',
    chain: ['LinkedIn Search', 'Profile visit', 'Connect', 'Wait: accepted', 'Message', 'AI Media', 'Daily auto-post'],
    source: {
      key: 'linkedin_search',
      title: 'LinkedIn Search', description: 'Industry · title · location',
      cfg: { job_titles: '', industries: '', locations: '' },
    },
    inputs: [
      { key: 'job_titles', question: 'Which **job titles** should I target? Comma-separate several — e.g. "VP Sales, Head of Revenue".' },
      { key: 'industries', question: 'Which **industries**? (e.g. "SaaS, Fintech" — or say **skip**)', optional: true },
      { key: 'locations', question: 'Which **location**? (e.g. "Dubai, United Arab Emirates" — or say **skip**)', optional: true },
    ],
    nodes: [
      { type: 'linkedin_visit', title: 'Profile visit', description: 'Warm up before connecting' },
      { type: 'linkedin_connect', title: 'Connection request', description: 'AI-personalised note', cfg: { message: '' } },
      { type: 'condition', title: 'Wait for condition', description: 'Connection accepted', cfg: { condition: 'connection_accepted' } },
      { type: 'linkedin_message', title: 'Message', description: 'First message after acceptance', cfg: { message: 'Hi {{first_name}}, thanks for connecting! I noticed you lead {{title}} at {{company_name}} — curious how you\'re approaching outbound this quarter?' } },
      { type: 'media_generation', macroId: MEDIA_STEP_ID, title: 'AI Media', description: 'Generate an image for your posts' },
      {
        type: 'linkedin_post', macroId: AUTOPOST_STEP_ID, title: 'LinkedIn auto-post', description: 'Daily · 09:00 · AI-written',
        cfg: {
          content: 'Share one practical, non-salesy insight for leaders in the industry I target — what top performers do differently in outbound this year.',
          ai_generate: true, frequency: 'daily', days: [1, 2, 3, 4, 5], time: '09:00', post_as: 'personal',
        },
      },
    ],
  },
  {
    key: 'cold_list_outreach',
    meta: { cycleDays: 10, channels: 2 },
    accent: '#059669',
    name: 'Cold List Outreach',
    tagline: 'Upload a list, clean + enrich it, connect and follow up, export results',
    chain: ['File import', 'AI Agent', 'Enrich', 'Connect', 'Wait: accepted', 'Message', 'Export'],
    source: { key: 'file_import', title: 'File import (CSV / Excel)', description: 'Upload a list and map columns' },
    inputs: [],
    requiresFile: true,
    nodes: [
      { type: 'ai_parse', macroId: AI_STEP_ID, title: 'AI Agent', description: 'Clean & normalise lead data', cfg: { instruction: AI_DEFAULT_INSTRUCTION } },
      { type: 'data_enrich', macroId: ENRICH_STEP_ID, title: 'Enrich contact', description: 'Official email · Phone', cfg: { enrich: ['official_email', 'phone'] } },
      { type: 'linkedin_connect', title: 'Connection request', description: 'AI-personalised note', cfg: { message: '' } },
      { type: 'condition', title: 'Wait for condition', description: 'Connection accepted', cfg: { condition: 'connection_accepted' } },
      { type: 'linkedin_message', title: 'Message', description: 'First message after acceptance', cfg: { message: 'Hi {{first_name}}, thanks for connecting! Would love to hear how things are going at {{company_name}}.' } },
      { type: 'export_results', macroId: EXPORT_STEP_ID, title: 'Export results', description: 'CSV · Download', cfg: { format: 'csv', destinations: ['file'], columns: EXPORT_DEFAULT_COLUMNS, run_on_completion: true } },
    ],
  },
  {
    key: 'inmail_blitz',
    meta: { cycleDays: 12, channels: 1 },
    accent: '#7C3AED',
    name: 'InMail Blitz',
    tagline: 'Premium InMail to non-connections, with automatic follow-ups',
    chain: ['LinkedIn Search', 'Profile visit', 'InMail', 'Follow-ups'],
    source: {
      key: 'linkedin_search',
      title: 'LinkedIn Search', description: 'Industry · title · location',
      cfg: { job_titles: '', industries: '', locations: '' },
    },
    inputs: [
      { key: 'job_titles', question: 'Which **job titles** should the InMails target? Comma-separate several.' },
      { key: 'industries', question: 'Which **industries**? (or say **skip**)', optional: true },
      { key: 'locations', question: 'Which **location**? (or say **skip**)', optional: true },
    ],
    nodes: [
      { type: 'linkedin_visit', title: 'Profile visit', description: 'Warm up before the InMail' },
      { type: 'linkedin_inmail', title: 'InMail (Premium)', description: 'Cold InMail to non-connections', cfg: { message: 'Hi {{first_name}}, I came across your profile — I work with {{title}}s on outbound and thought this was worth a short note. Open to a quick exchange?' } },
      { type: 'followup_sequence', macroId: FOLLOWUP_STEP_ID, title: 'Follow-up sequence', description: '3 touches · LinkedIn', cfg: { channel: 'linkedin', touches: [{ hours: 48 }, { hours: 120 }, { hours: 240 }] } },
    ],
  },
  {
    key: 'signal_hunter',
    badge: { label: 'Daily', tone: 'violet' },
    meta: { cycleDays: 7, channels: 1 },
    accent: '#D97706',
    name: 'Signal Hunter',
    tagline: 'Catch companies showing buying signals and reach the decision maker',
    chain: ['Signal Search', 'Profile visit', 'Connect', 'Wait: accepted', 'Message'],
    source: {
      key: 'linkedin_signal',
      title: 'LinkedIn Signal Search', description: 'Hiring / buying signals · daily',
      cfg: { signal_query: 'companies hiring for revenue operations or sales development roles', decision_maker_titles: 'VP Sales, Head of Sales, CRO' },
    },
    inputs: [
      { key: 'signal_query', question: 'What **signal** should I watch for? (e.g. "companies posting jobs for Salesforce revenue operations")' },
      { key: 'decision_maker_titles', question: 'Which **decision-maker titles** should I reach at those companies? Comma-separate several.' },
    ],
    nodes: [
      { type: 'linkedin_visit', title: 'Profile visit', description: 'Warm up before connecting' },
      { type: 'linkedin_connect', title: 'Connection request', description: 'AI-personalised note', cfg: { message: '' } },
      { type: 'condition', title: 'Wait for condition', description: 'Connection accepted', cfg: { condition: 'connection_accepted' } },
      { type: 'linkedin_message', title: 'Message', description: 'Signal-aware first message', cfg: { message: 'Hi {{first_name}}, saw {{company_name}} is growing the team — usually a sign outbound is about to scale. Happy to share what\'s working for similar teams if useful.' } },
    ],
  },
  {
    key: 'crm_reengage',
    meta: { cycleDays: 30, channels: 2 },
    accent: '#DC2626',
    name: 'CRM Re-Engage',
    tagline: 'Pull new Zoho contacts daily, reach out on LinkedIn, write results back',
    chain: ['Zoho daily', 'AI Agent', 'Connect', 'Wait: accepted', 'Message', 'Zoho write-back'],
    source: {
      key: 'zoho_recurring',
      title: 'Zoho CRM — recurring', description: 'Import new contacts daily',
      cfg: { zoho_modules: 'contacts' },
    },
    inputs: [
      { key: 'zoho_tag', question: 'Only import contacts with a specific **Zoho tag**? Type the tag, or say **skip** to import all new contacts.', optional: true },
    ],
    nodes: [
      { type: 'ai_parse', macroId: AI_STEP_ID, title: 'AI Agent', description: 'Clean & normalise lead data', cfg: { instruction: AI_DEFAULT_INSTRUCTION } },
      { type: 'linkedin_connect', title: 'Connection request', description: 'AI-personalised note', cfg: { message: '' } },
      { type: 'condition', title: 'Wait for condition', description: 'Connection accepted', cfg: { condition: 'connection_accepted' } },
      { type: 'linkedin_message', title: 'Message', description: 'First message after acceptance', cfg: { message: 'Hi {{first_name}}, great to connect! We already have you in our network — wanted to reach out personally.' } },
      { type: 'zoho_update', macroId: ZOHO_UPDATE_STEP_ID, title: 'Update Zoho record', description: 'Write back to Contacts', cfg: { module: 'Contacts', map: {} } },
    ],
  },
];
