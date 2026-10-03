'use client';

/**
 * Home — a fixed, calm dashboard (replaces the drag-and-drop widget grid).
 *
 *   Greeting · one-line summary · Ask Mr LAD
 *   Today: waiting on you · meetings today · replies this week · credits left
 *   Your campaign pipeline (reached → connected → replied → ready for you),
 *   week/month/quarter, each stage compared with the period before
 *   Mr LAD noticed (real signals only)  |  Up next (meetings)
 *   Channels — only the ones this tenant has connected
 *   Spend
 *
 * Every number comes from a real source; a source that fails renders "—" with
 * a note, never 0 (failure ≠ emptiness). Each channel tile is its own component
 * so a channel that isn't connected never fetches anything.
 */

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useMemo, useState, type ReactNode } from 'react';
import { format, isSameDay } from 'date-fns';
import {
  ArrowRight,
  CalendarClock,
  Mail,
  Phone,
  SlidersHorizontal,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMyTasksCount } from '@lad/frontend-features/tasks';
import { useMeetings, type Meeting } from '@lad/frontend-features/calendar';
import {
  useDashboardCalls,
  useEmailBroadcastSummary,
  useInstagramSummary,
  useLinkedInSummary,
  useHomeLayout,
  usePipelineCounts,
  useResetHomeLayout,
  useSaveHomeLayout,
  useWalletStats,
  type HomeLayoutSection,
  type PipelinePeriod,
} from '@lad/frontend-features/overview';
import { useConversationAnalytics } from '@/components/overview/useConversationAnalytics';
import { useConnectedChannels } from '@/hooks/useConnectedChannels';
import { ChannelIcon } from '@/components/conversations/ChannelIcon';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/app-toaster';
import { CustomizeHomeSheet } from './CustomizeHomeSheet';
import { SECTION_BY_ID, SPAN_CLASS, resolveLayout, sameLayout } from './homeSections';

// ── Opt-in widgets (from the earlier configurable dashboard) ────────────────
// Loaded only when a user adds one, so the default Home stays light.

// The old widgets are typed React.FC against a duplicate @types/react, so the
// loader narrows them here rather than at every import.
type WidgetComponent = React.ComponentType<{ id: string }>;
const widget = (load: () => Promise<unknown>) =>
  dynamic(() => load().then((c) => c as WidgetComponent), { ssr: false, loading: () => <div className="h-64 w-full animate-pulse rounded-[20px] bg-slate-200/60 dark:bg-white/5" /> });

const EXTRA_WIDGETS: Record<string, WidgetComponent> = {
  'lead-journey': widget(() => import('@/components/overview/widgets/LeadJourneyWidget').then((m) => m.LeadJourneyWidget)),
  'combined-funnel': widget(() => import('@/components/overview/widgets/CombinedFunnelWidget').then((m) => m.CombinedFunnelWidget)),
  calendar: widget(() => import('@/components/overview/widgets/CalendarWidget').then((m) => m.CalendarWidget)),
  'conversation-funnel': widget(() => import('@/components/overview/widgets/ConversationFunnelWidget').then((m) => m.ConversationFunnelWidget)),
  'reengage-topics': widget(() => import('@/components/overview/widgets/ReengageTopicsWidget').then((m) => m.ReengageTopicsWidget)),
  'broadcast-performance': widget(() => import('@/components/overview/widgets/BroadcastPerformanceWidget').then((m) => m.BroadcastPerformanceWidget)),
  'linkedin-funnel': widget(() => import('@/components/overview/widgets/LinkedInFunnelWidget').then((m) => m.LinkedInFunnelWidget)),
  'email-activity': widget(() => import('@/components/overview/widgets/EmailActivityWidget').then((m) => m.EmailActivityWidget)),
  'instagram-activity': widget(() => import('@/components/overview/widgets/InstagramActivityWidget').then((m) => m.InstagramActivityWidget)),
  'voice-agents': widget(() => import('@/components/overview/widgets/VoiceAgentsWidget').then((m) => m.VoiceAgentsWidget)),
};

// ── Shared pieces ───────────────────────────────────────────────────────────

const CARD =
  'rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 dark:border-blue-950/50 dark:bg-[#071131]';
const TILE = 'rounded-2xl bg-white/70 p-4 ring-1 ring-slate-200/70 dark:bg-white/[0.04] dark:ring-blue-950/50';
const H2 = 'text-base font-semibold text-slate-900 dark:text-white';
const MUTED = 'text-sm text-slate-600 dark:text-slate-300';

const nf = new Intl.NumberFormat();
const fmt = (n: number | null | undefined) => (n == null ? '—' : nf.format(Math.round(n)));

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Tiny line chart; renders nothing for <2 points. */
function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const w = 100;
  const h = 28;
  const max = Math.max(1, ...values);
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 2) - 1).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn('h-7 w-full', className)} aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <span className={cn('inline-block animate-pulse rounded-md bg-slate-200/80 dark:bg-white/10', className)} aria-hidden="true" />;
}

const PERIOD_WORD: Record<PipelinePeriod, string> = { week: 'last week', month: 'last month', quarter: 'last quarter' };

/** "+4 vs last week" in plain words; null while the previous period is unknown. */
function Delta({ now, before, period }: { now: number; before: number | undefined; period: PipelinePeriod }) {
  if (before === undefined) return null;
  const d = now - before;
  const word = PERIOD_WORD[period];
  return (
    <span
      className={cn(
        'text-xs font-medium',
        d > 0 ? 'text-emerald-700 dark:text-emerald-300' : d < 0 ? 'text-red-700 dark:text-red-300' : 'text-slate-600 dark:text-slate-400',
      )}
    >
      {d > 0 ? `▲ ${fmt(d)} more than ${word}` : d < 0 ? `▼ ${fmt(-d)} fewer than ${word}` : `Same as ${word}`}
    </span>
  );
}

// ── Greeting ────────────────────────────────────────────────────────────────

function Greeting({ tasks, meetingsToday, onCustomize }: { tasks: number | undefined; meetingsToday: number | undefined; onCustomize: () => void }) {
  const { user } = useAuth();
  const now = new Date();
  const h = now.getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const first =
    ((user as { firstName?: string } | null)?.firstName || (user?.name || '').trim().split(/\s+/)[0] || '').trim();

  const bits: string[] = [];
  if (meetingsToday) bits.push(`${meetingsToday} meeting${meetingsToday === 1 ? '' : 's'} today`);
  if (tasks) bits.push(`${tasks} thing${tasks === 1 ? '' : 's'} need${tasks === 1 ? 's' : ''} you`);
  const summary = bits.length ? `${bits.join(' · ')}.` : "Here's where things stand.";

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-slate-600 dark:text-slate-400">{format(now, 'EEEE, d MMMM')}</p>
        <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-tight text-slate-900 sm:text-[32px] dark:text-white" style={{ fontFamily: '"Space Grotesk", system-ui' }}>
          {part}
          {first && (
            <>
              ,{' '}
              <span className="bg-gradient-to-r from-[#0b1957] to-[#2563eb] bg-clip-text text-transparent dark:from-blue-200 dark:to-blue-400">{first}</span>
            </>
          )}
        </h1>
        <p className={cn(MUTED, 'mt-1')}>{summary}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
        <Link
          href="/onboarding/advanced-search-ai"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:border-blue-950/50 dark:bg-[#071131] dark:text-slate-200 dark:hover:text-white"
        >
          <Sparkles className="h-4 w-4 text-[#2563eb] dark:text-blue-300" aria-hidden="true" />
          Ask Mr LAD…
        </Link>
        <button
          type="button"
          onClick={onCustomize}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:border-blue-950/50 dark:bg-[#071131] dark:text-slate-200 dark:hover:text-white"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Customize
        </button>
      </div>
    </header>
  );
}

// ── Today ───────────────────────────────────────────────────────────────────

function TodayTile({
  label,
  value,
  sub,
  href,
  loading,
  failed,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  loading?: boolean;
  failed?: boolean;
}) {
  const body = (
    <>
      <p className="text-sm text-slate-600 dark:text-slate-300">{label}</p>
      <p className="mt-1 text-[26px] leading-none font-semibold tabular-nums text-slate-900 dark:text-white">
        {loading ? <Skeleton className="h-6 w-12" /> : failed ? '—' : value}
      </p>
      <p className="mt-2 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
        {failed ? "Couldn't load" : sub}
        {href && !failed && <ArrowRight className="h-3 w-3" aria-hidden="true" />}
      </p>
    </>
  );
  return href ? (
    <Link href={href} className={cn(TILE, 'block transition hover:ring-slate-300 dark:hover:ring-blue-900')}>
      {body}
    </Link>
  ) : (
    <div className={TILE}>{body}</div>
  );
}

// ── Pipeline ────────────────────────────────────────────────────────────────

const PERIODS: { key: PipelinePeriod; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
];

function PipelineCard() {
  const [period, setPeriod] = useState<PipelinePeriod>('week');
  const q = usePipelineCounts(period);
  const prevQ = usePipelineCounts(period, 'previous');
  const failed = !q.isLoading && q.data === undefined;
  const c = q.data;
  const p = prevQ.data;
  const stages = c
    ? [
        { label: 'Reached', hint: 'people your campaigns contacted', value: c.sent, before: p?.sent },
        { label: 'Connected', hint: 'accepted or opened', value: c.accepted, before: p?.accepted },
        { label: 'Replied', hint: 'wrote back', value: c.responded, before: p?.responded },
        { label: 'Ready for you', hint: 'interested, waiting on your team', value: c.sah, before: p?.sah },
      ]
    : [];
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <section className={CARD} aria-labelledby="home-pipeline">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="home-pipeline" className={H2}>Your campaign pipeline</h2>
          <p className={MUTED}>People your campaigns reached, and how far they got.</p>
        </div>
        <div role="group" aria-label="Period" className="inline-flex rounded-full bg-slate-100 p-1 dark:bg-white/5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'min-h-9 rounded-full px-3 text-sm font-medium transition max-lg:min-h-11',
                period === p.key
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-[#0b1433] dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {q.isLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : failed ? (
        <p role="alert" className="mt-6 text-sm text-red-700 dark:text-red-400">
          Couldn&apos;t load your pipeline right now. It will refresh on its own.
        </p>
      ) : (
        <>
          {/* Phones: one row per stage with a horizontal bar (columns waste height). */}
          <ol className="mt-5 space-y-3 sm:hidden">
            {stages.map((s, i) => {
              const prev = i > 0 ? stages[i - 1].value : null;
              const pct = prev ? Math.round((s.value / prev) * 100) : null;
              return (
                <li key={s.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-slate-700 dark:text-slate-200">{s.label}</span>
                    <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-900 dark:text-white">{fmt(s.value)}</span>
                      {pct != null && <span className="ml-1">· {pct}%</span>}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-xs text-slate-600 dark:text-slate-400">{s.hint}</span>
                    <Delta now={s.value} before={s.before} period={period} />
                  </div>
                  <div className="mt-1.5 h-2.5 w-full rounded-full bg-slate-100 dark:bg-white/5" aria-hidden="true">
                    <div
                      className={cn('h-full rounded-full', i === stages.length - 1 ? 'bg-[#0b1957] dark:bg-blue-500' : 'bg-[#0b1957]/25 dark:bg-blue-400/40')}
                      style={{ width: `${s.value > 0 ? Math.max(4, (s.value / max) * 100) : 0}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
          <ol className="mt-6 hidden grid-cols-4 gap-x-4 sm:grid">
            {stages.map((s, i) => {
              const prev = i > 0 ? stages[i - 1].value : null;
              const pct = prev ? Math.round((s.value / prev) * 100) : null;
              return (
                <li key={s.label} className="flex flex-col">
                  <div className="flex h-24 items-end">
                    <div
                      className={cn(
                        'w-full rounded-xl transition-all',
                        // A zero stage keeps a neutral baseline stub, not a coloured bar.
                        s.value === 0
                          ? 'bg-slate-200 dark:bg-white/10'
                          : i === stages.length - 1 ? 'bg-[#0b1957] dark:bg-blue-500' : 'bg-[#0b1957]/15 dark:bg-blue-400/25',
                      )}
                      style={{ height: `${Math.max(6, (s.value / max) * 100)}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-3 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">{fmt(s.value)}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {s.label}
                    {pct != null && <span className="ml-1 text-slate-500 dark:text-slate-400">· {pct}%</span>}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{s.hint}</p>
                  <p className="mt-1"><Delta now={s.value} before={s.before} period={period} /></p>
                </li>
              );
            })}
          </ol>
          {stages.every((s) => s.value === 0) && (
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
              No campaign has reached anyone in this period yet. Start or resume a campaign in Outreach and this fills in as people are contacted.
            </p>
          )}
          {c?.degraded && (
            <p className="mt-4 text-xs text-amber-700 dark:text-amber-300">Part of this period couldn&apos;t be read — counts may be low.</p>
          )}
          <Link href="/crm" className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-[#0b1957] hover:underline dark:text-blue-300">
            See everyone in your Contacts Funnel <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </>
      )}
    </section>
  );
}

// ── Mr LAD noticed ──────────────────────────────────────────────────────────

function InsightsCard({ wabaStatus }: { wabaStatus: 'connected' | 'disconnected' | 'unknown' }) {
  const waba = wabaStatus === 'connected';
  const { data, loading, error } = useConversationAnalytics(7, true);
  const items: { text: string; action: string; href: string }[] = [];
  if (waba && data) {
    const spike = data.volume_spike;
    if (spike?.is_spike && Number.isFinite(spike.pct_change)) {
      items.push({
        text: `WhatsApp conversations are up ${Math.round(spike.pct_change)}% on your usual day.`,
        action: 'Open inbox',
        href: '/conversations?channel=waba',
      });
    }
    const topic = data.unconverted_topics?.[0];
    if (topic && topic.count > 0) {
      items.push({
        text: `“${topic.topic}” came up in ${topic.count} chat${topic.count === 1 ? '' : 's'} that didn't book.`,
        action: 'Re-engage',
        href: '/conversations?channel=waba',
      });
    }
    const handed = data.funnel?.escalated_to_human ?? 0;
    if (handed > 0) {
      items.push({
        text: `${handed} chat${handed === 1 ? ' was' : 's were'} handed to your team this week.`,
        action: 'Review',
        href: '/tasks?view=replies',
      });
    }
  }

  return (
    <section className={CARD} aria-labelledby="home-insights">
      <h2 id="home-insights" className={cn(H2, 'flex items-center gap-2')}>
        <Sparkles className="h-4 w-4 text-[#2563eb] dark:text-blue-300" aria-hidden="true" /> Mr LAD noticed
      </h2>
      {wabaStatus === 'unknown' || (waba && loading && !data) ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
        </div>
      ) : waba && !data && error ? (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Couldn&apos;t read this week&apos;s conversations. Check back shortly.</p>
      ) : !waba ? (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Mr LAD spots patterns in your WhatsApp Business conversations.{' '}
          <Link href="/settings" className="font-medium text-[#0b1957] underline-offset-2 hover:underline dark:text-blue-300">
            Connect WhatsApp Business
          </Link>
        </p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Nothing unusual this week. Mr LAD will flag patterns here as they appear.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-blue-950/50">
          {items.slice(0, 3).map((it) => (
            <li key={it.text} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <p className="text-sm text-slate-700 dark:text-slate-200">{it.text}</p>
              <Link href={it.href} className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-[#0b1957] hover:underline sm:min-h-0 dark:text-blue-300">
                {it.action} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Up next ─────────────────────────────────────────────────────────────────

function meetingWho(m: Meeting) {
  const a = m.attendees?.find((x) => x?.name) ?? m.attendees?.[0];
  return m.title || a?.name || a?.email || 'Meeting';
}

function UpNextCard({ meetings, loading, failed }: { meetings: Meeting[] | undefined; loading: boolean; failed: boolean }) {
  const upcoming = (meetings ?? [])
    .filter((m) => new Date(m.starts_at).getTime() >= Date.now() - 30 * 60_000 && m.status !== 'cancelled')
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 4);
  return (
    <section id="up-next" className={CARD} aria-labelledby="home-upnext">
      <h2 id="home-upnext" className={cn(H2, 'flex items-center gap-2')}>
        <CalendarClock className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" /> Up next
      </h2>
      {loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      ) : failed ? (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">Couldn&apos;t load your calendar.</p>
      ) : upcoming.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">No meetings booked in the next 7 days.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-blue-950/50">
          {upcoming.map((m) => {
            const d = new Date(m.starts_at);
            return (
              <li key={m.id} className="flex min-h-12 items-center gap-3 py-2.5">
                <span className="w-16 shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{format(d, 'HH:mm')}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-700 dark:text-slate-200">{meetingWho(m)}</span>
                  <span className="block text-xs text-slate-600 dark:text-slate-400">
                    {isSameDay(d, new Date()) ? 'Today' : format(d, 'EEE d MMM')}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Channels (only connected ones mount) ────────────────────────────────────

function ChannelTile({
  icon,
  name,
  value,
  label,
  series,
  loading,
  failed,
  href,
}: {
  icon: React.ReactNode;
  name: string;
  value: string;
  label: string;
  series?: number[];
  loading: boolean;
  failed: boolean;
  href: string;
}) {
  return (
    <Link href={href} className={cn(TILE, 'flex min-w-[150px] flex-col transition hover:ring-slate-300 dark:hover:ring-blue-900')}>
      <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        {icon}
        {name}
      </span>
      <span className="mt-2 h-7 text-[#2563eb] dark:text-blue-300">{series && !failed ? <Sparkline values={series} /> : null}</span>
      <span className="mt-2 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
        {loading ? <Skeleton className="h-5 w-10" /> : failed ? '—' : value}
      </span>
      <span className="text-xs text-slate-600 dark:text-slate-400">{failed ? "Couldn't load" : label}</span>
    </Link>
  );
}

function WhatsAppTile() {
  const { data, loading } = useConversationAnalytics(7, true);
  const series = (data?.daily_volume ?? []).map((d) => d.count);
  const total = series.reduce((a, b) => a + b, 0);
  return (
    <ChannelTile
      icon={<ChannelIcon channel={'business_whatsapp' as any} size={16} />}
      name="WhatsApp"
      value={fmt(total)}
      label="conversations · 7 days"
      series={series}
      loading={loading && !data}
      failed={!loading && !data}
      href="/conversations?channel=waba"
    />
  );
}

function LinkedInTile() {
  const q = useLinkedInSummary();
  const d = q.data;
  return (
    <ChannelTile
      icon={<ChannelIcon channel={'linkedin' as any} size={16} />}
      name="LinkedIn"
      value={d?.replyRate != null ? `${Math.round(d.replyRate)}%` : fmt(d?.replied)}
      label={d?.replyRate != null ? 'reply rate' : 'replies'}
      loading={q.isLoading}
      failed={!q.isLoading && !d}
      href="/conversations?channel=linkedin"
    />
  );
}

function EmailTile() {
  const q = useEmailBroadcastSummary();
  return (
    <ChannelTile
      icon={<Mail className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />}
      name="Email"
      value={fmt(q.data?.sent)}
      label="emails sent in recent broadcasts"
      loading={q.isLoading}
      failed={!q.isLoading && !q.data}
      href="/conversations?channel=email"
    />
  );
}

function InstagramTile() {
  const q = useInstagramSummary();
  return (
    <ChannelTile
      icon={<ChannelIcon channel={'instagram' as any} size={16} />}
      name="Instagram"
      value={fmt(q.data?.unread)}
      label="unread DMs"
      loading={q.isLoading}
      failed={!q.isLoading && !q.data}
      href="/conversations?channel=instagram"
    />
  );
}

function CallsTile() {
  const range = useMemo(() => {
    const end = new Date();
    const start = startOfDay(new Date(end.getTime() - 6 * 86_400_000));
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, []);
  const { summary, stats, loading, error } = useDashboardCalls(range);
  const series = (summary ?? [])
    .slice()
    .sort((a, b) => String(a.call_date).localeCompare(String(b.call_date)))
    .map((s) => Number(s.total_calls) || 0);
  const rate = stats?.answerRate;
  const failed = !loading && Boolean(error);
  return (
    <ChannelTile
      icon={<Phone className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />}
      name="Calls"
      value={rate != null ? `${Math.round(Number(rate))}%` : fmt(series.reduce((a, b) => a + b, 0))}
      label={rate != null ? 'answered · 7 days' : 'calls · 7 days'}
      series={series}
      loading={loading}
      failed={failed}
      href="/call-logs"
    />
  );
}

function ChannelsRow() {
  const { statuses, loaded } = useConnectedChannels();
  const on = (id: keyof typeof statuses) => statuses[id] === 'connected';
  const tiles = [
    on('waba') && <WhatsAppTile key="wa" />,
    on('linkedin') && <LinkedInTile key="li" />,
    on('gmail') && <EmailTile key="em" />,
    on('instagram') && <InstagramTile key="ig" />,
    on('voice') && <CallsTile key="vo" />,
  ].filter(Boolean);
  if (!loaded || tiles.length === 0) return null; // inactive channels are hidden, as is the row when none are connected
  return (
    <section aria-labelledby="home-channels">
      <h2 id="home-channels" className={cn(H2, 'mb-3')}>Channels</h2>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))] sm:overflow-visible sm:px-0">
        {tiles}
      </div>
    </section>
  );
}

// ── Spend ───────────────────────────────────────────────────────────────────

function SpendCard({ balance, usage, loading, failed }: { balance: number | null; usage: number | null; loading: boolean; failed: boolean }) {
  return (
    <section className={CARD} aria-labelledby="home-spend">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="home-spend" className={cn(H2, 'flex items-center gap-2')}>
            <Wallet className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" /> Spend
          </h2>
          <p className={MUTED}>Credits pay for every message, call and AI reply.</p>
        </div>
        <Link href="/wallet" className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-blue-950/50 dark:text-slate-200 dark:hover:bg-white/5">
          Top up
        </Link>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm text-slate-600 dark:text-slate-300">Balance</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {loading ? <Skeleton className="h-5 w-16" /> : failed ? '—' : `${fmt(balance)} credits`}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600 dark:text-slate-300">Spent this month</dt>
          <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900 dark:text-white">
            {loading ? <Skeleton className="h-5 w-12" /> : failed || usage == null ? '—' : `${Math.round(usage)}% of credits`}
          </dd>
        </div>
      </dl>
    </section>
  );
}

// ── Page body ───────────────────────────────────────────────────────────────

export function HomeDashboard() {
  const { statuses } = useConnectedChannels();
  const { count: tasks, capped } = useMyTasksCount(true);

  const todayRange = useMemo(() => {
    const from = startOfDay(new Date());
    const to = new Date(from.getTime() + 8 * 86_400_000); // today + next 7 days for Up next
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const meetingsQ = useMeetings(todayRange);
  const meetingsToday = meetingsQ.data?.filter((m) => isSameDay(new Date(m.starts_at), new Date()) && m.status !== 'cancelled');
  const nextToday = meetingsToday
    ?.filter((m) => new Date(m.starts_at).getTime() >= Date.now())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];

  const weekQ = usePipelineCounts('week');
  const lastWeekQ = usePipelineCounts('week', 'previous');
  const replyDelta =
    weekQ.data && lastWeekQ.data ? weekQ.data.responded - lastWeekQ.data.responded : null;
  const wallet = useWalletStats();
  const walletFailed = !wallet.loading && Boolean(wallet.error);

  // ── Layout: saved per user; edited as a live draft while Customize is open.
  const layoutQ = useHomeLayout();
  const saveLayout = useSaveHomeLayout();
  const resetLayout = useResetHomeLayout();
  const { push: toast } = useToast();
  const saved = useMemo(() => resolveLayout(layoutQ.data?.layout?.sections), [layoutQ.data]);
  const [draft, setDraft] = useState<HomeLayoutSection[] | null>(null);
  const [resetRequested, setResetRequested] = useState(false);
  const layout = draft ?? saved;

  const openCustomize = () => {
    setDraft(saved);
    setResetRequested(false);
  };
  const closeCustomize = () => {
    const next = draft;
    setDraft(null);
    if (!next) return;
    const onError = () =>
      toast({ title: 'Couldn’t save your layout', description: 'Your Home is back to how it was. Please try again.', variant: 'error' });
    if (resetRequested && sameLayout(next, resolveLayout(null))) {
      resetLayout.mutate(undefined, { onError });
    } else if (!sameLayout(next, saved)) {
      saveLayout.mutate({ sections: next }, { onError });
    }
  };

  const sections: Record<string, ReactNode> = {
    today: (
      <section aria-label="Today" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TodayTile
          label="Waiting on you"
          value={tasks == null ? '—' : `${tasks}${capped ? '+' : ''}`}
          sub="Open My Tasks"
          href="/tasks"
          loading={tasks === undefined}
        />
        <TodayTile
          label="Meetings today"
          value={fmt(meetingsToday?.length)}
          sub={nextToday ? `Next ${format(new Date(nextToday.starts_at), 'HH:mm')}` : 'Nothing else today'}
          href="#up-next"
          loading={meetingsQ.isLoading}
          failed={!meetingsQ.isLoading && meetingsQ.data === undefined}
        />
        <TodayTile
          label="Campaign replies this week"
          value={fmt(weekQ.data?.responded)}
          sub={
            replyDelta == null
              ? 'People who wrote back'
              : replyDelta === 0
                ? 'Same as last week'
                : `${replyDelta > 0 ? '▲' : '▼'} ${fmt(Math.abs(replyDelta))} ${replyDelta > 0 ? 'more' : 'fewer'} than last week`
          }
          href="/crm"
          loading={weekQ.isLoading}
          failed={!weekQ.isLoading && weekQ.data === undefined}
        />
        <TodayTile
          label="Credits left"
          value={fmt(wallet.stats?.balance)}
          sub="Top up in Wallet"
          href="/wallet"
          loading={wallet.loading && !wallet.stats}
          failed={walletFailed}
        />
      </section>
    ),
    pipeline: <PipelineCard />,
    insights: <InsightsCard wabaStatus={statuses.waba} />,
    'up-next': (
      <UpNextCard
        meetings={meetingsQ.data}
        loading={meetingsQ.isLoading}
        failed={!meetingsQ.isLoading && meetingsQ.data === undefined}
      />
    ),
    channels: <ChannelsRow />,
    spend: (
      <SpendCard
        balance={wallet.stats?.balance ?? null}
        usage={wallet.stats?.usageThisMonth ?? null}
        loading={wallet.loading && !wallet.stats}
        failed={walletFailed}
      />
    ),
  };

  const renderSection = (id: string) => {
    if (sections[id] !== undefined) return sections[id];
    const Widget = EXTRA_WIDGETS[id];
    return Widget ? <Widget id={`home-${id}`} /> : null;
  };

  // Hide inactive channels: a channel-bound section waits for a 'connected' status.
  const visible = layout.filter((s) => {
    if (!s.visible) return false;
    const ch = SECTION_BY_ID.get(s.id)?.channel;
    return !ch || statuses[ch] === 'connected';
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <Greeting tasks={tasks} meetingsToday={meetingsToday?.length} onCustomize={openCustomize} />

      {layoutQ.isLoading ? (
        <div className="space-y-6" aria-busy="true">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      ) : visible.length === 0 ? (
        <div className={cn(CARD, 'text-center')}>
          <p className={MUTED}>Your Home is empty.</p>
          <button type="button" onClick={openCustomize} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#0b1957] hover:underline dark:text-blue-300">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Add sections
          </button>
        </div>
      ) : (
        // Dense flow lets a half-width section backfill the gap beside another.
        <div className="grid grid-cols-1 gap-6 lg:grid-flow-row-dense lg:grid-cols-12">
          {visible.map((s) => (
            <div key={s.id} className={cn('min-w-0 empty:hidden', SPAN_CLASS[SECTION_BY_ID.get(s.id)!.span])}>
              {renderSection(s.id)}
            </div>
          ))}
        </div>
      )}

      <CustomizeHomeSheet
        open={draft !== null}
        onOpenChange={(o) => (o ? openCustomize() : closeCustomize())}
        draft={layout}
        onChange={setDraft}
        onReset={() => {
          setDraft(resolveLayout(null));
          setResetRequested(true);
        }}
        statuses={statuses}
      />
    </div>
  );
}

export default HomeDashboard;
