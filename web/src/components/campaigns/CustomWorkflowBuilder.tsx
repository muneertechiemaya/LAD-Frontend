'use client';
// Custom Workflow Builder (n8n/Zapier-style) — embeddable component.
//
// Pick a contact SOURCE node (Zoho CRM recurring/one-time, GoHighLevel,
// LinkedIn Search), chain OUTREACH nodes (LinkedIn / Email / WhatsApp / Voice /
// Wait-condition) on a React Flow canvas, configure each node in a drawer, and
// launch — assembles engine-compatible campaign steps and POSTs /api/campaigns.
// Recurrence comes from the engine's daily lead_generation loop
// (source='zoho_contacts' etc.), not a separate scheduler.
//
// Hosted in TWO places: the /campaigns/workflow page (thin wrapper) and the
// advanced-search-ai "+" menu (full-screen overlay on the same page).
//
// Reuses the existing workflow canvas stack (CustomWorkflowNode, flow builders,
// onboarding store) so nodes render/edit/delete exactly like the campaign
// preview panel. Because the store is SHARED with the chat-built workflow
// preview on advanced-search-ai, the builder snapshots workflowPreview on
// mount and restores it on close. Node CONFIG (messages, delays, zoho
// modules…) lives in local state keyed by step id — the store only carries the
// visual step list.

import * as React from 'react';
import { useState, useMemo, useEffect, useCallback, Fragment } from 'react';
import ReactFlow, { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Rocket, Loader2, Linkedin, Mail, MailPlus, MessageCircle, Phone, Clock,
  Users, Repeat, Search, X, HardDrive, Inbox, ListOrdered, BarChart3, GitFork, DatabaseZap,
  Wand2, Trash2, Radar, Split, Plus, Upload, FileSpreadsheet, Sparkles, Contact, Download, Megaphone, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchWithTenant } from '@/lib/fetch-with-tenant';
import { useMediaBuilder } from '@/hooks/voice-agent/useMediaBuilder';
import { MediaGenerationModal } from '@/components/voice-agent/MediaGenerationModal';
import { useOnboardingStore, type WorkflowPreviewStep } from '@/store/onboardingStore';
import type { StepType } from '@/types/campaign';
import { useVoiceAgent } from '@lad/frontend-features/ai-icp-assistant';
import { useConnectedEmailSenders } from '@lad/frontend-features/email-senders';
import { useEmailTemplates } from '@lad/frontend-features/email-templates';
import { CustomWorkflowNode } from '@/components/onboarding/workflow/CustomWorkflowNode';
import { WorkflowCanvas } from '@/components/onboarding/workflow/WorkflowCanvas';
import { createReactFlowNodes, createReactFlowEdges } from '@/components/onboarding/workflow/workflowFlowBuilder';
import LabeledEdge from '@/components/onboarding/workflow/LabeledEdge';

const nodeTypes = { custom: CustomWorkflowNode };
const edgeTypes = { labeled: LabeledEdge };

// ─── Palette definitions ─────────────────────────────────────────────────────

type SourceKey = 'zoho_recurring' | 'zoho_once' | 'ghl_once' | 'linkedin_search' | 'linkedin_signal' | 'file_import';

const SOURCES: { key: SourceKey; label: string; sub: string; icon: React.ReactNode; chip: string; recurring?: boolean }[] = [
  { key: 'zoho_recurring', label: 'Zoho CRM — recurring', sub: 'Import new contacts daily', icon: <Repeat className="h-4 w-4 text-red-600" />, chip: 'bg-red-50 dark:bg-red-950/30', recurring: true },
  { key: 'zoho_once', label: 'Zoho CRM — one-time', sub: 'Import synced contacts now', icon: <Users className="h-4 w-4 text-red-600" />, chip: 'bg-red-50 dark:bg-red-950/30' },
  { key: 'ghl_once', label: 'GoHighLevel — one-time', sub: 'Import synced contacts now', icon: <Users className="h-4 w-4 text-blue-600" />, chip: 'bg-blue-50 dark:bg-blue-950/30' },
  { key: 'file_import', label: 'File import (CSV / Excel)', sub: 'Upload a list and map columns', icon: <FileSpreadsheet className="h-4 w-4 text-emerald-600" />, chip: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { key: 'linkedin_search', label: 'LinkedIn Search', sub: 'Find new leads by keywords', icon: <Search className="h-4 w-4 text-[#0077B5]" />, chip: 'bg-sky-50 dark:bg-sky-950/30' },
  { key: 'linkedin_signal', label: 'LinkedIn Signal Search', sub: 'Find leads from hiring/buying signals', icon: <Radar className="h-4 w-4 text-[#0077B5]" />, chip: 'bg-sky-50 dark:bg-sky-950/30', recurring: true },
];

// Target fields the file columns map to. 'ignore' drops the column.
const IMPORT_FIELDS = [
  { value: 'ignore', label: '— Ignore —' },
  { value: 'full_name', label: 'Full name' },
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'company', label: 'Company' },
  { value: 'title', label: 'Job title' },
  { value: 'location', label: 'Location' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone / WhatsApp' },
  { value: 'linkedin_url', label: 'LinkedIn URL' },
  { value: 'website', label: 'Website' },
];

/** Quote-aware CSV → string[][]. */
function parseCSVText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => (v || '').trim()));
}

/** Parse a CSV/XLSX File → { headers, rows }. Excel via exceljs (dynamic import). */
async function parseImportFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const isExcel = /\.(xlsx|xls)$/i.test(file.name);
  let grid: string[][];
  if (isExcel) {
    const { Workbook } = await import('exceljs');
    const wb = new Workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws) throw new Error('No worksheet found in the Excel file.');
    grid = [];
    ws.eachRow((r) => {
      const vals = (r.values as any[]).slice(1).map((v) => (v == null ? '' : String(typeof v === 'object' && v.text ? v.text : v).trim()));
      grid.push(vals);
    });
    grid = grid.filter((r) => r.some((v) => (v || '').trim()));
  } else {
    grid = parseCSVText(await file.text());
  }
  if (grid.length < 2) throw new Error('File needs a header row and at least one data row.');
  return { headers: grid[0].map((h) => (h || '').trim()), rows: grid.slice(1) };
}

/** Suggest a target field for a header name. */
function suggestImportField(header: string): string {
  const s = (header || '').toLowerCase();
  if (/full.?name|^name$|contact.?name/.test(s)) return 'full_name';
  if (/first/.test(s)) return 'first_name';
  if (/last|surname/.test(s)) return 'last_name';
  if (/company|account|organi[sz]ation|employer/.test(s)) return 'company';
  if (/title|designation|role|position|job/.test(s)) return 'title';
  if (/location|city|country|region|geo|state/.test(s)) return 'location';
  if (/e-?mail/.test(s)) return 'email';
  if (/phone|mobile|whatsapp|contact.?number/.test(s)) return 'phone';
  if (/linkedin/.test(s)) return 'linkedin_url';
  if (/website|url|domain/.test(s) && !/linkedin/.test(s)) return 'website';
  return 'ignore';
}

const COMING_SOON = [
  { label: 'Google Drive', icon: <HardDrive className="h-4 w-4 text-muted-foreground" /> },
  { label: 'Gmail inbox', icon: <Inbox className="h-4 w-4 text-muted-foreground" /> },
];

type Channel = 'linkedin' | 'email' | 'whatsapp' | 'voice' | 'instagram';
// NOTE: the store's StepType uses 'condition' for waits; we map it to the
// engine's 'wait_for_condition' step type at launch.
const OUTREACH: { type: StepType; label: string; group: string; channel: Channel; icon: React.ReactNode; chip: string; router?: boolean }[] = [
  { type: 'linkedin_connect', label: 'Connection request', group: 'LinkedIn', channel: 'linkedin', icon: <Linkedin className="h-4 w-4 text-[#0077B5]" />, chip: 'bg-sky-50 dark:bg-sky-950/30' },
  { type: 'linkedin_message', label: 'Message', group: 'LinkedIn', channel: 'linkedin', icon: <Linkedin className="h-4 w-4 text-[#0077B5]" />, chip: 'bg-sky-50 dark:bg-sky-950/30' },
  { type: 'linkedin_inmail', label: 'InMail (Premium)', group: 'LinkedIn', channel: 'linkedin', icon: <MailPlus className="h-4 w-4 text-[#7C3AED]" />, chip: 'bg-violet-50 dark:bg-violet-950/30' },
  { type: 'linkedin_visit', label: 'Profile visit', group: 'LinkedIn', channel: 'linkedin', icon: <Linkedin className="h-4 w-4 text-[#0077B5]" />, chip: 'bg-sky-50 dark:bg-sky-950/30' },
  { type: 'email_send', label: 'Send email', group: 'Email', channel: 'email', icon: <Mail className="h-4 w-4 text-amber-600" />, chip: 'bg-amber-50 dark:bg-amber-950/30' },
  { type: 'whatsapp_send', label: 'Send WhatsApp', group: 'WhatsApp', channel: 'whatsapp', icon: <MessageCircle className="h-4 w-4 text-green-600" />, chip: 'bg-green-50 dark:bg-green-950/30' },
  { type: 'voice_agent_call', label: 'AI voice call', group: 'Voice', channel: 'voice', icon: <Phone className="h-4 w-4 text-violet-600" />, chip: 'bg-violet-50 dark:bg-violet-950/30' },
  { type: 'condition', label: 'Wait for condition', group: 'Logic', channel: 'linkedin', icon: <Clock className="h-4 w-4 text-slate-500" />, chip: 'bg-slate-100 dark:bg-slate-800/50' },
  { type: 'condition', label: 'Router — fallback', group: 'Logic', channel: 'linkedin', icon: <GitFork className="h-4 w-4 text-rose-600" />, chip: 'bg-rose-50 dark:bg-rose-950/30', router: true },
];

const ROUTER_CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'linkedin', label: 'LinkedIn message' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'voice', label: 'AI voice call' },
];

/** Small rounded icon chip used across palette rows and the drawer header. */
const IconChip = ({ icon, chip, size = 'h-9 w-9' }: { icon: React.ReactNode; chip: string; size?: string }) => (
  <span className={`${size} ${chip} rounded-lg flex items-center justify-center flex-shrink-0`}>{icon}</span>
);

const CONDITIONS = [
  { value: 'connection_accepted', label: 'Connection accepted', action: 'CONNECTION_ACCEPTED' },
  { value: 'message_replied', label: 'Message replied', action: 'REPLY_RECEIVED' },
  { value: 'email_read', label: 'Email read', action: 'EMAIL_READ' },
  { value: 'email_replied', label: 'Email replied', action: 'EMAIL_REPLIED' },
  { value: 'wa_read', label: 'WhatsApp read', action: 'WA_READ' },
  { value: 'wa_replied', label: 'WhatsApp replied', action: 'WA_REPLIED' },
];

const SOURCE_STEP_ID = 'src-node';
// "Macro" nodes (single-instance): follow-ups EXPAND into real engine steps at
// launch; analytics becomes campaign config read by the digest cron — it is
// NOT an engine step.
const FOLLOWUP_STEP_ID = 'followup-node';
const ANALYTICS_STEP_ID = 'analytics-node';
let stepSeq = 0;
const nextId = () => `wf-${Date.now()}-${stepSeq++}`;

const FU_CHANNELS = [
  { value: 'linkedin', label: 'LinkedIn message' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

// "Update Zoho record" write-back node (single-instance) — maps workflow data
// back onto the lead's Zoho record. Keys MUST match the backend
// ZohoWritebackService.SOURCE_RESOLVERS.
const ZOHO_UPDATE_STEP_ID = 'zoho-update-node';

// "AI Media" node (single-instance) — generate a brand image/video at design
// time; the media_generation step records it and the asset is attached to the
// workflow's email/WhatsApp outreach at launch.
const MEDIA_STEP_ID = 'media-gen-node';

// "Multi-condition" (switch) node — routes each lead down one of N branches by
// a lead field (if/elseif/else). Expands at launch into a `switch` step + one
// guarded message step per branch (backend prunes the non-chosen branches).
const MULTICOND_STEP_ID = 'multicond-node';

// "AI Agent" node — LLM-normalises each lead (clean single title from a mixed
// field, split name, tidy company) before the outreach/LinkedIn steps run.
const AI_STEP_ID = 'ai-agent-node';
const AI_DEFAULT_INSTRUCTION = 'If the job title has multiple or mixed roles, keep the single best-fit, most senior title. Split the full name into first/last and tidy the company name.';

// "Enrich contact" node — reveals email/phone via FullEnrich; user multi-selects.
const ENRICH_STEP_ID = 'data-enrich-node';
const ENRICH_OPTIONS: { key: string; label: string; sub: string }[] = [
  { key: 'official_email', label: 'Official email', sub: 'work / business email' },
  { key: 'personal_email', label: 'Personal email', sub: 'private email' },
  { key: 'phone', label: 'Phone number', sub: 'mobile number' },
];

// "Export results" node — ships the campaign's result set to one or more
// destinations. Config-only (like the analytics digest): stored on
// campaigns.config.export_results and run on completion / on demand.
const EXPORT_STEP_ID = 'export-results-node';
const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV (.csv)' },
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'json', label: 'JSON (.json)' },
];
const EXPORT_DESTINATIONS: { key: string; label: string; sub: string }[] = [
  { key: 'file',          label: 'Download file',   sub: 'CSV / Excel / JSON link' },
  { key: 'database',      label: 'Database table',  sub: 'append to campaign_export_results' },
  { key: 'email',         label: 'Email',           sub: 'send file as an attachment' },
  { key: 'whatsapp',      label: 'WhatsApp',        sub: 'send file as a document' },
  { key: 'webhook',       label: 'Webhook',         sub: 'POST JSON to a URL' },
  { key: 'google_sheets', label: 'Google Sheets',   sub: 'append rows to a sheet' },
  { key: 'slack',         label: 'Slack',           sub: 'post summary + link' },
  { key: 'cloud_storage', label: 'Cloud storage',   sub: 'drop file in a bucket' },
];
const EXPORT_COLUMN_OPTIONS: { value: string; label: string }[] = [
  { value: 'full_name', label: 'Full name' },
  { value: 'first_name', label: 'First name' },
  { value: 'last_name', label: 'Last name' },
  { value: 'title', label: 'Title' },
  { value: 'company_name', label: 'Company' },
  { value: 'email', label: 'Email' },
  { value: 'personal_email', label: 'Personal email' },
  { value: 'phone', label: 'Phone' },
  { value: 'linkedin_url', label: 'LinkedIn URL' },
  { value: 'status', label: 'Status' },
  { value: 'last_action', label: 'Last action' },
  { value: 'last_action_at', label: 'Last action at' },
  { value: 'replied', label: 'Replied' },
  { value: 'created_at', label: 'Added on' },
];
const EXPORT_DEFAULT_COLUMNS = ['full_name', 'title', 'company_name', 'email', 'phone', 'linkedin_url', 'status', 'last_action', 'last_action_at'];

// "LinkedIn auto-post" node — posts to the tenant's OWN feed on a recurring
// schedule while the campaign runs (social-selling warm-up). Campaign-level,
// NOT per-lead: a per-lead post would fire once per enrolled lead.
const AUTOPOST_STEP_ID = 'linkedin-post-node';
const AUTOPOST_FREQUENCIES = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'On selected days' },
];
const AUTOPOST_DAYS = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

// ── Workflow templates ──────────────────────────────────────────────────────
// One-click pipeline recipes. Each node is either an OUTREACH step (gets a
// generated id) or a single-instance macro (uses its fixed *_STEP_ID so the
// drawers and launch emit find its config). `cfg` seeds the node's drawer —
// users edit everything after applying.
type TemplateNode = {
  type: StepType;
  /** Fixed macro id (MEDIA_STEP_ID, AUTOPOST_STEP_ID, …); omit for outreach steps. */
  macroId?: string;
  title: string;
  description: string;
  cfg?: any;
};
type WorkflowTemplate = {
  key: string;
  name: string;
  tagline: string;
  /** Chip labels shown on the card so users see the pipeline before applying. */
  chain: string[];
  source: { key: SourceKey; cfg?: any; title: string; description: string };
  nodes: TemplateNode[];
};

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    key: 'linkedin_accelerator',
    name: 'LinkedIn Accelerator',
    tagline: 'Warm up, connect, message — while daily AI posts build your presence',
    chain: ['LinkedIn Search', 'Profile visit', 'Connect', 'Wait: accepted', 'Message', 'AI Media', 'Daily auto-post'],
    source: {
      key: 'linkedin_search',
      title: 'LinkedIn Search', description: 'Industry · title · location',
      cfg: { job_titles: '', industries: '', locations: '' },
    },
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
    name: 'Cold List Outreach',
    tagline: 'Upload a list, clean + enrich it, connect and follow up, export results',
    chain: ['File import', 'AI Agent', 'Enrich', 'Connect', 'Wait: accepted', 'Message', 'Export'],
    source: { key: 'file_import', title: 'File import (CSV / Excel)', description: 'Upload a list and map columns' },
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
    name: 'InMail Blitz',
    tagline: 'Premium InMail to non-connections, with automatic follow-ups',
    chain: ['LinkedIn Search', 'Profile visit', 'InMail', 'Follow-ups'],
    source: {
      key: 'linkedin_search',
      title: 'LinkedIn Search', description: 'Industry · title · location',
      cfg: { job_titles: '', industries: '', locations: '' },
    },
    nodes: [
      { type: 'linkedin_visit', title: 'Profile visit', description: 'Warm up before the InMail' },
      { type: 'linkedin_inmail', title: 'InMail (Premium)', description: 'Cold InMail to non-connections', cfg: { message: 'Hi {{first_name}}, I came across your profile — I work with {{title}}s on outbound and thought this was worth a short note. Open to a quick exchange?' } },
      { type: 'followup_sequence', macroId: FOLLOWUP_STEP_ID, title: 'Follow-up sequence', description: '3 touches · LinkedIn', cfg: { channel: 'linkedin', touches: [{ hours: 48 }, { hours: 120 }, { hours: 240 }] } },
    ],
  },
  {
    key: 'signal_hunter',
    name: 'Signal Hunter',
    tagline: 'Catch companies showing buying signals and reach the decision maker',
    chain: ['Signal Search', 'Profile visit', 'Connect', 'Wait: accepted', 'Message'],
    source: {
      key: 'linkedin_signal',
      title: 'LinkedIn Signal Search', description: 'Hiring / buying signals · daily',
      cfg: { signal_query: 'companies hiring for revenue operations or sales development roles', decision_maker_titles: 'VP Sales, Head of Sales, CRO' },
    },
    nodes: [
      { type: 'linkedin_visit', title: 'Profile visit', description: 'Warm up before connecting' },
      { type: 'linkedin_connect', title: 'Connection request', description: 'AI-personalised note', cfg: { message: '' } },
      { type: 'condition', title: 'Wait for condition', description: 'Connection accepted', cfg: { condition: 'connection_accepted' } },
      { type: 'linkedin_message', title: 'Message', description: 'Signal-aware first message', cfg: { message: 'Hi {{first_name}}, saw {{company_name}} is growing the team — usually a sign outbound is about to scale. Happy to share what\'s working for similar teams if useful.' } },
    ],
  },
  {
    key: 'crm_reengage',
    name: 'CRM Re-Engage',
    tagline: 'Pull new Zoho contacts daily, reach out on LinkedIn, write results back',
    chain: ['Zoho daily', 'AI Agent', 'Connect', 'Wait: accepted', 'Message', 'Zoho write-back'],
    source: {
      key: 'zoho_recurring',
      title: 'Zoho CRM — recurring', description: 'Import new contacts daily',
      cfg: { zoho_modules: 'contacts' },
    },
    nodes: [
      { type: 'ai_parse', macroId: AI_STEP_ID, title: 'AI Agent', description: 'Clean & normalise lead data', cfg: { instruction: AI_DEFAULT_INSTRUCTION } },
      { type: 'linkedin_connect', title: 'Connection request', description: 'AI-personalised note', cfg: { message: '' } },
      { type: 'condition', title: 'Wait for condition', description: 'Connection accepted', cfg: { condition: 'connection_accepted' } },
      { type: 'linkedin_message', title: 'Message', description: 'First message after acceptance', cfg: { message: 'Hi {{first_name}}, great to connect! We already have you in our network — wanted to reach out personally.' } },
      { type: 'zoho_update', macroId: ZOHO_UPDATE_STEP_ID, title: 'Update Zoho record', description: 'Write back to Contacts', cfg: { module: 'Contacts', map: {} } },
    ],
  },
];

const SWITCH_FIELDS = [
  { value: 'tag', label: 'Tag' },
  { value: 'title', label: 'Job title' },
  { value: 'company', label: 'Company' },
  { value: 'seniority', label: 'Seniority' },
  { value: 'industry', label: 'Industry' },
  { value: 'location', label: 'Location' },
];
const SWITCH_OPS = [
  { value: 'equals', label: 'is' },
  { value: 'contains', label: 'contains' },
  { value: 'not_equals', label: 'is not' },
];

type DataPoint = { key: string; label: string; match: RegExp; needsChannel?: Channel };
const WORKFLOW_DATA_POINTS: DataPoint[] = [
  { key: 'full_name',          label: 'Full name',            match: /full.?name|^name$/i },
  { key: 'first_name',         label: 'First name',           match: /first.?name/i },
  { key: 'last_name',          label: 'Last name',            match: /last.?name/i },
  { key: 'email',              label: 'Email',                match: /e-?mail/i },
  { key: 'phone',              label: 'Phone',                match: /phone|mobile/i },
  { key: 'company',            label: 'Company',              match: /company|account.?name|organi[sz]ation/i },
  { key: 'title',              label: 'Job title',            match: /title|designation|\brole\b/i },
  { key: 'linkedin_url',       label: 'LinkedIn URL',         match: /linkedin/i, needsChannel: 'linkedin' },
  { key: 'instagram_url',      label: 'Instagram URL',        match: /instagram/i, needsChannel: 'instagram' },
  { key: 'seniority',          label: 'Seniority',            match: /seniority|\blevel\b/i },
  { key: 'department',         label: 'Department',           match: /department|division/i },
  { key: 'location',           label: 'Location',             match: /location|\bcity\b|\bstate\b|country|address/i },
  { key: 'industry',           label: 'Industry',             match: /industry|sector/i },
  { key: 'headline',           label: 'Headline / summary',   match: /headline|about|summary|description/i },
  { key: 'campaign_status',    label: 'Campaign status',      match: /lead.?status|\bstatus\b|\bstage\b/i },
  { key: 'campaign_name',      label: 'Campaign name',        match: /campaign/i },
  { key: 'last_channel',       label: 'Last channel used',    match: /channel|\bsource\b/i },
  { key: 'last_activity_date', label: "Today's date",         match: /date|last.?activity|modified/i },
  { key: 'notes',              label: 'Last message / notes', match: /\bnote|comment|remark/i },
];

/** Suggest a data-point for a Zoho field, sequence-aware (only maps a channel
 *  source when that channel is actually in the workflow). Returns key or ''. */
function suggestDataPoint(field: { api_name: string; field_label: string }, channels: Set<Channel>): string {
  const hay = `${field.field_label || ''} ${field.api_name || ''}`;
  for (const dp of WORKFLOW_DATA_POINTS) {
    if (dp.needsChannel && !channels.has(dp.needsChannel)) continue;
    if (dp.match.test(hay)) return dp.key;
  }
  return '';
}

// ─── Canvas (inner, needs ReactFlowProvider) ─────────────────────────────────

type BranchViz = { key: string; stepType: StepType; label: string; edgeLabel: string };

function BuilderCanvas({ steps, branches = [], switchId }: { steps: WorkflowPreviewStep[]; branches?: BranchViz[]; switchId?: string }) {
  // Base linear layout, then fan the Multi-condition node's branches out below
  // it (Router-style multiple outputs → a separate node per condition).
  const initialNodes = useMemo(() => {
    const base = createReactFlowNodes(steps, 'vertical');
    if (!switchId || !branches.length) return base;
    const sw = base.find((n) => n.id === switchId);
    if (!sw) return base;
    const spread = 210;
    const startX = sw.position.x - ((branches.length - 1) * spread) / 2;
    const branchNodes = branches.map((b, i) => ({
      id: `${switchId}-${b.key}`,
      type: 'custom',
      position: { x: startX + i * spread, y: sw.position.y + 200 },
      draggable: true,
      data: { title: b.label, type: b.stepType, description: b.key === 'else' ? 'fallback branch' : 'branch output', _layout: 'snake', _branch: true },
    }));
    return [...base, ...branchNodes];
  }, [steps, branches, switchId]);
  const initialEdges = useMemo(() => {
    // Drop the linear edge leaving the switch — its outputs are the branches.
    const base = createReactFlowEdges(steps, 'vertical').filter((e) => e.source !== switchId);
    if (!switchId || !branches.length) return base;
    const fan = branches.map((b) => ({
      id: `e-${switchId}-${b.key}`,
      source: switchId, sourceHandle: 'bottom',
      target: `${switchId}-${b.key}`, targetHandle: 'top',
      type: 'labeled',
      animated: false,
      data: { label: b.edgeLabel, color: '#d97706' },
      style: { stroke: '#d97706', strokeWidth: 2, strokeDasharray: '6,6' },
    }));
    return [...base, ...fan];
  }, [steps, branches, switchId]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  useEffect(() => { setNodes(initialNodes); setEdges(initialEdges); }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes} edges={edges}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes} edgeTypes={edgeTypes}
      proOptions={{ hideAttribution: true }}
      fitView minZoom={0.3} maxZoom={1.2}
    >
      <WorkflowCanvas
        flowNodes={nodes} flowEdges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes} workflowLength={steps.length}
      />
    </ReactFlow>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

/** Loads the connected accounts/templates a step config can reference:
 *  voice agents + numbers, email senders + templates, WhatsApp accounts +
 *  templates, LinkedIn templates. Reuses the same hooks/endpoints the
 *  advanced-search wizard uses. */
function useBuilderResources() {
  const voice = useVoiceAgent(false);
  const { data: emailSenders = [] } = useConnectedEmailSenders();
  const { data: emailTemplates = [] } = useEmailTemplates({ is_active: true });
  const [waAccounts, setWaAccounts] = useState<any[]>([]);
  const [waTemplates, setWaTemplates] = useState<any[]>([]);
  const [liTemplates, setLiTemplates] = useState<any[]>([]);

  useEffect(() => { voice.fetchAll?.().catch(() => {}); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    fetch('/api/social-integration/whatsapp/accounts', { credentials: 'include' })
      .then((r) => r.json()).then((d) => { if (Array.isArray(d?.accounts)) setWaAccounts(d.accounts); }).catch(() => {});
    fetch('/api/campaigns/whatsapp-templates', { credentials: 'include' })
      .then((r) => r.json()).then((d) => { if (d?.success) setWaTemplates(d.data || []); }).catch(() => {});
    fetch('/api/campaigns/linkedin-message-templates', { credentials: 'include' })
      .then((r) => r.json()).then((d) => { if (d?.success) setLiTemplates(d.data || []); }).catch(() => {});
  }, []);

  const voiceAgents = (voice.agents || []).map((a: any) => ({ id: a.agent_id || a.id || '', name: a.agent_name || a.name || 'Agent', voice_id: a.voice_id || '' })).filter((a: any) => a.id);
  const voiceNumbers = (voice.numbers || []).map((n: any) => {
    let num = n.phone_number || '';
    if (!num || num === '+' || num.includes('null')) num = (n.country_code && n.base_number) ? `+${n.country_code}${n.base_number}` : '';
    return { phone_number: num };
  }).filter((n: any) => n.phone_number && n.phone_number !== '+');

  return {
    voiceAgents, voiceNumbers,
    emailSenders: (emailSenders as any[]) || [],
    emailTemplates: (emailTemplates as any[]) || [],
    waAccounts, waTemplates, liTemplates,
  };
}

export function CustomWorkflowBuilder({ onClose }: { onClose: () => void }) {
  const { workflowPreview, setWorkflowPreview, addWorkflowStep, updateWorkflowStep } = useOnboardingStore();
  const res = useBuilderResources();

  const [name, setName] = useState('');
  const [perDay, setPerDay] = useState('25');
  const [days, setDays] = useState('30');
  const [source, setSource] = useState<SourceKey | null>(null);
  // Per-node launch config, keyed by step id (store steps only carry visuals).
  const [configs, setConfigs] = useState<Record<string, any>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Zoho write-back node: the target module's field metadata (fetched lazily).
  const [zohoFields, setZohoFields] = useState<any[]>([]);
  const [zohoFieldsLoading, setZohoFieldsLoading] = useState(false);
  const [zohoFieldsError, setZohoFieldsError] = useState<string | null>(null);
  // AI Media node: generated-asset gallery + studio modal.
  const mediaBuilder = useMediaBuilder();
  const [showMediaStudio, setShowMediaStudio] = useState(false);
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false);
  const [mediaImporting, setMediaImporting] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  // "Export now" (builder test run) state.
  const [exportRunning, setExportRunning] = useState(false);
  const [exportResult, setExportResult] = useState<any>(null);
  // LinkedIn auto-post state.
  const [autopostGenerating, setAutopostGenerating] = useState(false);
  const [autopostPosting, setAutopostPosting] = useState(false);
  const [autopostMsg, setAutopostMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [liOrganizations, setLiOrganizations] = useState<{ id: string; name: string }[]>([]);
  // Multi-condition node: fields of the connected source (dynamic dropdown).
  const [mcFields, setMcFields] = useState<{ value: string; label: string }[]>(SWITCH_FIELDS);
  const [mcFieldsLoading, setMcFieldsLoading] = useState(false);
  // File import source: parsed grid + header→field mapping.
  const [fileName, setFileName] = useState('');
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<string[][]>([]);
  const [fileMapping, setFileMapping] = useState<Record<number, string>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileParsing, setFileParsing] = useState(false);

  // Fresh canvas on mount. The store is SHARED with the chat-built workflow
  // preview (advanced-search-ai) — snapshot it and restore on close so opening
  // the builder never clobbers an in-progress campaign preview.
  useEffect(() => {
    const snapshot = useOnboardingStore.getState().workflowPreview;
    setWorkflowPreview([]);
    return () => setWorkflowPreview(snapshot);
  }, [setWorkflowPreview]);

  // Node edit clicks (CustomWorkflowNode dispatches 'openStepEditor').
  useEffect(() => {
    const onEdit = (e: any) => {
      const id: string = e.detail?.stepId || '';
      // Clicking a fanned-out branch node opens the Multi-condition editor.
      setEditingId(id.startsWith(`${MULTICOND_STEP_ID}-`) ? MULTICOND_STEP_ID : (id || null));
    };
    window.addEventListener('openStepEditor', onEdit);
    return () => window.removeEventListener('openStepEditor', onEdit);
  }, []);

  const pickSource = (key: SourceKey) => {
    setSource(key);
    const def = SOURCES.find((s) => s.key === key)!;
    const step: WorkflowPreviewStep = {
      id: SOURCE_STEP_ID, type: 'lead_generation', channel: 'linkedin',
      title: def.label, description: def.sub,
    };
    const rest = workflowPreview.filter((s) => s.id !== SOURCE_STEP_ID);
    setWorkflowPreview([step, ...rest]);
    setEditingId(SOURCE_STEP_ID);
  };

  const addOutreach = (type: StepType) => {
    const def = OUTREACH.find((o) => o.type === type)!;
    const id = nextId();
    addWorkflowStep({ id, type, channel: def.channel, title: def.label, description: '' });
    setEditingId(id);
  };

  const addRouter = () => {
    const id = `rt-${Date.now()}-${stepSeq++}`;
    addWorkflowStep({ id, type: 'condition', channel: 'linkedin', title: 'Router — fallback', description: '3 tries → Email' });
    setEditingId(id);
  };

  const addFollowup = () => {
    if (!workflowPreview.some((s) => s.id === FOLLOWUP_STEP_ID)) {
      addWorkflowStep({ id: FOLLOWUP_STEP_ID, type: 'followup_sequence', channel: 'linkedin', title: 'Follow-up sequence', description: '3 touches · LinkedIn' });
      // Seed the per-touch timeline (hours) — mirrors the WABA per-touch defaults.
      setCfg(FOLLOWUP_STEP_ID, { channel: 'linkedin', touches: [{ hours: 24 }, { hours: 72 }, { hours: 168 }] });
    }
    setEditingId(FOLLOWUP_STEP_ID);
  };

  const addAnalytics = () => {
    if (!workflowPreview.some((s) => s.id === ANALYTICS_STEP_ID)) {
      addWorkflowStep({ id: ANALYTICS_STEP_ID, type: 'analytics_report', channel: 'email', title: 'Analytics report', description: 'Daily · Email' });
    }
    setEditingId(ANALYTICS_STEP_ID);
  };

  const addZohoUpdate = () => {
    if (!workflowPreview.some((s) => s.id === ZOHO_UPDATE_STEP_ID)) {
      addWorkflowStep({ id: ZOHO_UPDATE_STEP_ID, type: 'zoho_update', channel: 'linkedin', title: 'Update Zoho record', description: 'Write back to Contacts' });
      setCfg(ZOHO_UPDATE_STEP_ID, { module: 'Contacts', map: {} });
    }
    setEditingId(ZOHO_UPDATE_STEP_ID);
  };

  const addMedia = () => {
    if (!workflowPreview.some((s) => s.id === MEDIA_STEP_ID)) {
      addWorkflowStep({ id: MEDIA_STEP_ID, type: 'media_generation', channel: 'email', title: 'AI Media', description: 'Generate media to attach' });
    }
    setEditingId(MEDIA_STEP_ID);
  };

  const addMultiCond = () => {
    if (!workflowPreview.some((s) => s.id === MULTICOND_STEP_ID)) {
      addWorkflowStep({ id: MULTICOND_STEP_ID, type: 'switch', channel: 'email', title: 'Multi-condition', description: '2 conditions + else' });
      setCfg(MULTICOND_STEP_ID, {
        field: 'tag',
        cases: [
          { op: 'equals', value: '', channel: 'email', subject: '', body: '' },
          { op: 'equals', value: '', channel: 'email', subject: '', body: '' },
        ],
        default: { channel: 'email', subject: '', body: '' },
      });
    }
    setEditingId(MULTICOND_STEP_ID);
  };

  const addAiParse = () => {
    if (!workflowPreview.some((s) => s.id === AI_STEP_ID)) {
      addWorkflowStep({ id: AI_STEP_ID, type: 'ai_parse', channel: 'linkedin', title: 'AI Agent', description: 'Clean & normalise lead data' });
      setCfg(AI_STEP_ID, { instruction: AI_DEFAULT_INSTRUCTION });
    }
    setEditingId(AI_STEP_ID);
  };

  const addDataEnrich = () => {
    if (!workflowPreview.some((s) => s.id === ENRICH_STEP_ID)) {
      addWorkflowStep({ id: ENRICH_STEP_ID, type: 'data_enrich', channel: 'email', title: 'Enrich contact', description: 'Official email · Phone' });
      setCfg(ENRICH_STEP_ID, { enrich: ['official_email', 'phone'] });
    }
    setEditingId(ENRICH_STEP_ID);
  };

  /** Map the parsed file grid + header mapping into lead objects. Shared by the
   *  launch payload and the "Export now" test run. */
  const buildLeadsFromFile = useCallback(() => {
    const colOf = (f: string) => { const e = Object.entries(fileMapping).find(([, v]) => v === f); return e ? Number(e[0]) : -1; };
    const idx = { full_name: colOf('full_name'), first_name: colOf('first_name'), last_name: colOf('last_name'), company: colOf('company'), title: colOf('title'), location: colOf('location'), email: colOf('email'), phone: colOf('phone'), linkedin_url: colOf('linkedin_url'), website: colOf('website') };
    const val = (r: string[], i: number) => (i >= 0 ? (r[i] || '').trim() : '');
    return fileRows.map((r) => {
      const first = val(r, idx.first_name), last = val(r, idx.last_name);
      const full = val(r, idx.full_name) || [first, last].filter(Boolean).join(' ');
      return {
        name: full || undefined,
        first_name: first || (full ? full.split(' ')[0] : undefined),
        last_name: last || (full ? full.split(' ').slice(1).join(' ') || undefined : undefined),
        company_name: val(r, idx.company) || undefined,
        title: val(r, idx.title) || undefined,
        location: val(r, idx.location) || undefined,
        email: val(r, idx.email) || undefined,
        phone: val(r, idx.phone) || undefined,
        linkedin_url: val(r, idx.linkedin_url) || undefined,
      };
    });
  }, [fileRows, fileMapping]);

  /** "Export now" — test the configured export against the leads loaded in the
   *  builder, so destinations (email / webhook / Slack …) are proven before launch. */
  const runExportNow = async () => {
    const cfg = configs[EXPORT_STEP_ID] || {};
    const leads = source === 'file_import' ? buildLeadsFromFile() : [];
    setExportRunning(true);
    setExportResult(null);
    try {
      const res = await fetchWithTenant('/api/campaigns/export/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: cfg, leads, campaign_name: name.trim() || 'Workflow preview' }),
      });
      const data = await res.json();
      setExportResult(data);
    } catch (e: any) {
      setExportResult({ success: false, error: e?.message || 'Export failed' });
    } finally {
      setExportRunning(false);
    }
  };

  const addAutopost = () => {
    if (!workflowPreview.some((s) => s.id === AUTOPOST_STEP_ID)) {
      addWorkflowStep({ id: AUTOPOST_STEP_ID, type: 'linkedin_post', channel: 'linkedin', title: 'LinkedIn auto-post', description: 'Weekly · Mon' });
      setCfg(AUTOPOST_STEP_ID, {
        content: '',
        frequency: 'weekly',
        days: [1],
        time: '09:00',
        ai_generate: false,
        post_as: 'personal',
      });
    }
    setEditingId(AUTOPOST_STEP_ID);
  };

  /** "Generate with AI" — drafts the post from ICP + campaign context. */
  const generateAutopost = async () => {
    const eid = AUTOPOST_STEP_ID;
    const c = configs[eid] || {};
    setAutopostGenerating(true);
    setAutopostMsg(null);
    try {
      const res = await fetchWithTenant('/api/campaigns/linkedin-post/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: c.content || '', instruction: c.ai_instruction || '' }),
      });
      const data = await res.json();
      if (data?.success && data.content) {
        setCfg(eid, { content: data.content });
        updateWorkflowStep(eid, { description: data.content.slice(0, 40) });
        setAutopostMsg({ ok: true, text: 'Draft generated — edit it below before posting.' });
      } else {
        setAutopostMsg({ ok: false, text: data?.error || 'Could not generate a post.' });
      }
    } catch (e: any) {
      setAutopostMsg({ ok: false, text: e?.message || 'Could not generate a post.' });
    } finally {
      setAutopostGenerating(false);
    }
  };

  /** "Post now" — publishes immediately so the user can see it land. */
  const postAutopostNow = async () => {
    const c = configs[AUTOPOST_STEP_ID] || {};
    if (!(c.content || '').trim()) {
      setAutopostMsg({ ok: false, text: 'Write or generate the post content first.' });
      return;
    }
    setAutopostPosting(true);
    setAutopostMsg(null);
    try {
      const res = await fetchWithTenant('/api/campaigns/linkedin-post/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: c.content,
          media_url: c.media_url || undefined,
          media_filename: c.media_filename || undefined,
          external_link: c.external_link || undefined,
          as_organization: c.post_as && c.post_as !== 'personal' ? c.post_as : undefined,
        }),
      });
      const data = await res.json();
      setAutopostMsg(data?.success
        ? { ok: true, text: 'Posted to LinkedIn.' }
        : { ok: false, text: data?.error || 'Could not post.' });
    } catch (e: any) {
      setAutopostMsg({ ok: false, text: e?.message || 'Could not post.' });
    } finally {
      setAutopostPosting(false);
    }
  };

  /**
   * Apply a template: replaces the canvas with the recipe's source + nodes and
   * seeds every drawer config in one shot. Opens the source drawer afterwards
   * so the user lands on the targeting fields they still need to fill.
   */
  const applyTemplate = (t: WorkflowTemplate) => {
    if (workflowPreview.length > 0 &&
        !window.confirm(`Replace the current workflow with the "${t.name}" template?`)) {
      return;
    }
    const srcDef = SOURCES.find((s) => s.key === t.source.key)!;
    const steps: WorkflowPreviewStep[] = [{
      id: SOURCE_STEP_ID, type: 'lead_generation',
      channel: t.source.key.startsWith('linkedin') ? 'linkedin' : 'email',
      title: t.source.title || srcDef.label,
      description: t.source.description || srcDef.sub,
    }];
    const cfgs: Record<string, any> = {};
    if (t.source.cfg) cfgs[SOURCE_STEP_ID] = { ...t.source.cfg };

    for (const n of t.nodes) {
      const id = n.macroId || nextId();
      const channel = n.type.startsWith('linkedin') ? 'linkedin'
        : n.type.startsWith('email') ? 'email'
        : n.type.startsWith('whatsapp') ? 'whatsapp'
        : n.type === 'voice_agent_call' ? 'voice'
        : n.type === 'condition' ? 'linkedin'
        : 'email';
      steps.push({ id, type: n.type, channel, title: n.title, description: n.description } as WorkflowPreviewStep);
      if (n.cfg) cfgs[id] = { ...n.cfg };
    }

    setSource(t.source.key);
    setWorkflowPreview(steps);
    setConfigs(cfgs);
    if (!name.trim()) setName(t.name);
    setError(null);
    setEditingId(SOURCE_STEP_ID);
  };

  const addExport = () => {
    if (!workflowPreview.some((s) => s.id === EXPORT_STEP_ID)) {
      addWorkflowStep({ id: EXPORT_STEP_ID, type: 'export_results', channel: 'email', title: 'Export results', description: 'CSV · Download' });
      setCfg(EXPORT_STEP_ID, {
        format: 'csv',
        destinations: ['file'],
        columns: EXPORT_DEFAULT_COLUMNS,
        run_on_completion: true,
      });
    }
    setEditingId(EXPORT_STEP_ID);
  };

  const setCfg = useCallback((id: string, patch: any) => {
    setConfigs((c) => ({ ...c, [id]: { ...(c[id] || {}), ...patch } }));
  }, []);

  const handleImportFile = useCallback(async (file: File) => {
    setFileError(null); setFileParsing(true);
    try {
      const { headers, rows } = await parseImportFile(file);
      setFileName(file.name);
      setFileHeaders(headers);
      setFileRows(rows);
      const auto: Record<number, string> = {};
      headers.forEach((h, i) => { auto[i] = suggestImportField(h); });
      setFileMapping(auto);
    } catch (e: any) {
      setFileError(e?.message || 'Could not read the file.');
      setFileName(''); setFileHeaders([]); setFileRows([]); setFileMapping({});
    } finally {
      setFileParsing(false);
    }
  }, []);

  const mediaTypeFromName = (name: string): 'image' | 'video' | 'document' => {
    const ext = (name.split('?')[0].split('.').pop() || '').toLowerCase();
    if (['mp4', 'webm', 'mov', '3gp'].includes(ext)) return 'video';
    if (['pdf', 'doc', 'docx'].includes(ext)) return 'document';
    return 'image';
  };

  // Re-home a generated asset (MAGe 7-day signed URL) into the permanent
  // campaign bucket and attach it to the AI Media node.
  const importGenerated = useCallback(async (sourceUrl: string) => {
    if (!sourceUrl) return;
    setMediaImporting(true); setMediaError(null);
    try {
      const filename = decodeURIComponent(sourceUrl.split('?')[0].split('/').pop() || 'generated-media');
      const res = await fetchWithTenant('/api/campaigns/media/import-generated', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_url: sourceUrl, media_type: mediaTypeFromName(filename), filename }),
      });
      const d = await res.json();
      if (!res.ok || !d?.url) throw new Error(d?.error || `Import failed (${res.status})`);
      setCfg(MEDIA_STEP_ID, {
        media_url: d.url,
        media_type: d.media_type || mediaTypeFromName(d.filename || filename),
        media_filename: d.filename || filename,
      });
      updateWorkflowStep(MEDIA_STEP_ID, { description: `${d.media_type || mediaTypeFromName(filename)} attached` });
      setMediaGalleryOpen(false);
    } catch (e: any) {
      setMediaError(e?.message || 'Failed to import media');
    } finally {
      setMediaImporting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setCfg, updateWorkflowStep]);

  // Lazy-load the LinkedIn company pages the account may post as. Fails soft —
  // an empty list simply leaves "personal profile" as the only option.
  useEffect(() => {
    if (editingId !== AUTOPOST_STEP_ID || liOrganizations.length) return;
    let cancelled = false;
    fetchWithTenant('/api/campaigns/linkedin-post/organizations')
      .then((r) => r.json())
      .then((d) => { if (!cancelled && Array.isArray(d?.data)) setLiOrganizations(d.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [editingId, liOrganizations.length]);

  // Lazy-load Zoho field metadata when the write-back node is open, per module.
  const zohoModule = configs[ZOHO_UPDATE_STEP_ID]?.module === 'Leads' ? 'Leads' : 'Contacts';
  useEffect(() => {
    if (editingId !== ZOHO_UPDATE_STEP_ID) return;
    let cancelled = false;
    setZohoFieldsLoading(true); setZohoFieldsError(null);
    fetch(`/api/social-integration/zoho/fields?module=${zohoModule}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.success && Array.isArray(d.fields)) setZohoFields(d.fields);
        else { setZohoFields([]); setZohoFieldsError(d?.error || 'Could not load Zoho fields'); }
      })
      .catch(() => { if (!cancelled) { setZohoFields([]); setZohoFieldsError('Could not load Zoho fields — is Zoho connected?'); } })
      .finally(() => { if (!cancelled) setZohoFieldsLoading(false); });
    return () => { cancelled = true; };
  }, [editingId, zohoModule]);

  // Multi-condition: load the connected source's fields for the "Branch on"
  // dropdown. Zoho sources → the module's real fields via /fields; other
  // sources → the generic semantic field list.
  useEffect(() => {
    if (editingId !== MULTICOND_STEP_ID) return;
    const isZoho = source === 'zoho_recurring' || source === 'zoho_once';
    if (!isZoho) { setMcFields(SWITCH_FIELDS); return; }
    const mod = (configs[SOURCE_STEP_ID]?.zoho_modules === 'contacts_leads' || configs[SOURCE_STEP_ID]?.zoho_type === 'leads') ? 'Leads' : 'Contacts';
    let cancelled = false;
    setMcFieldsLoading(true);
    fetch(`/api/social-integration/zoho/fields?module=${mod}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d?.success && Array.isArray(d.fields) && d.fields.length) {
          const fetched = d.fields.map((f: any) => ({ value: f.api_name, label: f.field_label || f.api_name }));
          // 'Tag' is a semantic pseudo-field (Zoho tags aren't a writable field);
          // prepend it if the module's field list didn't already include one.
          const hasTag = fetched.some((f: { value: string }) => /tag/i.test(f.value));
          setMcFields(hasTag ? fetched : [{ value: 'tag', label: 'Tag' }, ...fetched]);
        } else { setMcFields(SWITCH_FIELDS); }
      })
      .catch(() => { if (!cancelled) setMcFields(SWITCH_FIELDS); })
      .finally(() => { if (!cancelled) setMcFieldsLoading(false); });
    return () => { cancelled = true; };
  }, [editingId, source, configs]);

  const editingStep = workflowPreview.find((s) => s.id === editingId) || null;
  const cfg = editingId ? (configs[editingId] || {}) : {};

  // Router-style branch visualisation for the Multi-condition node: one output
  // node per condition (+ else), fanned out on the canvas.
  const CH_TO_STEP: Record<string, StepType> = { email: 'email_send', linkedin: 'linkedin_message', whatsapp: 'whatsapp_send' };
  const mcBranches: BranchViz[] = useMemo(() => {
    if (!workflowPreview.some((s) => s.id === MULTICOND_STEP_ID)) return [];
    const c = configs[MULTICOND_STEP_ID] || {};
    const fLabel = mcFields.find((f) => f.value === (c.field || 'tag'))?.label || 'field';
    const opLabel = (op: string) => SWITCH_OPS.find((o) => o.value === op)?.label || 'is';
    const rows: any[] = Array.isArray(c.cases) && c.cases.length ? c.cases : [{}];
    const out: BranchViz[] = rows.map((cs, i) => {
      const v = (cs?.value || '').trim();
      return {
        key: `b${i}`,
        stepType: CH_TO_STEP[cs?.channel] || 'email_send',
        label: v ? `If ${fLabel} ${opLabel(cs?.op || 'equals')} "${v}"` : `Condition ${i + 1}`,
        edgeLabel: (v ? `${opLabel(cs?.op || 'equals')} ${v}` : `#${i + 1}`).slice(0, 22),
      };
    });
    out.push({ key: 'else', stepType: CH_TO_STEP[(c.default?.channel)] || 'email_send', label: 'Otherwise', edgeLabel: 'else' });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowPreview, configs, mcFields]);

  // ── Launch ────────────────────────────────────────────────────────────────
  const launch = async () => {
    setError(null);
    if (!name.trim()) { setError('Name your workflow.'); return; }
    if (!source) { setError('Pick a contact source (first node).'); return; }
    // LinkedIn Search needs at least one criterion — templates seed these empty
    // on purpose, so catch it here with a pointer instead of a backend 400.
    if (source === 'linkedin_search') {
      const sc = configs[SOURCE_STEP_ID] || {};
      const any = [sc.keywords, sc.job_titles, sc.industries, sc.locations]
        .some((v) => String(v || '').trim());
      if (!any) {
        setError('Fill the LinkedIn Search targeting — at least one of job title, industry, location, or keywords.');
        setEditingId(SOURCE_STEP_ID);
        return;
      }
    }
    const outreachSteps = workflowPreview.filter(
      (s) => s.id !== SOURCE_STEP_ID && s.id !== FOLLOWUP_STEP_ID && s.id !== ANALYTICS_STEP_ID && s.id !== ZOHO_UPDATE_STEP_ID && s.id !== MEDIA_STEP_ID && s.id !== MULTICOND_STEP_ID && s.id !== AI_STEP_ID && s.id !== ENRICH_STEP_ID && s.id !== EXPORT_STEP_ID && s.id !== AUTOPOST_STEP_ID
    );
    const aiNode = workflowPreview.find((s) => s.id === AI_STEP_ID);
    const enrichNode = workflowPreview.find((s) => s.id === ENRICH_STEP_ID);
    const mediaNode = workflowPreview.find((s) => s.id === MEDIA_STEP_ID);
    const multiCondNode = workflowPreview.find((s) => s.id === MULTICOND_STEP_ID);
    const followupNode = workflowPreview.find((s) => s.id === FOLLOWUP_STEP_ID);
    const analyticsNode = workflowPreview.find((s) => s.id === ANALYTICS_STEP_ID);
    const exportNode = workflowPreview.find((s) => s.id === EXPORT_STEP_ID);
    const autopostNode = workflowPreview.find((s) => s.id === AUTOPOST_STEP_ID);
    const zohoUpdateNode = workflowPreview.find((s) => s.id === ZOHO_UPDATE_STEP_ID);
    if (!outreachSteps.length && !followupNode && !multiCondNode) { setError('Add at least one outreach step.'); return; }
    if (multiCondNode) {
      const mcCases: any[] = (configs[MULTICOND_STEP_ID]?.cases) || [];
      const validCases = mcCases.filter((c) => (c.value || '').trim() && (c.body || c.subject || '').trim());
      if (!validCases.length) { setError('Add at least one condition (value + message) in the Multi-condition node.'); setEditingId(MULTICOND_STEP_ID); return; }
    }
    if (analyticsNode && !(configs[ANALYTICS_STEP_ID]?.recipient || '').trim()) {
      setError('Add a recipient (email or WhatsApp number) in the Analytics report node.'); setEditingId(ANALYTICS_STEP_ID); return;
    }
    if (source === 'linkedin_signal' && !(configs[SOURCE_STEP_ID]?.signal_query || '').trim()) {
      setError('Describe the signal to search for in the LinkedIn Signal Search source.'); setEditingId(SOURCE_STEP_ID); return;
    }
    if (source === 'file_import') {
      if (!fileRows.length) { setError('Upload a CSV/Excel file in the File import source.'); setEditingId(SOURCE_STEP_ID); return; }
      const mapped = Object.values(fileMapping);
      if (!mapped.includes('full_name') && !(mapped.includes('first_name') || mapped.includes('last_name')) && !mapped.includes('company') && !mapped.includes('email') && !mapped.includes('linkedin_url')) {
        setError('Map at least a name, company, email, or LinkedIn column in the File import source.'); setEditingId(SOURCE_STEP_ID); return;
      }
    }
    setLaunching(true);

    const perDayN = Math.max(1, parseInt(perDay, 10) || 25);
    const daysN = Math.max(1, parseInt(days, 10) || 30);
    const srcCfg = configs[SOURCE_STEP_ID] || {};
    const start = new Date(); const end = new Date(); end.setDate(end.getDate() + daysN);

    let order = 0;
    const steps: any[] = [];
    let initialLeads: any[] | undefined;

    try {
      // Source node → lead_generation step (recurring) or initial_leads (one-time).
      if (source === 'zoho_recurring') {
        steps.push({
          type: 'lead_generation', title: 'Import from Zoho CRM', channel: 'linkedin', order_index: order++,
          config: {
            source: 'zoho_contacts',
            zoho_modules: srcCfg.zoho_modules || 'contacts',
            zoho_tag: (srcCfg.zoho_tag || '').trim() || undefined,
            leadGenerationLimit: perDayN,
          },
        });
      } else if (source === 'linkedin_search') {
        // Structured targeting — the backend normalises job_titles → roles,
        // locations → location, industries as-is (LeadGenerationService).
        const csv = (v: any) => String(v || '').split(',').map((s: string) => s.trim()).filter(Boolean);
        const jt = csv(srcCfg.job_titles), ind = csv(srcCfg.industries), loc = csv(srcCfg.locations);
        steps.push({
          type: 'lead_generation', title: 'LinkedIn Lead Search', channel: 'linkedin', order_index: order++,
          config: {
            source: 'linkedin_search',
            leadGenerationFilters: {
              keywords: (srcCfg.keywords || '').trim(),
              ...(jt.length ? { job_titles: jt } : {}),
              ...(ind.length ? { industries: ind } : {}),
              ...(loc.length ? { locations: loc } : {}),
            },
            leadGenerationLimit: perDayN,
          },
        });
      } else if (source === 'linkedin_signal') {
        const titles = (srcCfg.decision_maker_titles || '')
          .split(',').map((t: string) => t.trim()).filter(Boolean);
        steps.push({
          type: 'lead_generation', title: 'Signal Lead Search', channel: 'linkedin', order_index: order++,
          config: {
            source: 'signal_detection',
            signal_query: (srcCfg.signal_query || '').trim(),
            decision_maker_titles: titles,
            leadGenerationLimit: perDayN,
          },
        });
      } else if (source === 'file_import') {
        // File import: build initial_leads from the parsed grid + header mapping.
        // Leads carrying name+company (but no LinkedIn URL) are resolved by the
        // LinkedIn step's Unipile name+company waterfall at execution time.
        const colOf = (f: string) => { const e = Object.entries(fileMapping).find(([, v]) => v === f); return e ? Number(e[0]) : -1; };
        const idx = { full_name: colOf('full_name'), first_name: colOf('first_name'), last_name: colOf('last_name'), company: colOf('company'), title: colOf('title'), location: colOf('location'), email: colOf('email'), phone: colOf('phone'), linkedin_url: colOf('linkedin_url'), website: colOf('website') };
        const val = (r: string[], i: number) => (i >= 0 ? (r[i] || '').trim() : '');
        initialLeads = fileRows.map((r, i) => {
          const first = val(r, idx.first_name), last = val(r, idx.last_name);
          const full = val(r, idx.full_name) || [first, last].filter(Boolean).join(' ');
          const email = val(r, idx.email), li = val(r, idx.linkedin_url), company = val(r, idx.company);
          // Content-based sourceId so dedup is meaningful and rows never collide
          // across imports (a plain row number "1" would dedup with other lists).
          const key = (email || li || `${full}|${company}` || `row-${i + 1}`).trim().toLowerCase() || `row-${i + 1}`;
          return {
            id: `file:${key}`,
            name: full || undefined,
            first_name: first || (full ? full.split(' ')[0] : undefined),
            last_name: last || (full ? full.split(' ').slice(1).join(' ') || undefined : undefined),
            company_name: val(r, idx.company) || undefined,
            title: val(r, idx.title) || undefined,
            location: val(r, idx.location) || undefined,
            email: val(r, idx.email) || undefined,
            phone: val(r, idx.phone) || undefined,
            linkedin_url: val(r, idx.linkedin_url) || undefined,
            website: val(r, idx.website) || undefined,
          };
        }).filter((l) => l.name || l.company_name || l.email || l.linkedin_url);
        if (!initialLeads.length) throw new Error('No usable rows after mapping — check your column mapping.');
      } else {
        // One-time import: fetch synced contacts now → initial_leads at create.
        const limit = Math.min(500, Math.max(1, parseInt(srcCfg.import_count, 10) || 100));
        const url = source === 'zoho_once'
          ? `/api/social-integration/zoho/records/local?type=${srcCfg.zoho_type === 'leads' ? 'leads' : 'contacts'}&page=1&limit=${limit}`
          : `/api/social-integration/gohighlevel/contacts/local?page=1&limit=${limit}`;
        const res = await fetchWithTenant(url);
        const data = await res.json();
        const rows = data?.data || [];
        if (!rows.length) throw new Error('No synced contacts found for this source — sync it first.');
        initialLeads = rows.map((c: any, i: number) => ({
          id: String(c.source_id || c.id || i),
          first_name: c.first_name || undefined,
          last_name: c.last_name || undefined,
          name: c.name || [c.first_name, c.last_name].filter(Boolean).join(' ') || undefined,
          email: c.email || undefined,
          phone: c.phone || undefined,
          company_name: c.company_name || undefined,
        }));
      }

      // AI Agent → an ai_parse step that runs BEFORE outreach, so the LinkedIn
      // step sees the cleaned single title / normalised name+company. (Emitted
      // here, right after the source's lead_generation / initial_leads.)
      if (aiNode) {
        steps.push({
          type: 'ai_parse', title: 'AI Agent', channel: 'linkedin', order_index: order++,
          config: { instruction: (configs[AI_STEP_ID]?.instruction || AI_DEFAULT_INSTRUCTION).trim() },
        });
      }

      // Data Enrichment → a data_enrich step (after AI cleanup, before outreach)
      // so the email/WhatsApp/voice steps have the revealed email/phone.
      if (enrichNode) {
        const sel: string[] = Array.isArray(configs[ENRICH_STEP_ID]?.enrich) ? configs[ENRICH_STEP_ID].enrich : ['official_email', 'phone'];
        if (sel.length) {
          steps.push({
            type: 'data_enrich', title: 'Enrich contact', channel: 'email', order_index: order++,
            config: { enrich: sel },
          });
        }
      }

      // Outreach nodes in canvas order.
      for (const s of outreachSteps) {
        const c = configs[s.id] || {};
        // Router node: guard the PREVIOUS engine step — after N failed
        // attempts the engine marks it exhausted and runs the fallback step;
        // if it succeeds, the fallback is skipped (WorkflowProcessor).
        if (s.id.startsWith('rt-')) {
          const rc = c;
          const prev = steps[steps.length - 1];
          if (!prev || prev.type === 'wait_for_condition' || prev.type === 'lead_generation') {
            throw new Error('Place the Router right after the outreach step it should guard.');
          }
          prev.config = { ...(prev.config || {}), router: { id: s.id, after_attempts: Math.min(10, Math.max(1, parseInt(rc.attempts, 10) || 3)) } };
          const fb = ['whatsapp', 'linkedin', 'voice'].includes(rc.fallback_channel) ? rc.fallback_channel : 'email';
          const gate = { run_if_failed_of: s.id, delayDays: 0, delayHours: 0 };
          if (fb === 'whatsapp') steps.push({ type: 'whatsapp_send', title: 'Fallback: WhatsApp', channel: 'whatsapp', order_index: order++, config: { whatsappMessage: (rc.message || '').trim(), ...gate } });
          else if (fb === 'linkedin') steps.push({ type: 'linkedin_message', title: 'Fallback: LinkedIn message', channel: 'linkedin', order_index: order++, config: { message: (rc.message || '').trim(), ...gate } });
          else if (fb === 'voice') steps.push({ type: 'voice_agent_call', title: 'Fallback: AI voice call', channel: 'voice', order_index: order++, config: { ...gate } });
          else steps.push({ type: 'email_send', title: 'Fallback: Email', channel: 'email', order_index: order++, config: { subject: (rc.subject || '').trim(), body: (rc.message || '').trim(), ...gate } });
          continue;
        }
        const delay = { delayDays: Math.max(0, parseInt(c.delayDays, 10) || 0), delayHours: 0 };
        if (s.type === 'linkedin_connect') steps.push({ type: s.type, title: 'Send Connection Request', channel: 'linkedin', order_index: order++, config: { message: (c.message || '').trim(), template_id: c.linkedin_template_id || undefined, ...delay } });
        else if (s.type === 'linkedin_message') steps.push({ type: s.type, title: 'Send LinkedIn Message', channel: 'linkedin', order_index: order++, config: { message: (c.message || '').trim(), template_id: c.linkedin_template_id || undefined, ...delay } });
        else if (s.type === 'linkedin_inmail') steps.push({ type: s.type, title: 'Send LinkedIn InMail', channel: 'linkedin', order_index: order++, config: { message: (c.message || '').trim(), subject: (c.subject || '').trim() || undefined, template_id: c.linkedin_template_id || undefined, ...delay } });
        else if (s.type === 'linkedin_visit') steps.push({ type: s.type, title: 'Visit LinkedIn Profile', channel: 'linkedin', order_index: order++, config: { ...delay } });
        else if (s.type === 'email_send') steps.push({ type: s.type, title: 'Send Email', channel: 'email', order_index: order++, config: { subject: (c.subject || '').trim(), body: (c.body || '').trim(), from_email: c.from_email || undefined, email_provider: c.email_provider || undefined, template_id: c.template_id || undefined, ...delay } });
        else if (s.type === 'whatsapp_send') steps.push({ type: s.type, title: 'Send WhatsApp Message', channel: 'whatsapp', order_index: order++, config: { whatsappMessage: (c.message || '').trim(), whatsapp_account_id: c.whatsapp_account_id || undefined, whatsapp_template_id: c.whatsapp_template_id || undefined, ...delay } });
        else if (s.type === 'voice_agent_call') steps.push({ type: s.type, title: 'AI Voice Call', channel: 'voice', order_index: order++, config: { agent_id: c.agent_id || undefined, voice_id: c.voice_id || undefined, from_number: c.from_number || undefined, ...delay } });
        else if (s.type === 'condition') {
          const cond = CONDITIONS.find((x) => x.value === (c.condition || 'connection_accepted'))!;
          // Store type 'condition' → engine step type 'wait_for_condition'.
          steps.push({ type: 'wait_for_condition', title: `Wait for ${cond.label}`, channel: 'linkedin', order_index: order++, config: { condition: cond.value, action_type: cond.action } });
        }
      }

      // Follow-up sequence macro → one real channel step per touch, each with
      // its own delay (from the touch's hours) and message source (blank = AI,
      // else the chosen template id). Delays are relative to the prior step.
      const fc = configs[FOLLOWUP_STEP_ID] || {};
      const fuChannel = fc.channel === 'email' ? 'email' : fc.channel === 'whatsapp' ? 'whatsapp' : 'linkedin';
      const fuTouchList: { hours?: number; template_id?: string }[] =
        Array.isArray(fc.touches) && fc.touches.length ? fc.touches.slice(0, 7) : [{ hours: 24 }, { hours: 72 }, { hours: 168 }];
      if (followupNode) {
        fuTouchList.forEach((t, idx) => {
          const hrs = Math.max(1, parseInt(String(t.hours), 10) || 24);
          const d = { delayDays: Math.floor(hrs / 24), delayHours: hrs % 24 };
          const tid = t.template_id || undefined;
          const n = idx + 1;
          if (fuChannel === 'email') steps.push({ type: 'email_send', title: `Follow-up ${n} (email)`, channel: 'email', order_index: order++, config: { subject: '', body: '', template_id: tid, ...d } });
          else if (fuChannel === 'whatsapp') steps.push({ type: 'whatsapp_send', title: `Follow-up ${n} (WhatsApp)`, channel: 'whatsapp', order_index: order++, config: { whatsappMessage: '', whatsapp_template_id: tid, ...d } });
          else steps.push({ type: 'linkedin_message', title: `Follow-up ${n} (LinkedIn)`, channel: 'linkedin', order_index: order++, config: { message: '', template_id: tid, ...d } });
        });
      }

      // "Update Zoho record" write-back → a terminal zoho_update step. Runs
      // when the lead reaches it (place it last); maps workflow data back onto
      // the lead's original Zoho record via ZohoWritebackService.
      if (zohoUpdateNode) {
        const zc = configs[ZOHO_UPDATE_STEP_ID] || {};
        const map: Record<string, string> = zc.map || {};
        const mappings = Object.entries(map)
          .filter(([, sourceKey]) => sourceKey)
          .map(([zoho_field, source]) => ({ zoho_field, source }));
        if (mappings.length) {
          steps.push({
            type: 'zoho_update', title: 'Update Zoho record', channel: 'linkedin', order_index: order++,
            config: { module: zc.module === 'Leads' ? 'Leads' : 'Contacts', mappings },
          });
        }
      }

      // "Multi-condition" node → a `switch` step + one guarded message step per
      // branch (if/elseif/else). The backend evaluates the field, stamps the
      // chosen branch, and prunes the rest so only one branch sends.
      if (multiCondNode) {
        const sc = configs[MULTICOND_STEP_ID] || {};
        const switchId = `sw-${MULTICOND_STEP_ID}`;
        const rawCases: any[] = Array.isArray(sc.cases) ? sc.cases : [];
        const cases = rawCases.filter((c) => (c.value || '').trim() && (c.body || c.subject || '').trim());
        const buildBranchStep = (b: any, branchKey: string, titlePrefix: string) => {
          const guard = { run_if_branch: { switch_id: switchId, branch: branchKey } };
          const ch = b.channel === 'linkedin' ? 'linkedin' : b.channel === 'whatsapp' ? 'whatsapp' : 'email';
          if (ch === 'linkedin') return { type: 'linkedin_message', title: `${titlePrefix} (LinkedIn)`, channel: 'linkedin', order_index: order++, config: { message: (b.body || '').trim(), ...guard } };
          if (ch === 'whatsapp') return { type: 'whatsapp_send', title: `${titlePrefix} (WhatsApp)`, channel: 'whatsapp', order_index: order++, config: { whatsappMessage: (b.body || '').trim(), ...guard } };
          return { type: 'email_send', title: `${titlePrefix} (email)`, channel: 'email', order_index: order++, config: { subject: (b.subject || '').trim(), body: (b.body || '').trim(), ...guard } };
        };
        if (cases.length) {
          steps.push({
            type: 'switch', title: 'Multi-condition', channel: 'email', order_index: order++,
            config: {
              switch_id: switchId,
              field: sc.field || 'tag',
              cases: cases.map((c, i) => ({ op: c.op || 'equals', value: (c.value || '').trim(), branch: `b${i}` })),
              default_branch: 'else',
            },
          });
          cases.forEach((c, i) => steps.push(buildBranchStep(c, `b${i}`, `If ${sc.field || 'tag'} ${SWITCH_OPS.find((o) => o.value === (c.op || 'equals'))?.label || 'is'} "${(c.value || '').trim()}"`)));
          if ((sc.default?.body || sc.default?.subject || '').trim()) {
            steps.push(buildBranchStep(sc.default, 'else', 'Otherwise'));
          }
        }
      }

      // "AI Media" node → records a media_generation step AND attaches the
      // generated asset to every email/WhatsApp step that has no media of its
      // own (the engine's email/whatsapp executors read config.media_url).
      const mc = configs[MEDIA_STEP_ID] || {};
      if (mediaNode && mc.media_url) {
        for (const st of steps) {
          if ((st.type === 'email_send' || st.type === 'whatsapp_send') && !st.config?.media_url) {
            st.config = { ...(st.config || {}), media_url: mc.media_url, media_type: mc.media_type || 'image', media_filename: mc.media_filename || undefined };
          }
        }
        // Record the asset as a media_generation step at the front (after source).
        const mediaStep = {
          type: 'media_generation', title: 'AI Media', channel: 'linkedin', order_index: 0,
          config: { media_url: mc.media_url, media_type: mc.media_type || 'image', media_filename: mc.media_filename || undefined },
        };
        const insertAt = steps.length && steps[0].type === 'lead_generation' ? 1 : 0;
        steps.splice(insertAt, 0, mediaStep);
        steps.forEach((st, i) => { st.order_index = i; }); // renumber after splice
      }

      const ac = configs[ANALYTICS_STEP_ID] || {};

      const payload: any = {
        name: name.trim(),
        status: 'active',
        leads_per_day: perDayN,
        campaign_start_date: start.toISOString(),
        campaign_end_date: end.toISOString(),
        config: {
          data_source: source === 'zoho_recurring' ? 'zoho_contacts' : source === 'linkedin_search' ? 'linkedin_search' : 'direct_contact',
          builder: 'custom_workflow',
          // Search targeting, surfaced at campaign level so AI features ground
          // on it — notably the auto-post generator (LinkedInPostContentService
          // reads config.targeting), making "daily post about the industry you
          // target" actually track the industry you searched.
          ...(source === 'linkedin_search' ? (() => {
            const sc = configs[SOURCE_STEP_ID] || {};
            const csv = (v: any) => String(v || '').split(',').map((x: string) => x.trim()).filter(Boolean);
            const tgt: any = {};
            if (csv(sc.job_titles).length) tgt.job_titles = csv(sc.job_titles);
            if (csv(sc.industries).length) tgt.industries = csv(sc.industries);
            if (csv(sc.locations).length) tgt.locations = csv(sc.locations);
            if ((sc.keywords || '').trim()) tgt.keywords = sc.keywords.trim();
            return Object.keys(tgt).length ? { targeting: tgt } : {};
          })() : {}),
          leads_per_day: perDayN,
          campaign_days: daysN,
          working_days: 'monday-friday',
          ...(source === 'zoho_recurring' ? {
            zoho_modules: srcCfg.zoho_modules || 'contacts',
            zoho_tag: (srcCfg.zoho_tag || '').trim() || undefined,
            // Compliant, read-only Instagram enrichment: resolve each contact's
            // handle + optional public business_discovery profile. No follow/DM
            // (Meta's API exposes none) — maps contacts to IG for inbound.
            ...(srcCfg.resolve_instagram ? { resolve_instagram: true, instagram_business_discovery: srcCfg.instagram_business_discovery !== false } : {}),
          } : {}),
          ...(followupNode ? {
            followup_sequence: { touches: fuTouchList.length, channel: fuChannel, timeline_hours: fuTouchList.map((t) => t.hours || 24), human_approval: !!fc.human_approval },
          } : {}),
          ...(autopostNode ? (() => {
            const pc = configs[AUTOPOST_STEP_ID] || {};
            const content = (pc.content || '').trim();
            if (!content) return {};
            return {
              // Read by LinkedInAutopostScheduleService at launch → drives
              // linkedinAutopostCron. Campaign-level (one post per schedule).
              autopost: {
                content,
                ai_generate: !!pc.ai_generate,
                media_url: (pc.media_url || '').trim() || undefined,
                external_link: (pc.external_link || '').trim() || undefined,
                as_organization: pc.post_as && pc.post_as !== 'personal' ? pc.post_as : undefined,
                frequency: pc.frequency === 'daily' ? 'daily' : 'weekly',
                days: Array.isArray(pc.days) ? pc.days : [1],
                time: pc.time || '09:00',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
              },
            };
          })() : {}),
          ...(exportNode ? (() => {
            const ec = configs[EXPORT_STEP_ID] || {};
            return {
              // Read by CampaignExportService — on completion and from "Export now".
              export_results: {
                format: ec.format || 'csv',
                destinations: Array.isArray(ec.destinations) && ec.destinations.length ? ec.destinations : ['file'],
                columns: Array.isArray(ec.columns) && ec.columns.length ? ec.columns : EXPORT_DEFAULT_COLUMNS,
                run_on_completion: ec.run_on_completion !== false,
                email_to: (ec.email_to || '').trim() || undefined,
                whatsapp_to: (ec.whatsapp_to || '').trim() || undefined,
                webhook_url: (ec.webhook_url || '').trim() || undefined,
                sheet_id: (ec.sheet_id || '').trim() || undefined,
                slack_webhook_url: (ec.slack_webhook_url || '').trim() || undefined,
                bucket: (ec.bucket || '').trim() || undefined,
                bucket_prefix: (ec.bucket_prefix || '').trim() || undefined,
              },
            };
          })() : {}),
          ...(analyticsNode ? {
            // Read by core/cron/campaignDigestCron.js — daily 08:00 GST (weekly = Mondays).
            analytics_notifications: {
              channel: ac.channel === 'whatsapp' ? 'whatsapp' : 'email',
              recipient: (ac.recipient || '').trim(),
              frequency: ac.frequency === 'weekly' ? 'weekly' : 'daily',
              metrics: { new_leads: ac.m_new_leads !== false, pipeline: ac.m_pipeline !== false },
            },
          } : {}),
        },
        steps,
        // Mark one-time imports as direct outreach so the backend saves the
        // leads as source='direct_contact' (NOT 'linkedin_search') — otherwise
        // the LinkedIn step treats the row id as a Unipile provider_id and
        // skips the name+company resolution waterfall.
        ...(initialLeads ? { initial_leads: initialLeads, campaign_type: 'direct_outreach' } : {}),
      };

      const res = await fetchWithTenant('/api/campaigns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && (data?.success || data?.id || data?.data?.id)) window.location.href = '/campaigns';
      else { setError(data?.error || 'Failed to launch workflow'); setLaunching(false); }
    } catch (e: any) {
      setError(e?.message || 'Failed to launch workflow');
      setLaunching(false);
    }
  };

  // ── Config drawer fields per node type ────────────────────────────────────
  const field = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
  const renderEditor = () => {
    if (!editingStep || !editingId) return null;
    const isSource = editingId === SOURCE_STEP_ID;
    const isFollowup = editingId === FOLLOWUP_STEP_ID;
    const isAnalytics = editingId === ANALYTICS_STEP_ID;
    const isRouter = !!editingId?.startsWith('rt-');
    const isZohoUpdate = editingId === ZOHO_UPDATE_STEP_ID;
    const isMedia = editingId === MEDIA_STEP_ID;
    const isMultiCond = editingId === MULTICOND_STEP_ID;
    const isAiParse = editingId === AI_STEP_ID;
    const isDataEnrich = editingId === ENRICH_STEP_ID;
    const isExport = editingId === EXPORT_STEP_ID;
    const isAutopost = editingId === AUTOPOST_STEP_ID;
    const isMacro = isFollowup || isAnalytics || isZohoUpdate || isMedia || isMultiCond || isAiParse || isDataEnrich || isExport || isAutopost;
    const visual = isSource
      ? SOURCES.find((s) => s.key === source)
      : isFollowup
        ? { icon: <ListOrdered className="h-4 w-4 text-indigo-600" />, chip: 'bg-indigo-50 dark:bg-indigo-950/30' }
        : isAnalytics
          ? { icon: <BarChart3 className="h-4 w-4 text-cyan-600" />, chip: 'bg-cyan-50 dark:bg-cyan-950/30' }
          : isZohoUpdate
            ? { icon: <DatabaseZap className="h-4 w-4 text-red-600" />, chip: 'bg-red-50 dark:bg-red-950/30' }
          : isMedia
            ? { icon: <Wand2 className="h-4 w-4 text-fuchsia-600" />, chip: 'bg-fuchsia-50 dark:bg-fuchsia-950/30' }
          : isMultiCond
            ? { icon: <Split className="h-4 w-4 text-amber-600" />, chip: 'bg-amber-50 dark:bg-amber-950/30' }
          : isAiParse
            ? { icon: <Sparkles className="h-4 w-4 text-violet-600" />, chip: 'bg-violet-50 dark:bg-violet-950/30' }
          : isDataEnrich
            ? { icon: <Contact className="h-4 w-4 text-teal-600" />, chip: 'bg-teal-50 dark:bg-teal-950/30' }
          : isExport
            ? { icon: <Download className="h-4 w-4 text-cyan-700" />, chip: 'bg-cyan-50 dark:bg-cyan-950/30' }
          : isAutopost
            ? { icon: <Megaphone className="h-4 w-4 text-[#0077B5]" />, chip: 'bg-sky-50 dark:bg-sky-950/30' }
          : isRouter
            ? { icon: <GitFork className="h-4 w-4 text-rose-600" />, chip: 'bg-rose-50 dark:bg-rose-950/30' }
            : OUTREACH.find((o) => o.type === editingStep.type && !o.router);
    return (
      <div className="absolute right-0 top-0 h-full w-[22rem] bg-card border-l border-border shadow-2xl z-10 flex flex-col">
        <div className="flex items-start gap-3 p-4 border-b border-border">
          {visual && <IconChip icon={visual.icon} chip={visual.chip} size="h-10 w-10" />}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground truncate">{editingStep.title}</div>
            <div className="text-xs text-muted-foreground">
              {isSource ? 'Contact source settings' : isFollowup ? 'Follow-up sequence settings' : isAnalytics ? 'Report settings' : isZohoUpdate ? 'Field mapping' : isMedia ? 'AI media' : isMultiCond ? 'Branch by condition' : isAiParse ? 'AI data cleanup' : isDataEnrich ? 'Data to enrich' : isExport ? 'Export destinations' : isAutopost ? 'Post content & schedule' : isRouter ? 'Fallback routing settings' : 'Step settings'}
            </div>
          </div>
          <button onClick={() => setEditingId(null)} className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 p-4 space-y-4 overflow-y-auto text-sm">
          {isSource && source === 'zoho_recurring' && (<>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Import from</label>
              <select className={field} value={cfg.zoho_modules || 'contacts'} onChange={(e) => setCfg(editingId, { zoho_modules: e.target.value })}>
                <option value="contacts">Contacts only</option><option value="contacts_leads">Contacts + Leads</option>
              </select></div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Only tag (optional)</label>
              <Input value={cfg.zoho_tag || ''} onChange={(e) => setCfg(editingId, { zoho_tag: e.target.value })} placeholder="e.g. Auto-Conversion Lead" /></div>
            <p className="text-xs text-muted-foreground">Imports up to {perDay}/day of newly-created records, every day until the campaign ends.</p>
            <div className="rounded-lg border border-border p-2.5 space-y-2 bg-muted/20">
              <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
                <input type="checkbox" checked={!!cfg.resolve_instagram} onChange={(e) => setCfg(editingId, { resolve_instagram: e.target.checked })} />
                Enrich with Instagram
              </label>
              {cfg.resolve_instagram && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer pl-6">
                  <input type="checkbox" checked={cfg.instagram_business_discovery !== false} onChange={(e) => setCfg(editingId, { instagram_business_discovery: e.target.checked })} />
                  Fetch public profile stats (business accounts)
                </label>
              )}
              <p className="text-[11px] leading-snug text-muted-foreground">
                Finds each contact&apos;s Instagram handle (from their Zoho profile, website, or search) and maps them to Instagram for inbound engagement. Read-only — Meta&apos;s API does not permit auto-following, liking, or DMing.
              </p>
            </div>
          </>)}
          {isSource && source === 'zoho_once' && (<>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Record type</label>
              <select className={field} value={cfg.zoho_type || 'contacts'} onChange={(e) => setCfg(editingId, { zoho_type: e.target.value })}>
                <option value="contacts">Contacts</option><option value="leads">Leads</option>
              </select></div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">How many (max 500)</label>
              <Input type="number" value={cfg.import_count || '100'} onChange={(e) => setCfg(editingId, { import_count: e.target.value })} /></div>
          </>)}
          {isSource && source === 'ghl_once' && (
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">How many (max 500)</label>
              <Input type="number" value={cfg.import_count || '100'} onChange={(e) => setCfg(editingId, { import_count: e.target.value })} /></div>
          )}
          {isSource && source === 'file_import' && (<>
            <label className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 cursor-pointer px-3 py-4 text-sm font-medium text-foreground transition-colors">
              <Upload className="h-4 w-4 text-emerald-600" />
              {fileParsing ? 'Reading file…' : fileName ? 'Choose a different file' : 'Upload CSV or Excel'}
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ''; }} />
            </label>
            {fileError && <p className="text-xs text-red-600">{fileError}</p>}
            {!!fileHeaders.length && (<>
              <p className="text-xs text-muted-foreground">{fileName} · <span className="font-medium text-foreground">{fileRows.length}</span> row{fileRows.length !== 1 ? 's' : ''} · map columns below</p>
              <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                {fileHeaders.map((h, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 items-center">
                    <span className="text-xs text-foreground truncate" title={h}>{h || `Column ${i + 1}`}</span>
                    <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                      value={fileMapping[i] || 'ignore'}
                      onChange={(e) => setFileMapping((m) => ({ ...m, [i]: e.target.value }))}>
                      {IMPORT_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">Any combination works (name + company, company + title + location, name + location…). When a LinkedIn step runs, Unipile resolves each lead&apos;s LinkedIn profile from the mapped name + company.</p>
            </>)}
          </>)}
          {isSource && source === 'linkedin_search' && (<>
            {/* Structured targeting — the backend normalises job_titles → roles,
                locations → location, and matches industries against the lead's
                company industry. Comma-separate to search several at once. */}
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Job titles</label>
              <Input value={cfg.job_titles || ''} onChange={(e) => setCfg(editingId, { job_titles: e.target.value })} placeholder="e.g. VP Sales, Head of Revenue" />
              <p className="text-[11px] text-muted-foreground">Comma-separate to target several titles.</p></div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Industries</label>
              <Input value={cfg.industries || ''} onChange={(e) => setCfg(editingId, { industries: e.target.value })} placeholder="e.g. SaaS, Fintech" /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Location</label>
              <Input value={cfg.locations || ''} onChange={(e) => setCfg(editingId, { locations: e.target.value })} placeholder="e.g. Dubai, United Arab Emirates" /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Extra keywords (optional)</label>
              <Input value={cfg.keywords || ''} onChange={(e) => setCfg(editingId, { keywords: e.target.value })} placeholder="Anything else to match on" />
              <p className="text-[11px] text-muted-foreground">Fill at least one field above — the search needs a title, industry, location, or keyword.</p></div>
          </>)}
          {isSource && source === 'linkedin_signal' && (<>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Signal</label>
              <textarea className={`${field} min-h-[70px]`} value={cfg.signal_query || ''}
                onChange={(e) => setCfg(editingId, { signal_query: e.target.value })}
                placeholder="e.g. companies posting jobs for Salesforce revenue operations" />
              <p className="text-[11px] text-muted-foreground">Describe the hiring / buying signal to look for in LinkedIn posts.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Decision-maker title(s)</label>
              <Input value={cfg.decision_maker_titles || ''}
                onChange={(e) => setCfg(editingId, { decision_maker_titles: e.target.value })}
                placeholder="e.g. VP Revenue Operations, Head of Sales" />
              <p className="text-[11px] text-muted-foreground">Comma-separated. Who to enrol at the companies that match the signal.</p>
            </div>
            <p className="text-xs text-muted-foreground">Runs daily until the campaign ends, enrolling up to {perDay}/day of newly-signalled leads.</p>
          </>)}

          {isFollowup && (() => {
            const eid = editingId!;
            const channel: string = cfg.channel || 'linkedin';
            const touches: { hours?: number; template_id?: string }[] = Array.isArray(cfg.touches) && cfg.touches.length ? cfg.touches : [{ hours: 24 }];
            const tmpls: any[] = channel === 'email' ? res.emailTemplates : channel === 'whatsapp' ? res.waTemplates : res.liTemplates;
            const tmplName = (t: any) => t.name || t.title || 'Template';
            const syncDesc = (n: number, ch: string) => updateWorkflowStep(eid, { description: `${n} touches · ${FU_CHANNELS.find((c2) => c2.value === ch)?.label}` });
            const setTouch = (i: number, patch: any) => { const next = touches.map((t, idx) => (idx === i ? { ...t, ...patch } : t)); setCfg(eid, { touches: next }); };
            const addTouch = () => { if (touches.length >= 7) return; const last = touches[touches.length - 1]?.hours || 24; const next = [...touches, { hours: last * 2 }]; setCfg(eid, { touches: next }); syncDesc(next.length, channel); };
            const removeTouch = (i: number) => { if (touches.length <= 1) return; const next = touches.filter((_, idx) => idx !== i); setCfg(eid, { touches: next }); syncDesc(next.length, channel); };
            return (<>
              <div className="space-y-1"><label className="text-xs font-medium text-foreground">Follow-up channel</label>
                <select className={field} value={channel} onChange={(e) => { setCfg(eid, { channel: e.target.value }); syncDesc(touches.length, e.target.value); }}>
                  {FU_CHANNELS.map((c2) => <option key={c2.value} value={c2.value}>{c2.label}</option>)}
                </select></div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Touch timeline ({touches.length})</label>
                {touches.map((t, i) => {
                  const h = t.hours ?? 24;
                  return (
                    <div key={i} className="rounded-lg border border-border p-2.5 space-y-2 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">Touch {i + 1}</span>
                        {touches.length > 1 && (
                          <button onClick={() => removeTouch(i)} className="text-muted-foreground hover:text-red-600" title="Remove touch"><X className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Input type="number" className="w-24 h-8" value={String(h)} onChange={(e) => setTouch(i, { hours: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
                        <span className="text-xs text-muted-foreground">hours (≈ {Math.round((h / 24) * 10) / 10}d) after {i === 0 ? 'the previous step' : `touch ${i}`}</span>
                      </div>
                      <select className={`${field} h-8`} value={t.template_id || ''} onChange={(e) => setTouch(i, { template_id: e.target.value || undefined })}>
                        <option value="">AI-generated (default)</option>
                        {tmpls.map((tm: any) => <option key={tm.id} value={tm.id}>{tmplName(tm)}</option>)}
                      </select>
                    </div>
                  );
                })}
                {touches.length < 7 && (
                  <button onClick={addTouch} className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1">
                    <span className="text-base leading-none">+</span> Add another touch
                  </button>
                )}
              </div>

              <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer select-none">
                <input type="checkbox" className="h-4 w-4 mt-0.5" checked={!!cfg.human_approval} onChange={(e) => setCfg(eid, { human_approval: e.target.checked })} />
                <span>Human in the loop
                  <span className="block text-xs text-muted-foreground">Flags this sequence for manual review. Every send already passes Mr LAD&apos;s safety supervisor; a full approval queue reads this flag as it rolls out.</span>
                </span>
              </label>
              <p className="text-xs text-muted-foreground">AI-generated touches are drafted by Mr LAD from the conversation context; templated touches use your saved {FU_CHANNELS.find((c2) => c2.value === channel)?.label} template. The sequence auto-cancels when the lead replies.</p>
            </>);
          })()}

          {isAnalytics && (<>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Notify me via</label>
              <select className={field} value={cfg.channel || 'email'} onChange={(e) => {
                setCfg(editingId, { channel: e.target.value });
                updateWorkflowStep(editingId, { description: `${(cfg.frequency || 'daily') === 'weekly' ? 'Weekly' : 'Daily'} · ${e.target.value === 'whatsapp' ? 'WhatsApp' : 'Email'}` });
              }}>
                <option value="email">Email</option><option value="whatsapp">WhatsApp</option>
              </select></div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Recipient</label>
              <Input value={cfg.recipient || ''} onChange={(e) => setCfg(editingId, { recipient: e.target.value })}
                placeholder={(cfg.channel || 'email') === 'whatsapp' ? 'WhatsApp number, e.g. +9715…' : 'you@company.com'} /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Frequency</label>
              <select className={field} value={cfg.frequency || 'daily'} onChange={(e) => {
                setCfg(editingId, { frequency: e.target.value });
                updateWorkflowStep(editingId, { description: `${e.target.value === 'weekly' ? 'Weekly' : 'Daily'} · ${(cfg.channel || 'email') === 'whatsapp' ? 'WhatsApp' : 'Email'}` });
              }}>
                <option value="daily">Daily (08:00 GST)</option><option value="weekly">Weekly (Mondays)</option>
              </select></div>
            <div className="space-y-1.5"><label className="text-xs font-medium text-foreground">Data to send</label>
              <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" className="h-4 w-4" checked={cfg.m_new_leads !== false} onChange={(e) => setCfg(editingId, { m_new_leads: e.target.checked })} /> New leads imported (24h)</label>
              <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" className="h-4 w-4" checked={cfg.m_pipeline !== false} onChange={(e) => setCfg(editingId, { m_pipeline: e.target.checked })} /> Lead pipeline status</label>
            </div>
            <p className="text-xs text-muted-foreground">Sent by Mr LAD via your connected {(cfg.channel || 'email') === 'whatsapp' ? 'WhatsApp' : 'email'} account while the campaign is running.</p>
          </>)}

          {isZohoUpdate && (() => {
            const eid = editingId!;
            const zmap: Record<string, string> = cfg.map || {};
            // Channels present in the sequence → sequence-aware suggestions.
            const channels = new Set<Channel>();
            workflowPreview.forEach((s) => { const o = OUTREACH.find((x) => x.type === s.type); if (o) channels.add(o.channel); });
            if (source === 'zoho_recurring' && configs[SOURCE_STEP_ID]?.resolve_instagram) channels.add('instagram');
            const setMap = (api: string, val: string) => setCfg(eid, { map: { ...zmap, [api]: val } });
            const applySuggestions = () => {
              const next: Record<string, string> = { ...zmap };
              zohoFields.forEach((f) => { if (!next[f.api_name]) { const s = suggestDataPoint(f, channels); if (s) next[f.api_name] = s; } });
              setCfg(eid, { map: next });
            };
            const mappedCount = Object.values(zmap).filter(Boolean).length;
            return (<>
              <div className="space-y-1"><label className="text-xs font-medium text-foreground">Update which record</label>
                <select className={field} value={cfg.module || 'Contacts'} onChange={(e) => { setCfg(eid, { module: e.target.value }); updateWorkflowStep(eid, { description: `Write back to ${e.target.value}` }); }}>
                  <option value="Contacts">Contacts</option><option value="Leads">Leads</option>
                </select></div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground">Field mapping{mappedCount ? ` (${mappedCount})` : ''}</label>
                <button type="button" onClick={applySuggestions} disabled={!zohoFields.length}
                  className="text-[11px] font-medium text-[#0b1957] hover:underline disabled:opacity-40 disabled:no-underline">Suggest mappings</button>
              </div>
              {zohoFieldsLoading && <p className="text-xs text-muted-foreground">Loading Zoho fields…</p>}
              {zohoFieldsError && <p className="text-xs text-red-600">{zohoFieldsError}</p>}
              {!zohoFieldsLoading && !zohoFieldsError && !zohoFields.length && <p className="text-xs text-muted-foreground">No writable fields returned. Connect Zoho and sync first.</p>}
              {!!zohoFields.length && (
                <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                  {zohoFields.map((f) => (
                    <div key={f.api_name} className="grid grid-cols-2 gap-2 items-center">
                      <span className="text-xs text-foreground truncate" title={`${f.field_label} (${f.data_type})`}>{f.field_label}</span>
                      <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={zmap[f.api_name] || ''} onChange={(e) => setMap(f.api_name, e.target.value)}>
                        <option value="">— Skip —</option>
                        {WORKFLOW_DATA_POINTS.map((dp) => <option key={dp.key} value={dp.key}>{dp.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] leading-snug text-muted-foreground">Runs when a lead finishes the sequence — writes the mapped workflow &amp; enrichment data back onto its original Zoho record. Only non-empty values are written; blank fields are left untouched.</p>
            </>);
          })()}

          {isMedia && (() => {
            const m = cfg || {};
            const imgs = mediaBuilder.galleryImages || [];
            const vids = mediaBuilder.galleryVideos || [];
            const openGallery = () => { setMediaGalleryOpen((o) => !o); if (!mediaGalleryOpen) mediaBuilder.fetchGallery?.().catch(() => {}); };
            return (<>
              {m.media_url ? (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground">Attached media</label>
                  {m.media_type === 'video'
                    ? <video src={m.media_url} controls className="w-full max-h-48 rounded-md bg-black" />
                    : <img src={m.media_url} alt={m.media_filename || 'media'} className="w-full max-h-48 object-contain rounded-md border border-border" />}
                  <button type="button" onClick={() => { setCfg(MEDIA_STEP_ID, { media_url: '', media_type: '', media_filename: '' }); updateWorkflowStep(MEDIA_STEP_ID, { description: 'Generate media to attach' }); }}
                    className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:underline"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No media yet. Generate one in the AI Media Studio, then pick it below.</p>
              )}
              {mediaError && <p className="text-xs text-red-600">{mediaError}</p>}
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => setShowMediaStudio(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-fuchsia-300 bg-fuchsia-50 dark:bg-fuchsia-950/30 px-3 py-2 text-sm font-medium text-fuchsia-700 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/40">
                  <Wand2 className="h-4 w-4" /> Open AI Media Studio</button>
                <button type="button" onClick={openGallery} className="text-xs font-medium text-[#0b1957] hover:underline text-left">
                  {mediaGalleryOpen ? 'Hide generated media' : 'Pick from generated media'}</button>
              </div>
              {mediaGalleryOpen && (
                <div className="rounded-lg border border-border p-2 bg-muted/20">
                  {mediaBuilder.loadingGallery ? (
                    <p className="py-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
                  ) : (!imgs.length && !vids.length) ? (
                    <p className="py-3 text-center text-xs text-muted-foreground">No generated media yet — use the studio first.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto">
                      {imgs.map((it: any, i: number) => { const u = it?.url || it?.signed_url || (typeof it === 'string' ? it : ''); return u ? (
                        <img key={`gi-${i}`} src={u} alt="generated" onClick={() => importGenerated(u)} className="h-16 w-full object-cover rounded cursor-pointer hover:ring-2 ring-fuchsia-400" />
                      ) : null; })}
                      {vids.map((it: any, i: number) => { const u = it?.url || it?.signed_url || (typeof it === 'string' ? it : ''); return u ? (
                        <video key={`gv-${i}`} src={u} muted onClick={() => importGenerated(u)} className="h-16 w-full object-cover rounded cursor-pointer hover:ring-2 ring-fuchsia-400" />
                      ) : null; })}
                    </div>
                  )}
                  {mediaImporting && <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Attaching…</p>}
                </div>
              )}
              <p className="text-[11px] leading-snug text-muted-foreground">The asset attaches to your email &amp; WhatsApp steps automatically. Email inlines images only.</p>
            </>);
          })()}

          {isMultiCond && (() => {
            const eid = editingId!;
            const swField: string = cfg.field || 'tag';
            const cases: any[] = Array.isArray(cfg.cases) && cfg.cases.length ? cfg.cases : [{ op: 'equals', value: '', channel: 'email', subject: '', body: '' }];
            const def = cfg.default || { channel: 'email', subject: '', body: '' };
            const fieldLabel = mcFields.find((f) => f.value === swField)?.label || 'Tag';
            const setCase = (i: number, patch: any) => { const next = cases.map((c, idx) => (idx === i ? { ...c, ...patch } : c)); setCfg(eid, { cases: next }); updateWorkflowStep(eid, { description: `${next.length} conditions + else` }); };
            const addCase = () => { if (cases.length >= 6) return; const next = [...cases, { op: 'equals', value: '', channel: 'email', subject: '', body: '' }]; setCfg(eid, { cases: next }); updateWorkflowStep(eid, { description: `${next.length} conditions + else` }); };
            const removeCase = (i: number) => { if (cases.length <= 1) return; const next = cases.filter((_, idx) => idx !== i); setCfg(eid, { cases: next }); updateWorkflowStep(eid, { description: `${next.length} conditions + else` }); };
            const BranchBody = ({ b, onChange }: { b: any; onChange: (p: any) => void }) => (<>
              <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" value={b.channel || 'email'} onChange={(e) => onChange({ channel: e.target.value })}>
                <option value="email">Send email</option><option value="linkedin">LinkedIn message</option><option value="whatsapp">WhatsApp</option>
              </select>
              {(b.channel || 'email') === 'email' && (
                <Input value={b.subject || ''} onChange={(e) => onChange({ subject: e.target.value })} placeholder="Email subject" />
              )}
              <textarea className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs min-h-[56px]" value={b.body || ''} onChange={(e) => onChange({ body: e.target.value })} placeholder="Message (leave blank to let Mr LAD draft it)" />
            </>);
            return (<>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Branch on {mcFieldsLoading && <span className="text-muted-foreground">· loading fields…</span>}</label>
                <select className={field} value={swField} onChange={(e) => setCfg(eid, { field: e.target.value })}>
                  {!mcFields.some((f) => f.value === swField) && swField && <option value={swField}>{swField}</option>}
                  {mcFields.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <p className="text-[11px] text-muted-foreground">{(source === 'zoho_recurring' || source === 'zoho_once') ? 'Fields from your connected Zoho module.' : 'Contact fields available for this source.'}</p>
              </div>
              {cases.map((c, i) => (
                <div key={i} className="rounded-lg border border-border p-2.5 space-y-2 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">{i === 0 ? 'If' : 'Else if'}</span>
                    {cases.length > 1 && <button type="button" onClick={() => removeCase(i)} className="text-muted-foreground hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground shrink-0">{fieldLabel}</span>
                    <select className="rounded-md border border-input bg-background px-1.5 py-1.5 text-xs" value={c.op || 'equals'} onChange={(e) => setCase(i, { op: e.target.value })}>
                      {SWITCH_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <Input value={c.value || ''} onChange={(e) => setCase(i, { value: e.target.value })} placeholder="e.g. person1" />
                  </div>
                  <BranchBody b={c} onChange={(p) => setCase(i, p)} />
                </div>
              ))}
              {cases.length < 6 && (
                <button type="button" onClick={addCase} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0b1957] hover:underline"><Plus className="h-3.5 w-3.5" /> Add condition</button>
              )}
              <div className="rounded-lg border border-dashed border-border p-2.5 space-y-2">
                <span className="text-xs font-semibold text-foreground">Otherwise (else)</span>
                <BranchBody b={def} onChange={(p) => setCfg(eid, { default: { ...def, ...p } })} />
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">Each lead runs exactly ONE branch — the first condition that matches, else the fallback. Conditions are checked top-to-bottom.</p>
            </>);
          })()}

          {isAiParse && (<>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">What should the AI clean up?</label>
              <textarea className={`${field} min-h-[110px]`} value={cfg.instruction ?? AI_DEFAULT_INSTRUCTION}
                onChange={(e) => setCfg(editingId!, { instruction: e.target.value })}
                placeholder={AI_DEFAULT_INSTRUCTION} />
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">Runs on each lead before the outreach steps. It normalises the data — e.g. picks the single best job title when the column has a mix — and writes it back so the LinkedIn node resolves the right person. Uses your tenant&apos;s AI model.</p>
          </>)}

          {isDataEnrich && (() => {
            const eid = editingId!;
            const sel: string[] = Array.isArray(cfg.enrich) ? cfg.enrich : ['official_email', 'phone'];
            const toggle = (key: string) => {
              const next = sel.includes(key) ? sel.filter((k) => k !== key) : [...sel, key];
              setCfg(eid, { enrich: next });
              const labels = ENRICH_OPTIONS.filter((o) => next.includes(o.key)).map((o) => o.label.replace(' email', '').replace(' number', ''));
              updateWorkflowStep(eid, { description: labels.length ? labels.join(' · ') : 'nothing selected' });
            };
            return (<>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Data to enrich</label>
                {ENRICH_OPTIONS.map((o) => (
                  <label key={o.key} className="flex items-start gap-2.5 rounded-lg border border-border p-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
                    <input type="checkbox" className="mt-0.5 h-4 w-4" checked={sel.includes(o.key)} onChange={() => toggle(o.key)} />
                    <span className="min-w-0">
                      <span className="block text-sm text-foreground">{o.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{o.sub}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">Reveals the selected data via FullEnrich (name + company/LinkedIn → contact). Runs before outreach so email/WhatsApp/voice steps use the enriched values. Costs FullEnrich credits per lead (work email 2 · personal 4 · mobile 12).</p>
            </>);
          })()}

          {isAutopost && (() => {
            const eid = editingId!;
            const freq = cfg.frequency === 'daily' ? 'daily' : 'weekly';
            const days: number[] = Array.isArray(cfg.days) ? cfg.days : [1];
            const describe = (f: string, d: number[]) => {
              if (f === 'daily') return 'Daily · ' + (cfg.time || '09:00');
              const names = AUTOPOST_DAYS.filter((x) => d.includes(x.value)).map((x) => x.label);
              return (names.length ? names.join(', ') : 'no days') + ' · ' + (cfg.time || '09:00');
            };
            const toggleDay = (v: number) => {
              const next = days.includes(v) ? days.filter((x) => x !== v) : [...days, v];
              setCfg(eid, { days: next });
              updateWorkflowStep(eid, { description: describe(freq, next) });
            };
            return (<>
              <div className="rounded-md border border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30 px-3 py-2">
                <p className="text-[11px] text-sky-800 dark:text-sky-300">
                  Posts to your own LinkedIn feed on a schedule while the campaign runs — it warms
                  your profile so the people you reach out to see recent activity. This posts
                  <strong> once per schedule</strong>, not once per lead.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">Post content</label>
                  <button type="button" onClick={generateAutopost} disabled={autopostGenerating}
                    className="text-[11px] font-medium text-[#0b1957] dark:text-sky-300 hover:underline disabled:opacity-60 flex items-center gap-1">
                    {autopostGenerating ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</> : <><Sparkles className="h-3 w-3" /> Generate with AI</>}
                  </button>
                </div>
                <textarea className={`${field} min-h-[140px]`} value={cfg.content || ''}
                  onChange={(e) => { setCfg(eid, { content: e.target.value }); updateWorkflowStep(eid, { description: e.target.value.slice(0, 40) || describe(freq, days) }); }}
                  placeholder="Write your post, or add a topic and hit Generate with AI…" />
                <p className="text-[11px] text-muted-foreground">{(cfg.content || '').length}/3000 characters</p>
              </div>

              <label className="flex items-start gap-2.5 rounded-lg border border-border p-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={!!cfg.ai_generate}
                  onChange={(e) => setCfg(eid, { ai_generate: e.target.checked })} />
                <span className="min-w-0">
                  <span className="block text-sm text-foreground">Write a fresh post with AI each time</span>
                  <span className="block text-[11px] text-muted-foreground">Uses the text above as the topic, so a recurring series doesn&apos;t repeat itself.</span>
                </span>
              </label>

              <div className="space-y-1"><label className="text-xs font-medium text-foreground">Link (optional)</label>
                <input className={field} value={cfg.external_link || ''} onChange={(e) => setCfg(eid, { external_link: e.target.value })}
                  placeholder="https://… (shown as a preview card)" /></div>

              <div className="space-y-1"><label className="text-xs font-medium text-foreground">Image / video URL (optional)</label>
                <input className={field} value={cfg.media_url || ''} onChange={(e) => setCfg(eid, { media_url: e.target.value })}
                  placeholder="Paste a URL, or add the AI Media node to generate one" /></div>

              <div className="space-y-1"><label className="text-xs font-medium text-foreground">Post as</label>
                <select className={field} value={cfg.post_as || 'personal'} onChange={(e) => setCfg(eid, { post_as: e.target.value })}>
                  <option value="personal">My personal profile</option>
                  {liOrganizations.map((o) => <option key={o.id} value={o.id}>{o.name} (company page)</option>)}
                </select>
                {liOrganizations.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">No company pages found for this account — posting to your personal profile.</p>
                )}</div>

              <div className="space-y-1"><label className="text-xs font-medium text-foreground">How often</label>
                <select className={field} value={freq} onChange={(e) => { setCfg(eid, { frequency: e.target.value }); updateWorkflowStep(eid, { description: describe(e.target.value, days) }); }}>
                  {AUTOPOST_FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select></div>

              {freq === 'weekly' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Days</label>
                  <div className="flex flex-wrap gap-1.5">
                    {AUTOPOST_DAYS.map((d) => (
                      <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                        className={`px-2.5 py-1 rounded-md border text-[12px] transition-colors ${
                          days.includes(d.value)
                            ? 'border-[#0b1957] bg-[#0b1957] text-white'
                            : 'border-border text-foreground hover:bg-muted/40'
                        }`}>{d.label}</button>
                    ))}
                  </div>
                  {days.length === 0 && <p className="text-[11px] text-amber-600">Pick at least one day, or it posts every day.</p>}
                </div>
              )}

              <div className="space-y-1"><label className="text-xs font-medium text-foreground">Time</label>
                <input type="time" className={field} value={cfg.time || '09:00'}
                  onChange={(e) => { setCfg(eid, { time: e.target.value }); updateWorkflowStep(eid, { description: describe(freq, days) }); }} />
                <p className="text-[11px] text-muted-foreground">Your local timezone. Posting stops when the campaign is paused or finishes.</p></div>

              <div className="space-y-2 pt-1">
                <button type="button" onClick={postAutopostNow} disabled={autopostPosting}
                  className="w-full rounded-md bg-[#0077B5] text-white text-sm font-medium py-2 disabled:opacity-60 flex items-center justify-center gap-2">
                  {autopostPosting ? <><Loader2 className="h-4 w-4 animate-spin" /> Posting…</> : <><Megaphone className="h-4 w-4" /> Post now</>}
                </button>
                {autopostMsg && (
                  <div className={`rounded-md border p-2.5 text-[11px] ${autopostMsg.ok
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                    : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 text-red-700 dark:text-red-300'}`}>
                    {autopostMsg.text}
                  </div>
                )}
              </div>
            </>);
          })()}

          {isExport && (() => {
            const eid = editingId!;
            const dests: string[] = Array.isArray(cfg.destinations) ? cfg.destinations : ['file'];
            const cols: string[] = Array.isArray(cfg.columns) ? cfg.columns : EXPORT_DEFAULT_COLUMNS;
            const fmt = cfg.format || 'csv';
            const describe = (d: string[], f: string) => {
              const names = EXPORT_DESTINATIONS.filter((x) => d.includes(x.key)).map((x) => x.label);
              return `${String(f).toUpperCase()} · ${names.length ? names.join(' · ') : 'no destination'}`;
            };
            const toggleDest = (key: string) => {
              const next = dests.includes(key) ? dests.filter((k) => k !== key) : [...dests, key];
              setCfg(eid, { destinations: next });
              updateWorkflowStep(eid, { description: describe(next, fmt) });
            };
            const toggleCol = (value: string) => {
              const next = cols.includes(value) ? cols.filter((c) => c !== value) : [...cols, value];
              setCfg(eid, { columns: next });
            };
            const has = (k: string) => dests.includes(k);
            return (<>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">File format</label>
                <select className={field} value={fmt} onChange={(e) => { setCfg(eid, { format: e.target.value }); updateWorkflowStep(eid, { description: describe(dests, e.target.value) }); }}>
                  {EXPORT_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Where to send the results</label>
                {EXPORT_DESTINATIONS.map((o) => (
                  <label key={o.key} className="flex items-start gap-2.5 rounded-lg border border-border p-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
                    <input type="checkbox" className="mt-0.5 h-4 w-4" checked={has(o.key)} onChange={() => toggleDest(o.key)} />
                    <span className="min-w-0">
                      <span className="block text-sm text-foreground">{o.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{o.sub}</span>
                    </span>
                  </label>
                ))}
              </div>

              {/* Per-destination inputs — only shown for the ones selected. */}
              {has('email') && (
                <div className="space-y-1"><label className="text-xs font-medium text-foreground">Email to</label>
                  <input className={field} value={cfg.email_to || ''} onChange={(e) => setCfg(eid, { email_to: e.target.value })} placeholder="you@company.com" /></div>
              )}
              {has('whatsapp') && (
                <div className="space-y-1"><label className="text-xs font-medium text-foreground">WhatsApp number</label>
                  <input className={field} value={cfg.whatsapp_to || ''} onChange={(e) => setCfg(eid, { whatsapp_to: e.target.value })} placeholder="+971500000000" /></div>
              )}
              {has('webhook') && (
                <div className="space-y-1"><label className="text-xs font-medium text-foreground">Webhook URL</label>
                  <input className={field} value={cfg.webhook_url || ''} onChange={(e) => setCfg(eid, { webhook_url: e.target.value })} placeholder="https://hooks.example.com/…" /></div>
              )}
              {has('google_sheets') && (
                <div className="space-y-1"><label className="text-xs font-medium text-foreground">Google Sheet ID</label>
                  <input className={field} value={cfg.sheet_id || ''} onChange={(e) => setCfg(eid, { sheet_id: e.target.value })} placeholder="1AbC…xyz (from the sheet URL)" />
                  <p className="text-[11px] text-muted-foreground">Uses your connected Google account — the Sheets scope must be granted.</p></div>
              )}
              {has('slack') && (
                <div className="space-y-1"><label className="text-xs font-medium text-foreground">Slack incoming webhook</label>
                  <input className={field} value={cfg.slack_webhook_url || ''} onChange={(e) => setCfg(eid, { slack_webhook_url: e.target.value })} placeholder="https://hooks.slack.com/services/…" /></div>
              )}
              {has('cloud_storage') && (<>
                <div className="space-y-1"><label className="text-xs font-medium text-foreground">Bucket</label>
                  <input className={field} value={cfg.bucket || ''} onChange={(e) => setCfg(eid, { bucket: e.target.value })} placeholder="Leave blank for the default bucket" /></div>
                <div className="space-y-1"><label className="text-xs font-medium text-foreground">Folder prefix</label>
                  <input className={field} value={cfg.bucket_prefix || ''} onChange={(e) => setCfg(eid, { bucket_prefix: e.target.value })} placeholder="campaign-exports" /></div>
              </>)}

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Columns to include</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {EXPORT_COLUMN_OPTIONS.map((c) => (
                    <label key={c.value} className="flex items-center gap-2 text-[12px] text-foreground cursor-pointer">
                      <input type="checkbox" className="h-3.5 w-3.5" checked={cols.includes(c.value)} onChange={() => toggleCol(c.value)} />
                      <span className="truncate">{c.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-2.5 rounded-lg border border-border p-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={cfg.run_on_completion !== false}
                  onChange={(e) => setCfg(eid, { run_on_completion: e.target.checked })} />
                <span className="min-w-0">
                  <span className="block text-sm text-foreground">Export automatically when the campaign finishes</span>
                  <span className="block text-[11px] text-muted-foreground">You can also export any time from the campaign page.</span>
                </span>
              </label>

              {/* Execute now — proves the destinations work before launch. */}
              <div className="space-y-2 pt-1">
                <button type="button" onClick={runExportNow} disabled={exportRunning}
                  className="w-full rounded-md bg-[#0b1957] text-white text-sm font-medium py-2 disabled:opacity-60 flex items-center justify-center gap-2">
                  {exportRunning ? <><Loader2 className="h-4 w-4 animate-spin" /> Exporting…</> : <><Download className="h-4 w-4" /> Export now</>}
                </button>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {source === 'file_import'
                    ? 'Runs the export against the leads loaded above, so you can check the file and confirm your destinations work.'
                    : 'Sends a test export (no leads are loaded yet for this source) — useful to confirm the destination settings are valid.'}
                </p>
                {exportResult && (
                  <div className={`rounded-md border p-2.5 text-[11px] ${exportResult.success ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'}`}>
                    {exportResult.error && <p className="text-red-700 dark:text-red-300">{exportResult.error}</p>}
                    {typeof exportResult.count === 'number' && <p className="text-foreground font-medium">{exportResult.count} row{exportResult.count !== 1 ? 's' : ''} exported</p>}
                    {exportResult.results && Object.entries(exportResult.results).map(([k, v]: any) => (
                      <p key={k} className={v.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>
                        {v.ok ? '✓' : '✕'} {k}{v.error ? ` — ${v.error}` : ''}{v.skipped ? ` — ${v.skipped}` : ''}
                      </p>
                    ))}
                    {exportResult.file_url && (
                      <a href={exportResult.file_url} target="_blank" rel="noreferrer" className="inline-block mt-1 underline text-[#0b1957] dark:text-sky-300">Download file</a>
                    )}
                  </div>
                )}
              </div>
            </>);
          })()}

          {!isSource && (editingStep.type === 'linkedin_connect' || editingStep.type === 'linkedin_message') && (<>
            {res.liTemplates.length > 0 && (
              <div className="space-y-1"><label className="text-xs font-medium text-foreground">LinkedIn template (optional)</label>
                <select className={field} value={cfg.linkedin_template_id || ''} onChange={(e) => {
                  const t = res.liTemplates.find((x: any) => String(x.id) === e.target.value);
                  setCfg(editingId!, { linkedin_template_id: e.target.value || undefined, message: t?.content ?? t?.message ?? cfg.message });
                }}>
                  <option value="">— None (write below / AI-drafted) —</option>
                  {res.liTemplates.map((t: any) => <option key={t.id} value={t.id}>{t.name || t.title || 'Template'}</option>)}
                </select></div>
            )}
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Message {editingStep.type === 'linkedin_connect' ? '(optional note)' : ''}</label>
              <textarea className={`${field} min-h-[90px]`} value={cfg.message || ''} onChange={(e) => { setCfg(editingId, { message: e.target.value }); updateWorkflowStep(editingId, { description: e.target.value.slice(0, 40) }); }}
                placeholder="Leave blank to let Mr LAD draft it" /></div>
          </>)}
          {!isSource && editingStep.type === 'linkedin_inmail' && (<>
            <div className="rounded-md border border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-violet-950/30 px-3 py-2">
              <p className="text-[11px] text-violet-700 dark:text-violet-300">
                InMail reaches prospects you are <strong>not connected to</strong>. Requires a Premium /
                Sales Navigator / Recruiter LinkedIn account and consumes one InMail credit per send.
              </p>
            </div>
            {res.liTemplates.length > 0 && (
              <div className="space-y-1"><label className="text-xs font-medium text-foreground">LinkedIn template (optional)</label>
                <select className={field} value={cfg.linkedin_template_id || ''} onChange={(e) => {
                  const t = res.liTemplates.find((x: any) => String(x.id) === e.target.value);
                  setCfg(editingId!, { linkedin_template_id: e.target.value || undefined, message: t?.content ?? t?.message ?? cfg.message });
                }}>
                  <option value="">— None (write below / AI-drafted) —</option>
                  {res.liTemplates.map((t: any) => <option key={t.id} value={t.id}>{t.name || t.title || 'Template'}</option>)}
                </select></div>
            )}
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Subject (optional)</label>
              <input className={field} value={cfg.subject || ''} onChange={(e) => setCfg(editingId!, { subject: e.target.value })}
                placeholder="e.g. Quick question about {{company_name}}" /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Message</label>
              <textarea className={`${field} min-h-[90px]`} value={cfg.message || ''} onChange={(e) => { setCfg(editingId!, { message: e.target.value }); updateWorkflowStep(editingId!, { description: e.target.value.slice(0, 40) }); }}
                placeholder="Hi {{first_name}}, I came across your profile…" /></div>
          </>)}
          {!isSource && editingStep.type === 'whatsapp_send' && (<>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">WhatsApp account</label>
              <select className={field} value={cfg.whatsapp_account_id || ''} onChange={(e) => setCfg(editingId!, { whatsapp_account_id: e.target.value || undefined })}>
                <option value="">— Default connected account —</option>
                {res.waAccounts.map((a: any) => <option key={a.id} value={a.id}>{a.slug || a.display_name || a.phone_number || a.id}</option>)}
              </select>
              {res.waAccounts.length === 0 && <p className="text-[11px] text-muted-foreground">No WhatsApp account connected — connect one in Settings.</p>}</div>
            {res.waTemplates.length > 0 && (
              <div className="space-y-1"><label className="text-xs font-medium text-foreground">Template (optional)</label>
                <select className={field} value={cfg.whatsapp_template_id || ''} onChange={(e) => {
                  const t = res.waTemplates.find((x: any) => String(x.id) === e.target.value);
                  setCfg(editingId!, { whatsapp_template_id: e.target.value || undefined, message: t?.content ?? t?.body ?? cfg.message });
                }}>
                  <option value="">— None (write below / AI-drafted) —</option>
                  {res.waTemplates.map((t: any) => <option key={t.id} value={t.id}>{t.name || t.title || 'Template'}</option>)}
                </select></div>
            )}
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Message</label>
              <textarea className={`${field} min-h-[90px]`} value={cfg.message || ''} onChange={(e) => { setCfg(editingId!, { message: e.target.value }); updateWorkflowStep(editingId!, { description: e.target.value.slice(0, 40) }); }}
                placeholder="Leave blank to let Mr LAD draft it" /></div>
          </>)}
          {!isSource && editingStep.type === 'email_send' && (<>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Send from</label>
              <select className={field} value={cfg.from_email || ''} onChange={(e) => {
                const s = res.emailSenders.find((x: any) => x.email === e.target.value);
                setCfg(editingId!, { from_email: e.target.value || undefined, email_provider: s?.provider || undefined });
              }}>
                <option value="">— Default connected account —</option>
                {res.emailSenders.map((s: any) => <option key={s.email} value={s.email}>{s.email}{s.provider ? ` (${s.provider})` : ''}</option>)}
              </select>
              {res.emailSenders.length === 0 && <p className="text-[11px] text-muted-foreground">No email account connected — connect Gmail/Outlook in Settings.</p>}</div>
            {res.emailTemplates.length > 0 && (
              <div className="space-y-1"><label className="text-xs font-medium text-foreground">Template (optional)</label>
                <select className={field} value={cfg.template_id || ''} onChange={(e) => {
                  const t = res.emailTemplates.find((x: any) => String(x.id) === e.target.value);
                  setCfg(editingId!, { template_id: e.target.value || undefined, subject: t?.subject ?? cfg.subject, body: t?.body ?? t?.content ?? cfg.body });
                }}>
                  <option value="">— None (write below / AI-drafted) —</option>
                  {res.emailTemplates.map((t: any) => <option key={t.id} value={t.id}>{t.name || t.title || 'Template'}</option>)}
                </select></div>
            )}
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Subject</label>
              <Input value={cfg.subject || ''} onChange={(e) => { setCfg(editingId, { subject: e.target.value }); updateWorkflowStep(editingId, { description: e.target.value.slice(0, 40) }); }} /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Body</label>
              <textarea className={`${field} min-h-[110px]`} value={cfg.body || ''} onChange={(e) => setCfg(editingId, { body: e.target.value })} placeholder="Leave blank to let Mr LAD draft it" /></div>
          </>)}
          {!isSource && editingStep.type === 'voice_agent_call' && (<>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Calling number</label>
              <select className={field} value={cfg.from_number || ''} onChange={(e) => setCfg(editingId!, { from_number: e.target.value || undefined })}>
                <option value="">— Default number —</option>
                {res.voiceNumbers.map((n: any) => <option key={n.phone_number} value={n.phone_number}>{n.phone_number}</option>)}
              </select>
              {res.voiceNumbers.length === 0 && <p className="text-[11px] text-muted-foreground">No voice number configured.</p>}</div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Voice agent</label>
              <select className={field} value={cfg.agent_id || ''} onChange={(e) => {
                const a = res.voiceAgents.find((x: any) => x.id === e.target.value);
                setCfg(editingId!, { agent_id: e.target.value || undefined, voice_id: a?.voice_id || undefined });
                updateWorkflowStep(editingId!, { description: a?.name || 'AI voice call' });
              }}>
                <option value="">— Select an agent —</option>
                {res.voiceAgents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {res.voiceAgents.length === 0 && <p className="text-[11px] text-muted-foreground">No voice agent found — create one in the Voice playground.</p>}</div>
          </>)}
          {isRouter && (<>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Attempts before falling back (1–10)</label>
              <Input type="number" value={cfg.attempts || '3'} onChange={(e) => {
                setCfg(editingId, { attempts: e.target.value });
                updateWorkflowStep(editingId!, { description: `${Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 3))} tries → ${ROUTER_CHANNELS.find((r) => r.value === (cfg.fallback_channel || 'email'))?.label}` });
              }} /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Fallback channel</label>
              <select className={field} value={cfg.fallback_channel || 'email'} onChange={(e) => {
                setCfg(editingId, { fallback_channel: e.target.value });
                updateWorkflowStep(editingId!, { description: `${cfg.attempts || 3} tries → ${ROUTER_CHANNELS.find((r) => r.value === e.target.value)?.label}` });
              }}>
                {ROUTER_CHANNELS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select></div>
            {(cfg.fallback_channel || 'email') === 'email' && (
              <div className="space-y-1"><label className="text-xs font-medium text-foreground">Fallback email subject</label>
                <Input value={cfg.subject || ''} onChange={(e) => setCfg(editingId, { subject: e.target.value })} placeholder="Blank = Mr LAD drafts it" /></div>
            )}
            {(cfg.fallback_channel || 'email') !== 'voice' && (
              <div className="space-y-1"><label className="text-xs font-medium text-foreground">Fallback message</label>
                <textarea className={`${field} min-h-[80px]`} value={cfg.message || ''} onChange={(e) => setCfg(editingId, { message: e.target.value })} placeholder="Blank = Mr LAD drafts it" /></div>
            )}
            <p className="text-xs text-muted-foreground">Guards the step placed right before it. If that step keeps failing (e.g. no resolvable LinkedIn profile), the pipeline stops retrying after the set attempts and switches to this channel instead. If it succeeds, the fallback is skipped.</p>
          </>)}

          {!isSource && !isRouter && editingStep.type === 'condition' && (
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Continue when…</label>
              <select className={field} value={cfg.condition || 'connection_accepted'} onChange={(e) => { setCfg(editingId, { condition: e.target.value }); updateWorkflowStep(editingId, { description: CONDITIONS.find((c) => c.value === e.target.value)?.label || '' }); }}>
                {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select></div>
          )}
          {!isSource && !isMacro && editingStep.type !== 'condition' && (
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Delay before this step (days)</label>
              <Input type="number" className="w-24" value={cfg.delayDays || '0'} onChange={(e) => setCfg(editingId, { delayDays: e.target.value })} /></div>
          )}
        </div>
        <div className="p-3 border-t border-border bg-muted/20">
          <Button className="w-full" onClick={() => setEditingId(null)}>Done</Button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-[#F8F9FE] dark:bg-[#000724]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" title="Close builder">
            <X className="h-4 w-4" /> Close
          </button>
          <span className="text-sm font-semibold text-foreground hidden sm:block">Custom Workflow</span>
          <Input className="w-64" value={name} onChange={(e) => setName(e.target.value)} placeholder="Workflow name…" />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Leads/day</span><Input type="number" className="w-16 h-8" value={perDay} onChange={(e) => setPerDay(e.target.value)} />
            <span>Days</span><Input type="number" className="w-16 h-8" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
          <Button onClick={launch} disabled={launching}>
            {launching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
            Launch workflow
          </Button>
        </div>
      </div>
      {error && <div className="mx-4 mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      <div className="flex-1 flex min-h-0">
        {/* Palette */}
        <div className="w-[19rem] border-r border-border bg-card overflow-y-auto p-4 space-y-6">
          {/* 0 · Templates — one-click pipeline recipes */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-5 w-5 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0"><Zap className="h-3 w-3" /></span>
              <span className="text-sm font-semibold text-foreground">Start from a template</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2.5 ml-7">Builds the whole pipeline — then tune each node</p>
            <div className="space-y-2">
              {WORKFLOW_TEMPLATES.map((t) => (
                <button key={t.key} onClick={() => applyTemplate(t)}
                  className="relative w-full rounded-xl border border-border hover:border-amber-500/50 hover:bg-amber-50/40 dark:hover:bg-amber-950/10 p-3 text-left transition-all group">
                  <span className="block text-sm font-semibold text-foreground">{t.name}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{t.tagline}</span>
                  <span className="flex flex-wrap items-center gap-1 mt-2">
                    {t.chain.map((c, i) => (
                      <Fragment key={i}>
                        {i > 0 && <span className="text-[9px] text-muted-foreground/60">→</span>}
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground group-hover:bg-amber-100 group-hover:text-amber-900 dark:group-hover:bg-amber-950/40 dark:group-hover:text-amber-300 transition-colors">{c}</span>
                      </Fragment>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 1 · Contact source */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-5 w-5 rounded-full bg-[#0b1957] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">1</span>
              <span className="text-sm font-semibold text-foreground">Contact source</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2.5 ml-7">Where leads enter this workflow</p>
            <div className="space-y-2">
              {SOURCES.map((s) => {
                const active = source === s.key;
                return (
                  <button key={s.key} onClick={() => pickSource(s.key)}
                    className={`relative w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                      active
                        ? 'border-[#0b1957] bg-[#0b1957]/[0.04] shadow-sm ring-1 ring-[#0b1957]/20'
                        : 'border-border hover:border-[#0b1957]/30 hover:bg-muted/40'
                    }`}>
                    <IconChip icon={s.icon} chip={s.chip} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-foreground truncate">{s.label}</span>
                        {s.recurring && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-full px-1.5 py-0.5 flex-shrink-0">Daily</span>
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground truncate">{s.sub}</span>
                    </span>
                    {active && (
                      <span className="h-5 w-5 rounded-full bg-[#0b1957] flex items-center justify-center flex-shrink-0">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </span>
                    )}
                  </button>
                );
              })}
              <div className="flex gap-2">
                {COMING_SOON.map((s) => (
                  <div key={s.label} className="flex-1 flex items-center gap-2 rounded-xl border border-dashed border-border px-2.5 py-2 opacity-60 min-w-0">
                    {s.icon}
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-foreground truncate">{s.label}</span>
                      <span className="block text-[10px] text-muted-foreground">Coming soon</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2 · Outreach steps, grouped by channel */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-5 w-5 rounded-full bg-[#0b1957] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">2</span>
              <span className="text-sm font-semibold text-foreground">Outreach steps</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2.5 ml-7">Click to add to the sequence</p>
            {['LinkedIn', 'Email', 'WhatsApp', 'Voice', 'Logic'].map((group) => (
              <div key={group} className="mb-2.5">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80 mb-1 ml-0.5">{group}</div>
                <div className="space-y-1">
                  {OUTREACH.filter((o) => o.group === group).map((o) => (
                    <button key={o.label} onClick={() => (o.router ? addRouter() : addOutreach(o.type))}
                      className="group w-full flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-2 text-left hover:border-[#0b1957]/30 hover:bg-muted/40 transition-all">
                      <IconChip icon={o.icon} chip={o.chip} size="h-7 w-7" />
                      <span className="text-[13px] font-medium text-foreground truncate flex-1">{o.label}</span>
                      <span className="h-6 w-6 rounded-full border border-border text-muted-foreground group-hover:bg-[#0b1957] group-hover:border-[#0b1957] group-hover:text-white flex items-center justify-center transition-colors flex-shrink-0">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">Click a node on the canvas to configure it · hover a node and use ✕ to remove it.</p>
            {/* Branching — route each lead to a different message by a field. */}
            {(() => {
              const added = workflowPreview.some((s) => s.id === MULTICOND_STEP_ID);
              return (
                <button onClick={addMultiCond}
                  className={`mt-2 relative w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    added ? 'border-[#0b1957] bg-[#0b1957]/[0.04] shadow-sm ring-1 ring-[#0b1957]/20' : 'border-border hover:border-[#0b1957]/30 hover:bg-muted/40'
                  }`}>
                  <IconChip icon={<Split className="h-4 w-4 text-amber-600" />} chip="bg-amber-50 dark:bg-amber-950/30" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground truncate">Multi-condition</span>
                    <span className="block text-xs text-muted-foreground truncate">Route by tag / field → different message</span>
                  </span>
                  {added && (
                    <span className="h-5 w-5 rounded-full bg-[#0b1957] flex items-center justify-center flex-shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </span>
                  )}
                </button>
              );
            })()}
            {/* AI Agent — clean/normalise lead data before outreach. */}
            {(() => {
              const added = workflowPreview.some((s) => s.id === AI_STEP_ID);
              return (
                <button onClick={addAiParse}
                  className={`mt-2 relative w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    added ? 'border-[#0b1957] bg-[#0b1957]/[0.04] shadow-sm ring-1 ring-[#0b1957]/20' : 'border-border hover:border-[#0b1957]/30 hover:bg-muted/40'
                  }`}>
                  <IconChip icon={<Sparkles className="h-4 w-4 text-violet-600" />} chip="bg-violet-50 dark:bg-violet-950/30" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground truncate">AI Agent</span>
                    <span className="block text-xs text-muted-foreground truncate">Clean messy titles / names before LinkedIn</span>
                  </span>
                  {added && (
                    <span className="h-5 w-5 rounded-full bg-[#0b1957] flex items-center justify-center flex-shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </span>
                  )}
                </button>
              );
            })()}
            {/* Data enrichment — reveal email/phone via FullEnrich. */}
            {(() => {
              const added = workflowPreview.some((s) => s.id === ENRICH_STEP_ID);
              return (
                <button onClick={addDataEnrich}
                  className={`mt-2 relative w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    added ? 'border-[#0b1957] bg-[#0b1957]/[0.04] shadow-sm ring-1 ring-[#0b1957]/20' : 'border-border hover:border-[#0b1957]/30 hover:bg-muted/40'
                  }`}>
                  <IconChip icon={<Contact className="h-4 w-4 text-teal-600" />} chip="bg-teal-50 dark:bg-teal-950/30" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground truncate">Enrich contact</span>
                    <span className="block text-xs text-muted-foreground truncate">Reveal email &amp; phone (FullEnrich)</span>
                  </span>
                  {added && (
                    <span className="h-5 w-5 rounded-full bg-[#0b1957] flex items-center justify-center flex-shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </span>
                  )}
                </button>
              );
            })()}
            {/* Export results — ship the final result set to files / DB / channels. */}
            {(() => {
              const added = workflowPreview.some((s) => s.id === EXPORT_STEP_ID);
              return (
                <button onClick={addExport}
                  className={`mt-2 relative w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    added ? 'border-[#0b1957] bg-[#0b1957]/[0.04] shadow-sm ring-1 ring-[#0b1957]/20' : 'border-border hover:border-[#0b1957]/30 hover:bg-muted/40'
                  }`}>
                  <IconChip icon={<Download className="h-4 w-4 text-cyan-700" />} chip="bg-cyan-50 dark:bg-cyan-950/30" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground truncate">Export results</span>
                    <span className="block text-xs text-muted-foreground truncate">File · DB · Email · WhatsApp · more</span>
                  </span>
                  {added && (
                    <span className="h-5 w-5 rounded-full bg-[#0b1957] flex items-center justify-center flex-shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </span>
                  )}
                </button>
              );
            })()}
            {/* LinkedIn auto-post — recurring posts to the tenant's own feed. */}
            {(() => {
              const added = workflowPreview.some((s) => s.id === AUTOPOST_STEP_ID);
              return (
                <button onClick={addAutopost}
                  className={`mt-2 relative w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    added ? 'border-[#0b1957] bg-[#0b1957]/[0.04] shadow-sm ring-1 ring-[#0b1957]/20' : 'border-border hover:border-[#0b1957]/30 hover:bg-muted/40'
                  }`}>
                  <IconChip icon={<Megaphone className="h-4 w-4 text-[#0077B5]" />} chip="bg-sky-50 dark:bg-sky-950/30" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground truncate">LinkedIn auto-post</span>
                    <span className="block text-xs text-muted-foreground truncate">Recurring posts to your own feed</span>
                  </span>
                  {added && (
                    <span className="h-5 w-5 rounded-full bg-[#0b1957] flex items-center justify-center flex-shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </span>
                  )}
                </button>
              );
            })()}
          </div>

          {/* 3 · Follow-ups */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-5 w-5 rounded-full bg-[#0b1957] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">3</span>
              <span className="text-sm font-semibold text-foreground">Follow-ups</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2.5 ml-7">Automatic touch points after your outreach</p>
            {(() => {
              const added = workflowPreview.some((s) => s.id === FOLLOWUP_STEP_ID);
              return (
                <button onClick={addFollowup}
                  className={`relative w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    added ? 'border-[#0b1957] bg-[#0b1957]/[0.04] shadow-sm ring-1 ring-[#0b1957]/20' : 'border-border hover:border-[#0b1957]/30 hover:bg-muted/40'
                  }`}>
                  <IconChip icon={<ListOrdered className="h-4 w-4 text-indigo-600" />} chip="bg-indigo-50 dark:bg-indigo-950/30" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground truncate">Follow-up sequence</span>
                    <span className="block text-xs text-muted-foreground truncate">Touches · spacing · channel · human review</span>
                  </span>
                  {added && (
                    <span className="h-5 w-5 rounded-full bg-[#0b1957] flex items-center justify-center flex-shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </span>
                  )}
                </button>
              );
            })()}
          </div>

          {/* 4 · Analytics */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-5 w-5 rounded-full bg-[#0b1957] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">4</span>
              <span className="text-sm font-semibold text-foreground">Analytics</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2.5 ml-7">Campaign stats to your inbox or WhatsApp</p>
            {(() => {
              const added = workflowPreview.some((s) => s.id === ANALYTICS_STEP_ID);
              return (
                <button onClick={addAnalytics}
                  className={`relative w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    added ? 'border-[#0b1957] bg-[#0b1957]/[0.04] shadow-sm ring-1 ring-[#0b1957]/20' : 'border-border hover:border-[#0b1957]/30 hover:bg-muted/40'
                  }`}>
                  <IconChip icon={<BarChart3 className="h-4 w-4 text-cyan-600" />} chip="bg-cyan-50 dark:bg-cyan-950/30" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground truncate">Analytics report</span>
                    <span className="block text-xs text-muted-foreground truncate">Channel · frequency · data to send</span>
                  </span>
                  {added && (
                    <span className="h-5 w-5 rounded-full bg-[#0b1957] flex items-center justify-center flex-shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </span>
                  )}
                </button>
              );
            })()}
          </div>

          {/* ── 5. AI Media ───────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-5 w-5 rounded-full bg-[#0b1957] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">5</span>
              <span className="text-sm font-semibold text-foreground">AI Media</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2.5 ml-7">Generate a brand image or video to attach to outreach</p>
            {(() => {
              const added = workflowPreview.some((s) => s.id === MEDIA_STEP_ID);
              return (
                <button onClick={addMedia}
                  className={`relative w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    added ? 'border-[#0b1957] bg-[#0b1957]/[0.04] shadow-sm ring-1 ring-[#0b1957]/20' : 'border-border hover:border-[#0b1957]/30 hover:bg-muted/40'
                  }`}>
                  <IconChip icon={<Wand2 className="h-4 w-4 text-fuchsia-600" />} chip="bg-fuchsia-50 dark:bg-fuchsia-950/30" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground truncate">Generate media</span>
                    <span className="block text-xs text-muted-foreground truncate">Image / video · attaches to email &amp; WhatsApp</span>
                  </span>
                  {added && (
                    <span className="h-5 w-5 rounded-full bg-[#0b1957] flex items-center justify-center flex-shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </span>
                  )}
                </button>
              );
            })()}
          </div>

          {/* ── 6. Sync back to CRM ───────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-5 w-5 rounded-full bg-[#0b1957] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">6</span>
              <span className="text-sm font-semibold text-foreground">Sync back to Zoho</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2.5 ml-7">Write campaign data back onto the Zoho contact</p>
            {(() => {
              const added = workflowPreview.some((s) => s.id === ZOHO_UPDATE_STEP_ID);
              return (
                <button onClick={addZohoUpdate}
                  className={`relative w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    added ? 'border-[#0b1957] bg-[#0b1957]/[0.04] shadow-sm ring-1 ring-[#0b1957]/20' : 'border-border hover:border-[#0b1957]/30 hover:bg-muted/40'
                  }`}>
                  <IconChip icon={<DatabaseZap className="h-4 w-4 text-red-600" />} chip="bg-red-50 dark:bg-red-950/30" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground truncate">Update Zoho record</span>
                    <span className="block text-xs text-muted-foreground truncate">Map fields · write-back on completion</span>
                  </span>
                  {added && (
                    <span className="h-5 w-5 rounded-full bg-[#0b1957] flex items-center justify-center flex-shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </span>
                  )}
                </button>
              );
            })()}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative min-w-0">
          {workflowPreview.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Pick a contact source to start your workflow →
            </div>
          ) : (
            <ReactFlowProvider>
              <BuilderCanvas steps={workflowPreview} branches={mcBranches} switchId={MULTICOND_STEP_ID} />
            </ReactFlowProvider>
          )}
          {renderEditor()}
        </div>
      </div>

      {/* AI Media Studio (MAGe) — generate assets, then pick from the gallery. */}
      {showMediaStudio && (
        <MediaGenerationModal
          isOpen={showMediaStudio}
          onClose={() => { setShowMediaStudio(false); setMediaGalleryOpen(true); mediaBuilder.fetchGallery?.().catch(() => {}); }}
        />
      )}
    </div>
  );
}

export default CustomWorkflowBuilder;
