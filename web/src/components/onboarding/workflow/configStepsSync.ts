/**
 * Two-way sync between the guided campaign-config toggles and the Workflow
 * Builder canvas.
 *
 * The `workflowPreview` steps array is the SINGLE SOURCE OF TRUTH. The guided
 * config's structural selections — LinkedIn actions (connect / message /
 * profile_view), follow-up channels (email / whatsapp / voice_call) and the
 * trigger condition — are DERIVED from it (`deriveConfig`), and editing a
 * toggle reconciles back into it (`applyConfig`). Because both the toggles and
 * the canvas mutate the same array, add/remove in either surface reflects in
 * the other in real time.
 *
 * Channel account/template selections (email from-address, WA account, voice
 * agent, …) are campaign-level, not per-step, so they stay in their own state
 * and are merged at launch — they are intentionally NOT part of this module.
 *
 * Per-step content (a step's message / delay) lives on the step object and is
 * edited via the canvas StepEditor or the config forms; this module preserves
 * those fields across a reconcile by matching on step type.
 */

export interface SyncStep {
  id: string;
  type: string;
  title: string;
  description?: string;
  channel?: string;
  // Per-step content preserved across reconciles:
  message?: string;
  delayDays?: number;
  delayHours?: number;
  condition?: string; // only on a wait_for_condition step
  leadLimit?: number;  // only on the lead_generation step
  [k: string]: unknown;
}

export interface DerivedConfig {
  actions: string[];        // subset of ['profile_view','connect','message']
  nextChannels: string[];   // subset of ['email','whatsapp','voice_call']
  triggerCondition: string; // '' | 'connection_accepted' | 'message_replied' | 'profile_visited' | …
}

const LI_ACTION_BY_TYPE: Record<string, string> = {
  linkedin_visit: 'profile_view',
  linkedin_connect: 'connect',
  linkedin_message: 'message',
};

const CHANNEL_BY_TYPE: Record<string, string> = {
  email_send: 'email',
  whatsapp_send: 'whatsapp',
  voice_agent_call: 'voice_call',
};

const TYPE_BY_CHANNEL: Record<string, string> = {
  email: 'email_send',
  whatsapp: 'whatsapp_send',
  voice_call: 'voice_agent_call',
};

const COND_LABELS: Record<string, string> = {
  connection_accepted: 'Wait for Connection Accepted',
  message_replied: 'Wait for Message Reply',
  profile_visited: 'Wait for Profile Visit',
  email_read: 'Wait for Email Read',
  email_replied: 'Wait for Email Reply',
  wa_read: 'Wait for WhatsApp Read',
  wa_replied: 'Wait for WhatsApp Reply',
  call_completed: 'Wait for Call Completed',
  call_answered: 'Wait for Call Answered',
};

/** Read the current structural config back out of the canonical steps array. */
export function deriveConfig(steps: SyncStep[] | null | undefined): DerivedConfig {
  const actions: string[] = [];
  const nextChannels: string[] = [];
  let triggerCondition = '';
  for (const s of steps || []) {
    if (LI_ACTION_BY_TYPE[s.type]) actions.push(LI_ACTION_BY_TYPE[s.type]);
    else if (CHANNEL_BY_TYPE[s.type]) nextChannels.push(CHANNEL_BY_TYPE[s.type]);
    else if (s.type === 'wait_for_condition') triggerCondition = s.condition || '';
  }
  return { actions, nextChannels, triggerCondition };
}

/** Factory for a fresh structural step of a given kind. */
function makeStep(kind: string, existing?: SyncStep): SyncStep {
  if (existing) return existing; // preserve id + per-step content (message/delays/condition)
  switch (kind) {
    case 'lead_generation':
      return { id: 'lead-gen', type: 'lead_generation', title: 'LinkedIn Lead Search', description: 'Find target leads on LinkedIn', channel: 'linkedin' };
    case 'linkedin_connect':
      return { id: 'connect', type: 'linkedin_connect', title: 'Send Connection Request', description: 'Auto-connect with leads on LinkedIn', channel: 'linkedin' };
    case 'linkedin_message':
      return { id: 'message', type: 'linkedin_message', title: 'Send Follow-up Message', description: 'Message after connection accepted', channel: 'linkedin' };
    case 'linkedin_visit':
      return { id: 'profile_view', type: 'linkedin_visit', title: 'View Profile', description: 'Visit their LinkedIn profile', channel: 'linkedin' };
    case 'wait_for_condition':
      return { id: 'condition', type: 'wait_for_condition', title: 'Wait for Condition', description: 'Trigger condition', channel: 'system' };
    case 'email_send':
      return { id: 'ch-email', type: 'email_send', title: 'Send Follow-up Email', description: 'Follow up via email', channel: 'email' };
    case 'whatsapp_send':
      return { id: 'ch-whatsapp', type: 'whatsapp_send', title: 'Send WhatsApp Message', description: 'Follow up via whatsapp', channel: 'whatsapp' };
    case 'voice_agent_call':
      return { id: 'ch-voice_call', type: 'voice_agent_call', title: 'AI Voice Call', description: 'Follow up via voice_call', channel: 'voice' };
    default:
      return { id: `${kind}-${Math.random().toString(36).slice(2, 8)}`, type: kind, title: kind };
  }
}

/**
 * Rebuild the canonical steps array for a target structural config, PRESERVING
 * every existing step's per-step content (message/delay/condition/leadLimit/id)
 * by matching on type. Channel steps are materialised even without a trigger
 * (the wait_for_condition step is added only when a trigger is set) — this is
 * what lets "channels selected before a trigger" round-trip without loss.
 *
 * Canonical order: lead_generation → LinkedIn actions (connect, message,
 * profile_view) → wait_for_condition (if trigger) → follow-up channels.
 */
export function buildStepsFromConfig(cfg: DerivedConfig, existing: SyncStep[] = []): SyncStep[] {
  const byType = new Map<string, SyncStep>();
  for (const s of existing) if (!byType.has(s.type)) byType.set(s.type, s);
  const take = (type: string) => makeStep(type, byType.get(type));

  const out: SyncStep[] = [];
  // Lead search is always the entry step (preserve an existing one if present).
  out.push(take('lead_generation'));

  if (cfg.actions.includes('connect')) out.push(take('linkedin_connect'));
  if (cfg.actions.includes('message')) out.push(take('linkedin_message'));
  if (cfg.actions.includes('profile_view')) out.push(take('linkedin_visit'));

  if (cfg.triggerCondition) {
    const cond = take('wait_for_condition');
    cond.condition = cfg.triggerCondition;
    cond.title = COND_LABELS[cfg.triggerCondition] || 'Wait for Condition';
    out.push(cond);
  }

  for (const ch of cfg.nextChannels) {
    const type = TYPE_BY_CHANNEL[ch];
    if (type) out.push(take(type));
  }

  return out;
}

/** Merge a partial structural change and rebuild the steps. */
export function applyConfig(steps: SyncStep[], patch: Partial<DerivedConfig>): SyncStep[] {
  const merged = { ...deriveConfig(steps), ...patch };
  return buildStepsFromConfig(merged, steps);
}

export const _internal = { LI_ACTION_BY_TYPE, CHANNEL_BY_TYPE, TYPE_BY_CHANNEL, COND_LABELS };
