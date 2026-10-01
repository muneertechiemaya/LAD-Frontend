/**
 * Home dashboard sections — what a user can show, hide and reorder.
 *
 * `core` sections make up the default layout. The rest are opt-in widgets
 * (the earlier configurable dashboard's real-data widgets) added from the
 * Customize panel. A section tied to a channel only renders while that channel
 * is connected, whatever the user picked — inactive channels stay hidden.
 *
 * The saved layout is per user, on the server (`/api/user-preferences/
 * home-dashboard`). resolveLayout() reconciles it with this registry, so a
 * section added in a later release appears without anyone re-saving, and an id
 * that no longer exists is dropped.
 */
import type { HomeLayoutSection } from '@lad/frontend-features/overview';

export type HomeChannel = 'waba' | 'linkedin' | 'gmail' | 'instagram' | 'voice';

export interface HomeSectionDef {
  id: string;
  label: string;
  description: string;
  core: boolean;
  /** Width on large screens; phones always stack. */
  span: 'full' | 'wide' | 'narrow' | 'half';
  channel?: HomeChannel;
}

export const CHANNEL_LABEL: Record<HomeChannel, string> = {
  waba: 'WhatsApp Business',
  linkedin: 'LinkedIn',
  gmail: 'Email',
  instagram: 'Instagram',
  voice: 'Voice',
};

export const HOME_SECTIONS: HomeSectionDef[] = [
  { id: 'today', label: 'Today', description: 'Tasks waiting, meetings, replies and credits.', core: true, span: 'full' },
  { id: 'pipeline', label: 'Your pipeline', description: 'Reached → connected → replied → handed off.', core: true, span: 'full' },
  { id: 'insights', label: 'Insights', description: "What changed in this week's conversations.", core: true, span: 'wide' },
  { id: 'up-next', label: 'Up next', description: 'Your next meetings.', core: true, span: 'narrow' },
  { id: 'channels', label: 'Channels', description: 'A tile per connected channel.', core: true, span: 'full' },
  { id: 'spend', label: 'Spend', description: 'Credit balance and this month’s usage.', core: true, span: 'full' },

  { id: 'lead-journey', label: 'Lead journey', description: 'The leads who accepted, replied or were handed off, by name.', core: false, span: 'full' },
  { id: 'combined-funnel', label: 'Sales funnel', description: 'One cross-channel funnel with drop-off and drill-down.', core: false, span: 'full' },
  { id: 'calendar', label: 'Calendar & scheduler', description: 'Meetings and bookings on a calendar.', core: false, span: 'half' },
  { id: 'conversation-funnel', label: 'Enquiries & bookings', description: 'WhatsApp enquiries → engaged → booked, with drop-off.', core: false, span: 'half', channel: 'waba' },
  { id: 'reengage-topics', label: 'Re-engage by topic', description: 'People who asked about a topic but didn’t book.', core: false, span: 'half', channel: 'waba' },
  { id: 'broadcast-performance', label: 'Broadcast performance', description: 'Delivery and reads per WhatsApp template.', core: false, span: 'full', channel: 'waba' },
  { id: 'linkedin-funnel', label: 'LinkedIn funnel', description: 'Sent → accepted → replied, plus your weekly invite limit.', core: false, span: 'half', channel: 'linkedin' },
  { id: 'email-activity', label: 'Email activity', description: 'Connected senders and broadcast send/fail totals.', core: false, span: 'half', channel: 'gmail' },
  { id: 'instagram-activity', label: 'Instagram activity', description: 'DM threads, unread and connected accounts.', core: false, span: 'half', channel: 'instagram' },
  { id: 'voice-agents', label: 'Voice agents', description: 'Your voice agents and their numbers.', core: false, span: 'half', channel: 'voice' },
];

export const SECTION_BY_ID = new Map(HOME_SECTIONS.map((s) => [s.id, s]));

export const SPAN_CLASS: Record<HomeSectionDef['span'], string> = {
  full: 'lg:col-span-12',
  wide: 'lg:col-span-7',
  narrow: 'lg:col-span-5',
  half: 'lg:col-span-6',
};

export const DEFAULT_LAYOUT: HomeLayoutSection[] = HOME_SECTIONS.map((s) => ({ id: s.id, visible: s.core }));

/** Saved order first (known ids only), then anything new in its default state. */
export function resolveLayout(saved: HomeLayoutSection[] | null | undefined): HomeLayoutSection[] {
  if (!saved?.length) return DEFAULT_LAYOUT;
  const out: HomeLayoutSection[] = [];
  const seen = new Set<string>();
  for (const s of saved) {
    if (!SECTION_BY_ID.has(s.id) || seen.has(s.id)) continue;
    seen.add(s.id);
    out.push({ id: s.id, visible: Boolean(s.visible) });
  }
  for (const def of HOME_SECTIONS) {
    if (!seen.has(def.id)) out.push({ id: def.id, visible: def.core });
  }
  return out;
}

export function sameLayout(a: HomeLayoutSection[], b: HomeLayoutSection[]) {
  return a.length === b.length && a.every((s, i) => s.id === b[i].id && s.visible === b[i].visible);
}
