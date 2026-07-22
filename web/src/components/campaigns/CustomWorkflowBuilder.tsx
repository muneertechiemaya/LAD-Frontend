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
import { useState, useMemo, useEffect, useCallback } from 'react';
import ReactFlow, { ReactFlowProvider, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Rocket, Loader2, Linkedin, Mail, MessageCircle, Phone, Clock,
  Users, Repeat, Search, X, HardDrive, Inbox, ListOrdered, BarChart3, GitFork, DatabaseZap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchWithTenant } from '@/lib/fetch-with-tenant';
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

type SourceKey = 'zoho_recurring' | 'zoho_once' | 'ghl_once' | 'linkedin_search';

const SOURCES: { key: SourceKey; label: string; sub: string; icon: React.ReactNode; chip: string; recurring?: boolean }[] = [
  { key: 'zoho_recurring', label: 'Zoho CRM — recurring', sub: 'Import new contacts daily', icon: <Repeat className="h-4 w-4 text-red-600" />, chip: 'bg-red-50 dark:bg-red-950/30', recurring: true },
  { key: 'zoho_once', label: 'Zoho CRM — one-time', sub: 'Import synced contacts now', icon: <Users className="h-4 w-4 text-red-600" />, chip: 'bg-red-50 dark:bg-red-950/30' },
  { key: 'ghl_once', label: 'GoHighLevel — one-time', sub: 'Import synced contacts now', icon: <Users className="h-4 w-4 text-blue-600" />, chip: 'bg-blue-50 dark:bg-blue-950/30' },
  { key: 'linkedin_search', label: 'LinkedIn Search', sub: 'Find new leads by keywords', icon: <Search className="h-4 w-4 text-[#0077B5]" />, chip: 'bg-sky-50 dark:bg-sky-950/30' },
];

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

function BuilderCanvas({ steps }: { steps: WorkflowPreviewStep[] }) {
  const initialNodes = useMemo(() => createReactFlowNodes(steps, 'vertical'), [steps]);
  const initialEdges = useMemo(() => createReactFlowEdges(steps, 'vertical'), [steps]);
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
    const onEdit = (e: any) => setEditingId(e.detail?.stepId || null);
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

  const setCfg = useCallback((id: string, patch: any) => {
    setConfigs((c) => ({ ...c, [id]: { ...(c[id] || {}), ...patch } }));
  }, []);

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

  const editingStep = workflowPreview.find((s) => s.id === editingId) || null;
  const cfg = editingId ? (configs[editingId] || {}) : {};

  // ── Launch ────────────────────────────────────────────────────────────────
  const launch = async () => {
    setError(null);
    if (!name.trim()) { setError('Name your workflow.'); return; }
    if (!source) { setError('Pick a contact source (first node).'); return; }
    const outreachSteps = workflowPreview.filter(
      (s) => s.id !== SOURCE_STEP_ID && s.id !== FOLLOWUP_STEP_ID && s.id !== ANALYTICS_STEP_ID && s.id !== ZOHO_UPDATE_STEP_ID
    );
    const followupNode = workflowPreview.find((s) => s.id === FOLLOWUP_STEP_ID);
    const analyticsNode = workflowPreview.find((s) => s.id === ANALYTICS_STEP_ID);
    const zohoUpdateNode = workflowPreview.find((s) => s.id === ZOHO_UPDATE_STEP_ID);
    if (!outreachSteps.length && !followupNode) { setError('Add at least one outreach step.'); return; }
    if (analyticsNode && !(configs[ANALYTICS_STEP_ID]?.recipient || '').trim()) {
      setError('Add a recipient (email or WhatsApp number) in the Analytics report node.'); setEditingId(ANALYTICS_STEP_ID); return;
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
        steps.push({
          type: 'lead_generation', title: 'LinkedIn Lead Search', channel: 'linkedin', order_index: order++,
          config: {
            source: 'linkedin_search',
            leadGenerationFilters: { keywords: (srcCfg.keywords || '').trim() },
            leadGenerationLimit: perDayN,
          },
        });
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
        ...(initialLeads ? { initial_leads: initialLeads } : {}),
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
    const isMacro = isFollowup || isAnalytics || isZohoUpdate;
    const visual = isSource
      ? SOURCES.find((s) => s.key === source)
      : isFollowup
        ? { icon: <ListOrdered className="h-4 w-4 text-indigo-600" />, chip: 'bg-indigo-50 dark:bg-indigo-950/30' }
        : isAnalytics
          ? { icon: <BarChart3 className="h-4 w-4 text-cyan-600" />, chip: 'bg-cyan-50 dark:bg-cyan-950/30' }
          : isZohoUpdate
            ? { icon: <DatabaseZap className="h-4 w-4 text-red-600" />, chip: 'bg-red-50 dark:bg-red-950/30' }
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
              {isSource ? 'Contact source settings' : isFollowup ? 'Follow-up sequence settings' : isAnalytics ? 'Report settings' : isZohoUpdate ? 'Field mapping' : isRouter ? 'Fallback routing settings' : 'Step settings'}
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
          {isSource && source === 'linkedin_search' && (
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Search keywords</label>
              <Input value={cfg.keywords || ''} onChange={(e) => setCfg(editingId, { keywords: e.target.value })} placeholder="e.g. VP Sales SaaS UAE" /></div>
          )}

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

          {/* ── 5. Sync back to CRM ───────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="h-5 w-5 rounded-full bg-[#0b1957] text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0">5</span>
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
              <BuilderCanvas steps={workflowPreview} />
            </ReactFlowProvider>
          )}
          {renderEditor()}
        </div>
      </div>
    </div>
  );
}

export default CustomWorkflowBuilder;
