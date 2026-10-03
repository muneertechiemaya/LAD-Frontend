'use client';

/**
 * My Tasks — everything where a person on the team needs to act, organised
 * for triage rather than as one long scroll:
 *
 *   Replies    WhatsApp chats Mr LAD handed to a person (context "Human").
 *              LinkedIn conversations have no handoff state, so they appear
 *              only via assignment.
 *   Approvals  Items waiting for a yes/no (LinkedIn posts/invites/greetings,
 *              lead reports, market insights), decided right here through the
 *              same handler the WhatsApp/email approval link uses.
 *   Assigned   Conversations assigned to me.
 *   Alerts     My assignment notifications.
 *
 * Layout: tabs with counts across the top. "All" is a digest — each category
 * shows its three most urgent items and a "See all" link; empty categories
 * fold into one "All clear" line. A category tab shows the full list with
 * channel/type filter chips, ten at a time.
 *
 * Each source is its own query, so one failing service degrades only its own
 * category; a source is "failed" when it has no data after loading
 * (data === undefined), never shown as empty.
 */

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  FileText,
  Hand,
  Lightbulb,
  Loader2,
  RefreshCw,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  taskKeys,
  WAITING_CHATS_LIMIT,
  useAssignedConversations,
  useDecideApproval,
  useMarkTaskNotificationRead,
  usePendingApprovals,
  useTaskNotifications,
  useWaitingChats,
  type ApprovalAction,
  type ApprovalType,
  type AssignedConversation,
  type PendingApproval,
  type TaskChannel,
  type TaskNotification,
  type WaitingChat,
} from '@lad/frontend-features/tasks';
import { ChannelIcon } from '@/components/conversations/ChannelIcon';
import { cn } from '@/lib/utils';

// ── Vocabulary ───────────────────────────────────────────────────────────────

const CHANNEL_ICON: Record<TaskChannel, string> = {
  waba: 'business_whatsapp',
  personal: 'personal_whatsapp',
  linkedin: 'linkedin',
};
const CHANNEL_NAME: Record<TaskChannel, string> = {
  waba: 'WhatsApp Business',
  personal: 'Personal WhatsApp',
  linkedin: 'LinkedIn',
};
const CHANNEL_SHORT: Record<TaskChannel, string> = {
  waba: 'WA Business',
  personal: 'WhatsApp',
  linkedin: 'LinkedIn',
};

/** What each button actually does — "Approve" on a LinkedIn draft posts it. */
const APPROVAL_COPY: Record<ApprovalType, { label: string; approve: string; reject: string }> = {
  linkedin_post: { label: 'LinkedIn post', approve: 'Post now', reject: 'Skip' },
  linkedin_invite: { label: 'LinkedIn invite', approve: 'Accept', reject: 'Ignore' },
  linkedin_greeting: { label: 'LinkedIn greeting', approve: 'Send', reject: 'Skip' },
  lead_report: { label: 'Lead report', approve: 'Approve', reject: "Don't send" },
  market_insight: { label: 'Talking point for Mr LAD to use', approve: 'Let Mr LAD use it', reject: 'Dismiss' },
};
const APPROVAL_TYPE_PLURAL: Record<ApprovalType, string> = {
  linkedin_post: 'LinkedIn posts',
  linkedin_invite: 'LinkedIn invites',
  linkedin_greeting: 'LinkedIn greetings',
  lead_report: 'lead reports',
  market_insight: 'talking points',
};
const APPROVAL_TYPE_SHORT: Record<ApprovalType, string> = {
  linkedin_post: 'Posts',
  linkedin_invite: 'Invites',
  linkedin_greeting: 'Greetings',
  lead_report: 'Reports',
  market_insight: 'Talking points',
};

type View = 'all' | 'replies' | 'approvals' | 'assigned' | 'alerts';
const VIEWS: View[] = ['all', 'replies', 'approvals', 'assigned', 'alerts'];

const DIGEST_SIZE = 3;
const PAGE_SIZE = 10;
/** A reply waiting longer than this is flagged. */
const STALE_MS = 24 * 60 * 60 * 1000;

const chatHref = (channel: TaskChannel | null, conversationId: string) =>
  `/conversations?channel=${channel ?? 'waba'}&conversation=${encodeURIComponent(conversationId)}`;

function ago(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : formatDistanceToNow(d, { addSuffix: true });
}
/** Compact wait for a badge: "45m", "23h", "3d". */
function waitingFor(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  const mins = Math.max(1, Math.floor(ms / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
const isStale = (iso: string | null) => !!iso && Date.now() - new Date(iso).getTime() > STALE_MS;
const time = (iso: string | null) => (iso ? new Date(iso).getTime() || 0 : 0);

// ── Small pieces ─────────────────────────────────────────────────────────────

const Loading = () => (
  <p className="flex items-center gap-2 px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
  </p>
);
const Failed = ({ what }: { what: string }) => (
  <p role="alert" className="px-4 py-3 text-sm text-red-700 dark:text-red-400">
    Couldn&apos;t load {what}. Use refresh to try again.
  </p>
);
const Empty = ({ text }: { text: string }) => (
  <p className="flex items-center gap-2 px-4 py-6 text-sm text-slate-600 dark:text-slate-300">
    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> {text}
  </p>
);

function CountBadge({ n, capped, tone = 'primary' }: { n: number; capped?: boolean; tone?: 'primary' | 'muted' }) {
  if (n <= 0) return null;
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none tabular-nums',
        tone === 'primary' ? 'bg-primary text-white dark:bg-blue-500' : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200',
      )}
    >
      {n}
      {capped ? '+' : ''}
    </span>
  );
}

function Avatar({ channel, type }: { channel?: TaskChannel | null; type?: ApprovalType }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10" aria-hidden="true">
      {type === 'lead_report' ? (
        <FileText className="h-[18px] w-[18px] text-slate-600 dark:text-slate-300" />
      ) : type === 'market_insight' ? (
        <Lightbulb className="h-[18px] w-[18px] text-amber-600 dark:text-amber-400" />
      ) : type ? (
        <ChannelIcon channel={'linkedin' as any} size={18} />
      ) : channel ? (
        <ChannelIcon channel={CHANNEL_ICON[channel] as any} size={18} />
      ) : (
        <Bell className="h-[18px] w-[18px] text-slate-600 dark:text-slate-300" />
      )}
    </span>
  );
}

/** One tappable task row. `href` navigates; otherwise `onClick` (e.g. jump to a tab). */
function Row({
  href,
  onClick,
  channel,
  type,
  title,
  sub,
  meta,
  badge,
  unread,
}: {
  href?: string;
  onClick?: () => void;
  channel?: TaskChannel | null;
  type?: ApprovalType;
  title: string;
  sub?: string | null;
  meta?: string | null;
  badge?: { text: string; stale: boolean; title?: string } | null;
  unread?: boolean;
}) {
  const body = (
    <>
      <Avatar channel={channel} type={type} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn('truncate text-sm text-slate-900 dark:text-white', unread ? 'font-semibold' : 'font-medium')}>{title}</span>
          {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="unread" />}
        </span>
        {sub && <span className="mt-0.5 block truncate text-sm text-slate-600 dark:text-slate-300">{sub}</span>}
        {meta && <span className="mt-0.5 block truncate text-xs text-slate-600 dark:text-slate-400">{meta}</span>}
      </span>
      {badge && (
        <span
          title={badge.title}
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
            badge.stale
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
              : 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300',
          )}
        >
          {badge.text}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
    </>
  );
  const cls = cn(
    'flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/5',
    unread && 'bg-primary/[0.04] dark:bg-white/[0.03]',
  );
  return (
    <li>
      {href ? (
        <Link href={href} onClick={onClick} className={cls}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={cls}>
          {body}
        </button>
      )}
    </li>
  );
}

/** Full approval card with its decision buttons — used in the Approvals tab. */
function ApprovalCard({ item, busy, onDecide }: { item: PendingApproval; busy: boolean; onDecide: (action: ApprovalAction) => void }) {
  const copy = APPROVAL_COPY[item.type];
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <Avatar type={item.type} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
          {item.preview && (
            <p className="mt-0.5 line-clamp-3 text-sm whitespace-pre-line text-slate-600 dark:text-slate-300">{item.preview}</p>
          )}
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {[copy.label, ago(item.at)].filter(Boolean).join(' · ')}
            {item.campaignId && (
              <>
                {' · '}
                <Link
                  href={`/campaigns/${encodeURIComponent(item.campaignId)}`}
                  className="font-medium text-primary underline-offset-2 hover:underline dark:text-blue-300"
                >
                  Open campaign
                </Link>
              </>
            )}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide('approve')}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold whitespace-nowrap sm:px-4 text-white hover:bg-primary/90 disabled:opacity-60 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {copy.approve}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide('reject')}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-medium whitespace-nowrap sm:px-4 text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-blue-950/40 dark:text-slate-200 dark:hover:bg-white/5"
            >
              {copy.reject}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

const CARD = 'overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-blue-950/40 dark:bg-[#071131]';
const LIST = 'divide-y divide-slate-100 dark:divide-blue-950/40';

/** Digest card: header, up to three rows, and a "See all" footer. */
function DigestCard({
  icon: Icon,
  title,
  count,
  capped,
  onSeeAll,
  children,
  footerNote,
}: {
  icon: typeof Hand;
  title: string;
  count: number;
  capped?: boolean;
  onSeeAll: () => void;
  children: React.ReactNode;
  footerNote?: React.ReactNode;
}) {
  return (
    <section className={CARD}>
      <header className="flex items-center gap-3 px-4 pt-3 pb-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary dark:bg-white/10 dark:text-white">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="flex-1 text-[15px] font-semibold text-slate-900 dark:text-white">{title}</h2>
        <CountBadge n={count} capped={capped} />
      </header>
      {children}
      {footerNote}
      {count > DIGEST_SIZE && (
        <button
          type="button"
          onClick={onSeeAll}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 border-t border-slate-100 text-sm font-medium text-primary hover:bg-slate-50 dark:border-blue-950/40 dark:text-blue-300 dark:hover:bg-white/5"
        >
          See all {count}
          {capped ? '+' : ''} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </section>
  );
}

/** Filter chips inside a category tab: "All 30 · WA Business 10 · …". */
function Chips<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K | 'all'; label: string; count: number; capped?: boolean }[];
  value: K | 'all';
  onChange: (k: K | 'all') => void;
}) {
  if (options.length <= 2) return null; // "All" + one kind: nothing to filter
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors max-lg:min-h-11',
            value === o.key
              ? 'border-primary bg-primary text-white dark:border-blue-500 dark:bg-blue-600'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-blue-950/40 dark:bg-[#071131] dark:text-slate-200 dark:hover:bg-white/5',
          )}
        >
          {o.label}
          <span className={cn('tabular-nums', value === o.key ? 'text-white/80' : 'text-slate-500 dark:text-slate-400')}>
            {o.count}
            {o.capped ? '+' : ''}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Paged list: ten rows, then "Show more". Resets when the filter changes. */
function Paged<T>({ items, render, resetKey }: { items: T[]; render: (item: T) => React.ReactNode; resetKey: string }) {
  const [shown, setShown] = useState(PAGE_SIZE);
  useEffect(() => setShown(PAGE_SIZE), [resetKey]);
  return (
    <>
      <ul className={LIST}>{items.slice(0, shown).map(render)}</ul>
      {items.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE_SIZE)}
          className="flex min-h-11 w-full items-center justify-center border-t border-slate-100 text-sm font-medium text-primary hover:bg-slate-50 dark:border-blue-950/40 dark:text-blue-300 dark:hover:bg-white/5"
        >
          Show {Math.min(PAGE_SIZE, items.length - shown)} more of {items.length - shown}
        </button>
      )}
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function MyTasks() {
  const qc = useQueryClient();
  const waba = useWaitingChats('waba');
  const personal = useWaitingChats('personal');
  const assigned = useAssignedConversations();
  const notes = useTaskNotifications();
  const markRead = useMarkTaskNotificationRead();
  const approvals = usePendingApprovals();
  const decide = useDecideApproval();

  // The tab lives in ?view= so back/forward and shared links land on it.
  const [view, setViewState] = useState<View>('all');
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('view') as View | null;
    if (v && VIEWS.includes(v)) setViewState(v);
  }, []);
  const setView = (v: View) => {
    setViewState(v);
    const url = new URL(window.location.href);
    if (v === 'all') url.searchParams.delete('view');
    else url.searchParams.set('view', v);
    window.history.replaceState(null, '', url);
    window.scrollTo({ top: 0 });
  };
  const [replyFilter, setReplyFilter] = useState<TaskChannel | 'all'>('all');
  const [approvalFilter, setApprovalFilter] = useState<ApprovalType | 'all'>('all');

  const [deciding, setDeciding] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  // ── Replies: oldest wait first — that's the one most at risk.
  const replySources = [
    { channel: 'waba' as const, q: waba },
    { channel: 'personal' as const, q: personal },
  ];
  const repliesLoading = replySources.some((s) => s.q.isLoading);
  const repliesFailed = replySources.filter((s) => !s.q.isLoading && !s.q.isFetching && s.q.data === undefined);
  const replies: WaitingChat[] = useMemo(
    () => replySources.flatMap((s) => s.q.data ?? []).sort((a, b) => time(a.at) - time(b.at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [waba.data, personal.data],
  );
  const replyCapped = (c: TaskChannel) => (replySources.find((s) => s.channel === c)?.q.data?.length ?? 0) >= WAITING_CHATS_LIMIT;
  const anyReplyCapped = replySources.some((s) => replyCapped(s.channel));

  // ── Approvals
  const approvalsFailed = !approvals.isLoading && !approvals.isFetching && approvals.data === undefined;
  const approvalItems = approvals.data?.items ?? [];
  const approvalsDegraded = approvals.data?.degraded ?? [];

  // ── Assigned + alerts
  const assignedFailed = !assigned.isLoading && !assigned.isFetching && assigned.data === undefined;
  const assignedItems: AssignedConversation[] = assigned.data ?? [];
  const notesFailed = !notes.isLoading && !notes.isFetching && notes.data === undefined;
  const alerts: TaskNotification[] = useMemo(
    () => [...(notes.data ?? [])].sort((a, b) => Number(a.isRead) - Number(b.isRead) || time(b.receivedAt) - time(a.receivedAt)),
    [notes.data],
  );
  const unread = alerts.filter((n) => !n.isRead).length;

  const refreshing =
    replySources.some((s) => s.q.isFetching) || assigned.isFetching || notes.isFetching || approvals.isFetching;

  const onDecide = (item: PendingApproval, action: ApprovalAction) => {
    setDeciding(`${item.type}:${item.id}`);
    setDecisionNote(null);
    decide.mutate(
      { type: item.type, id: item.id, action },
      {
        onSuccess: (out) =>
          setDecisionNote({
            tone: 'ok',
            text: out.applied ? out.message || 'Done.' : `${item.title}: already decided or expired — nothing changed.`,
          }),
        onError: () => setDecisionNote({ tone: 'error', text: `Couldn't record that for ${item.title}. Try again.` }),
        onSettled: () => setDeciding(null),
      },
    );
  };

  // ── Row renderers (shared by digest and full lists)
  const replyRow = (c: WaitingChat) => (
    <Row
      key={`${c.channel}:${c.conversationId}`}
      href={chatHref(c.channel, c.conversationId)}
      channel={c.channel}
      title={c.contactName}
      sub={c.preview}
      meta={CHANNEL_NAME[c.channel]}
      badge={c.at ? { text: waitingFor(c.at) ?? '', stale: isStale(c.at), title: `Last message ${ago(c.at)}` } : null}
    />
  );
  const assignedRow = (a: AssignedConversation) => (
    <Row
      key={a.assignmentId}
      href={chatHref(a.channel, a.conversationId)}
      channel={a.channel}
      title={a.contactName || a.contactPhone || 'Conversation'}
      sub={a.contactName && a.contactPhone ? a.contactPhone : null}
      meta={[
        a.messageCount != null ? `${a.messageCount} message${a.messageCount === 1 ? '' : 's'}` : null,
        a.assignedAt ? `assigned ${ago(a.assignedAt)}` : null,
      ]
        .filter(Boolean)
        .join(' · ')}
    />
  );
  const alertRow = (n: TaskNotification) => (
    <Row
      key={n.id}
      href={chatHref(null, n.conversationId)}
      onClick={() => {
        if (!n.isRead) markRead.mutate(n.id);
      }}
      channel={null}
      title={n.contactName}
      sub={n.preview}
      meta={ago(n.receivedAt)}
      unread={!n.isRead}
    />
  );
  const approvalDigestRow = (a: PendingApproval) => (
    <Row
      key={`${a.type}:${a.id}`}
      onClick={() => {
        setApprovalFilter(a.type);
        setView('approvals');
      }}
      type={a.type}
      title={a.title}
      sub={a.preview}
      meta={[APPROVAL_COPY[a.type].label, ago(a.at)].filter(Boolean).join(' · ')}
    />
  );

  // ── Tabs
  const tabs: { key: View; label: string; count: number; capped?: boolean }[] = [
    { key: 'all', label: 'All', count: replies.length + approvalItems.length + assignedItems.length + unread, capped: anyReplyCapped },
    { key: 'replies', label: 'Replies', count: replies.length, capped: anyReplyCapped },
    { key: 'approvals', label: 'Approvals', count: approvalItems.length },
    { key: 'assigned', label: 'Assigned', count: assignedItems.length },
    { key: 'alerts', label: 'Alerts', count: unread },
  ];

  // ── "All clear" categories fold into one line in the digest.
  const clear: string[] = [];
  if (!repliesLoading && repliesFailed.length === 0 && replies.length === 0) clear.push('no replies waiting');
  if (!approvals.isLoading && !approvalsFailed && approvalsDegraded.length === 0 && approvalItems.length === 0) clear.push('nothing to approve');
  if (!assigned.isLoading && !assignedFailed && assignedItems.length === 0) clear.push('nothing assigned');
  if (!notes.isLoading && !notesFailed && alerts.length === 0) clear.push('no alerts');

  const repliesFailNote =
    repliesFailed.length > 0 ? <Failed what={repliesFailed.map((s) => CHANNEL_NAME[s.channel]).join(', ')} /> : null;
  const approvalsFailNote =
    approvalsDegraded.length > 0 ? <Failed what={approvalsDegraded.map((t) => APPROVAL_TYPE_PLURAL[t]).join(', ')} /> : null;

  // ── Filtered full lists
  const replyOptions = [
    { key: 'all' as const, label: 'All', count: replies.length, capped: anyReplyCapped },
    ...replySources.map((s) => ({
      key: s.channel,
      label: CHANNEL_SHORT[s.channel],
      count: replies.filter((r) => r.channel === s.channel).length,
      capped: replyCapped(s.channel),
    })),
  ].filter((o) => o.key === 'all' || o.count > 0);
  const filteredReplies = replyFilter === 'all' ? replies : replies.filter((r) => r.channel === replyFilter);

  const approvalTypes = Array.from(new Set(approvalItems.map((a) => a.type)));
  const approvalOptions = [
    { key: 'all' as const, label: 'All', count: approvalItems.length },
    ...approvalTypes.map((t) => ({ key: t, label: APPROVAL_TYPE_SHORT[t], count: approvalItems.filter((a) => a.type === t).length })),
  ];
  const effectiveApprovalFilter = approvalFilter !== 'all' && !approvalTypes.includes(approvalFilter) ? 'all' : approvalFilter;
  const filteredApprovals =
    effectiveApprovalFilter === 'all' ? approvalItems : approvalItems.filter((a) => a.type === effectiveApprovalFilter);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-8 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Tasks</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">What needs a person today.</p>
        </div>
        <button
          type="button"
          onClick={() => qc.invalidateQueries({ queryKey: taskKeys.all })}
          disabled={refreshing}
          aria-label="Refresh tasks"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-blue-950/40 dark:text-slate-200 dark:hover:bg-white/5"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
        </button>
      </div>

      {/* Tabs — pinned while the list scrolls. */}
      <div className="sticky top-0 z-10 -mx-4 mt-4 bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 dark:bg-[#000724]/95">
        <div role="tablist" aria-label="Task categories" className="grid grid-cols-5 gap-1 rounded-xl bg-slate-100 p-1 max-[359px]:gap-0.5 dark:bg-white/5">
          {tabs.map((t) => {
            const selected = view === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={`${t.label}: ${t.count}${t.capped ? ' or more' : ''}`}
                onClick={() => setView(t.key)}
                className={cn(
                  'flex min-h-14 min-w-0 flex-col items-center justify-center rounded-lg px-0.5 transition-colors max-[359px]:px-0',
                  selected
                    ? 'bg-white shadow-sm dark:bg-[#0b1433]'
                    : 'hover:bg-white/60 dark:hover:bg-white/5',
                )}
              >
                <span
                  className={cn(
                    'text-lg leading-tight font-bold tabular-nums',
                    t.count > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500',
                    selected && t.count > 0 && 'text-primary dark:text-blue-300',
                  )}
                >
                  {t.count}
                  {t.capped ? '+' : ''}
                </span>
                <span
                  className={cn(
                    'max-w-full truncate text-[11px] leading-tight max-[359px]:text-[10px] max-[359px]:tracking-tight sm:text-xs',
                    selected ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-300',
                  )}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {decisionNote && (
        <p
          role="status"
          className={cn(
            'mt-3 rounded-xl border px-4 py-2 text-sm',
            decisionNote.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
          )}
        >
          {decisionNote.text}
        </p>
      )}

      <div className="mt-3 space-y-3">
        {view === 'all' && (
          <>
            {(repliesLoading || replies.length > 0 || repliesFailNote) && (
              <DigestCard
                icon={Hand}
                title="Replies waiting"
                count={replies.length}
                capped={anyReplyCapped}
                onSeeAll={() => setView('replies')}
                footerNote={repliesFailNote}
              >
                {repliesLoading && replies.length === 0 ? <Loading /> : <ul className={LIST}>{replies.slice(0, DIGEST_SIZE).map(replyRow)}</ul>}
              </DigestCard>
            )}

            {(approvals.isLoading || approvalItems.length > 0 || approvalsFailed || approvalsFailNote) && (
              <DigestCard
                icon={ShieldCheck}
                title="Needs your approval"
                count={approvalItems.length}
                onSeeAll={() => setView('approvals')}
                footerNote={approvalsFailNote}
              >
                {approvals.isLoading ? (
                  <Loading />
                ) : approvalsFailed ? (
                  <Failed what="approvals" />
                ) : (
                  <ul className={LIST}>{approvalItems.slice(0, DIGEST_SIZE).map(approvalDigestRow)}</ul>
                )}
              </DigestCard>
            )}

            {(assigned.isLoading || assignedItems.length > 0 || assignedFailed) && (
              <DigestCard icon={UserCheck} title="Assigned to you" count={assignedItems.length} onSeeAll={() => setView('assigned')}>
                {assigned.isLoading ? (
                  <Loading />
                ) : assignedFailed ? (
                  <Failed what="your assignments" />
                ) : (
                  <ul className={LIST}>{assignedItems.slice(0, DIGEST_SIZE).map(assignedRow)}</ul>
                )}
              </DigestCard>
            )}

            {(notes.isLoading || unread > 0 || notesFailed) && (
              <DigestCard icon={Bell} title="Unread alerts" count={unread} onSeeAll={() => setView('alerts')}>
                {notes.isLoading ? (
                  <Loading />
                ) : notesFailed ? (
                  <Failed what="your alerts" />
                ) : (
                  <ul className={LIST}>{alerts.filter((n) => !n.isRead).slice(0, DIGEST_SIZE).map(alertRow)}</ul>
                )}
              </DigestCard>
            )}

            {clear.length > 0 && (
              <p className="flex items-start gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-blue-950/40 dark:text-slate-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span>
                  All clear: {clear.join(' · ')}.
                </span>
              </p>
            )}
          </>
        )}

        {view === 'replies' && (
          <>
            <Chips options={replyOptions} value={replyFilter} onChange={setReplyFilter} />
            <section className={CARD}>
              {repliesLoading && replies.length === 0 ? (
                <Loading />
              ) : filteredReplies.length === 0 && repliesFailed.length < replySources.length ? (
                <Empty text="No chats are waiting for a person." />
              ) : (
                <Paged items={filteredReplies} render={replyRow} resetKey={replyFilter} />
              )}
              {repliesFailNote}
            </section>
            {anyReplyCapped && (
              <p className="px-1 text-xs text-slate-600 dark:text-slate-400">
                Showing the {WAITING_CHATS_LIMIT} most recent per channel — open the{' '}
                <Link href="/conversations" className="font-medium text-primary underline-offset-2 hover:underline dark:text-blue-300">
                  Inbox
                </Link>{' '}
                for the rest.
              </p>
            )}
          </>
        )}

        {view === 'approvals' && (
          <>
            <Chips options={approvalOptions} value={effectiveApprovalFilter} onChange={setApprovalFilter} />
            <section className={CARD}>
              {approvals.isLoading ? (
                <Loading />
              ) : approvalsFailed ? (
                <Failed what="approvals" />
              ) : filteredApprovals.length === 0 ? (
                <Empty text="Nothing is waiting for approval." />
              ) : (
                <Paged
                  items={filteredApprovals}
                  resetKey={effectiveApprovalFilter}
                  render={(item) => (
                    <ApprovalCard
                      key={`${item.type}:${item.id}`}
                      item={item}
                      busy={deciding === `${item.type}:${item.id}`}
                      onDecide={(action) => onDecide(item, action)}
                    />
                  )}
                />
              )}
              {approvalsFailNote}
            </section>
          </>
        )}

        {view === 'assigned' && (
          <section className={CARD}>
            {assigned.isLoading ? (
              <Loading />
            ) : assignedFailed ? (
              <Failed what="your assignments" />
            ) : assignedItems.length === 0 ? (
              <Empty text="Nothing is assigned to you." />
            ) : (
              <Paged items={assignedItems} render={assignedRow} resetKey="assigned" />
            )}
          </section>
        )}

        {view === 'alerts' && (
          <section className={CARD}>
            {notes.isLoading ? (
              <Loading />
            ) : notesFailed ? (
              <Failed what="your alerts" />
            ) : alerts.length === 0 ? (
              <Empty text="No alerts." />
            ) : (
              <Paged items={alerts} render={alertRow} resetKey="alerts" />
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default MyTasks;
